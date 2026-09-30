import React, { useEffect, useState, useRef } from 'react';
import Header from './components/Header';
import PriceHeader from './components/PriceHeader';
import Chart from './components/Chart';
import TradePanel from './components/TradePanel';
import Tabs from './components/Tabs';
import Lobby from './components/Lobby';
import BetweenRoundsModal from './components/BetweenRoundsModal';
import FinalResultsModal from './components/FinalResultsModal';
import Toast from './components/Toast';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('arena_theme') || 'light');
  const [connected, setConnected] = useState(false);
  const [myNickname, setMyNickname] = useState(() => localStorage.getItem('arena_nick') || '');
  const [myPlayerId, setMyPlayerId] = useState(null);

  // Multi-room lifecycle & session tracking
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialRoomParam = (urlParams.get('room') || '').trim().toUpperCase();
  const savedActiveRoom = typeof window !== 'undefined' ? (sessionStorage.getItem('arena_active_room') || '') : '';
  const isResumingSession = Boolean(savedActiveRoom && initialRoomParam && savedActiveRoom === initialRoomParam);

  const [inRoom, setInRoom] = useState(isResumingSession);
  const [roomCode, setRoomCode] = useState(isResumingSession ? savedActiveRoom : initialRoomParam);

  useEffect(() => {
    // If visiting clean home screen (no ?room= in URL), clear any stale active room session
    if (!initialRoomParam) {
      sessionStorage.removeItem('arena_active_room');
    }
  }, [initialRoomParam]);

  const [game, setGame] = useState({
    state: 'LOBBY',
    config: { roundDurationSec: 180, numberOfRounds: 3, startingBalance: 10000, maxLeverage: 20 },
    currentRoundIndex: 0,
    totalRounds: 3,
    hostPlayerId: null,
    players: [],
    roundSummary: null,
    revealedDate: null,
    betweenRoundCountdown: 0
  });

  const [myState, setMyState] = useState(null);
  const [tickData, setTickData] = useState({
    currentPrice: 43500,
    initialPrice: 43500,
    high: 43500,
    low: 43500,
    timeLeftSec: 180,
    totalTicks: 180,
    candle: null,
    candles: [],
    leaderboard: [],
    feed: []
  });

  const [toasts, setToasts] = useState([]);
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const [finalResults, setFinalResults] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('arena_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Only auto-join if actively in a room session in this tab
        const activeRoom = sessionStorage.getItem('arena_active_room');
        const savedNick = localStorage.getItem('arena_nick');
        if (activeRoom && savedNick) {
          ws.send(JSON.stringify({ type: 'JOIN', nickname: savedNick, roomCode: activeRoom }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'JOINED':
              setInRoom(true);
              setMyPlayerId(msg.playerId);
              setMyNickname(msg.nickname);
              if (msg.roomCode) {
                setRoomCode(msg.roomCode);
                sessionStorage.setItem('arena_active_room', msg.roomCode);
                const currentUrl = new URL(window.location.href);
                if (currentUrl.searchParams.get('room') !== msg.roomCode) {
                  currentUrl.searchParams.set('room', msg.roomCode);
                  window.history.replaceState(null, '', currentUrl.toString());
                }
              }
              localStorage.setItem('arena_nick', msg.nickname);
              break;

            case 'LEFT_ROOM':
              setInRoom(false);
              setRoomCode('');
              setMyPlayerId(null);
              sessionStorage.removeItem('arena_active_room');
              window.history.pushState(null, '', window.location.pathname);
              break;

            case 'GAME_STATE':
              setGame(msg.game);
              if (msg.myState) {
                setMyState(msg.myState);
              }
              break;

            case 'ROUND_STARTED':
              setGame(prev => ({
                ...prev,
                state: 'ROUND_ACTIVE',
                currentRoundIndex: msg.roundIndex !== undefined ? msg.roundIndex : prev.currentRoundIndex,
                totalRounds: msg.totalRounds || prev.totalRounds
              }));
              setTickData(prev => ({
                ...prev,
                currentPrice: msg.initialPrice,
                initialPrice: msg.initialPrice,
                high: msg.initialPrice,
                low: msg.initialPrice,
                timeLeftSec: msg.duration,
                totalTicks: msg.duration,
                candle: msg.candle,
                candles: [msg.candle],
                feed: []
              }));
              setFinalResults(null);
              break;

            case 'TICK':
              setGame(prev => {
                if (prev.state === 'LOBBY') {
                  return {
                    ...prev,
                    state: 'ROUND_ACTIVE',
                    currentRoundIndex: msg.roundIndex !== undefined ? msg.roundIndex : prev.currentRoundIndex
                  };
                }
                return prev;
              });
              setTickData(prev => {
                const high = Math.max(prev.high, msg.price);
                const low = Math.min(prev.low, msg.price);

                if (msg.feed && msg.feed.length > 0) {
                  const latest = msg.feed[0];
                  if (latest.type === 'LIQUIDATION' && (!prev.feed[0] || prev.feed[0].id !== latest.id)) {
                    addToast('LIQUIDATION', `${latest.nickname} liquidated on ${latest.side} ${latest.leverage}x!`);
                  }
                }

                let updatedCandles = [...prev.candles];
                const lastIdx = updatedCandles.length - 1;
                if (lastIdx >= 0 && msg.candle && updatedCandles[lastIdx].time === msg.candle.time) {
                  updatedCandles[lastIdx] = msg.candle;
                } else if (msg.candle) {
                  updatedCandles.push(msg.candle);
                }

                return {
                  ...prev,
                  currentPrice: msg.price,
                  high,
                  low,
                  timeLeftSec: msg.timeLeftSec,
                  totalTicks: msg.totalTicks,
                  candle: msg.candle,
                  candles: updatedCandles,
                  leaderboard: msg.leaderboard || prev.leaderboard,
                  feed: msg.feed || prev.feed
                };
              });

              if (myPlayerId) {
                const me = msg.leaderboard?.find(p => p.id === myPlayerId);
                if (me) {
                  setMyState(prev => ({
                    ...(prev || {}),
                    balance: me.balance,
                    equity: me.equity,
                    bankDebt: me.bankDebt,
                    bankRatePct: me.bankRatePct,
                    losingTrades: me.losingTrades,
                    totalCumulativeScore: me.totalScore,
                    positions: me.positions || [],
                    position: me.position,
                    limitOrders: me.limitOrders || [],
                    isLiquidated: me.isLiquidated,
                    strategyActive: me.strategyActive,
                    strategyError: me.strategyError
                  }));
                }
              }
              break;

            case 'ROUND_FINISHED':
              setGame(prev => ({
                ...prev,
                state: 'ROUND_ENDED',
                roundSummary: msg.roundSummary,
                revealedDate: msg.revealedDate,
                betweenRoundCountdown: msg.countdown
              }));
              break;

            case 'COUNTDOWN_TICK':
              setGame(prev => ({
                ...prev,
                betweenRoundCountdown: msg.countdown
              }));
              break;

            case 'GAME_OVER':
              setGame(prev => ({
                ...prev,
                state: 'FINAL_RESULTS'
              }));
              setFinalResults({
                roundSummary: msg.roundSummary,
                revealedDate: msg.revealedDate,
                allHistories: msg.allHistories,
                allStats: msg.allStats,
                roundDurations: msg.roundDurations
              });
              break;

            case 'GAME_RESTARTED':
              setGame(prev => ({
                ...prev,
                state: 'LOBBY',
                roundSummary: null,
                revealedDate: null
              }));
              setFinalResults(null);
              setTickData(prev => ({
                ...prev,
                currentPrice: 43500,
                candles: [],
                feed: []
              }));
              addToast('INFO', 'Game restarted by Host. Ready in lobby!');
              break;

            case 'RULES_UPDATED':
              if (msg.myState) {
                setMyState(msg.myState);
              }
              break;

            case 'STRATEGY_SET_RESULT':
              if (msg.success) {
                addToast('SUCCESS', `Strategy deployed (${msg.blockCount} blocks)!`);
              } else {
                addToast('ERROR', `Strategy error: ${msg.error}`);
              }
              if (msg.myState) {
                setMyState(msg.myState);
              }
              break;

            case 'STRATEGY_TOGGLED':
              addToast('INFO', `Strategy ${msg.enabled ? 'Enabled' : 'Paused'}`);
              if (msg.myState) {
                setMyState(msg.myState);
              }
              break;

            case 'STRATEGY_TEST_RESULT':
              setStrategyTestResult(msg.result);
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [myPlayerId]);

  const addToast = (type, message) => {
    const id = 'toast_' + Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const handleDismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleCreateRoom = (nickname, newRoomCode) => {
    const cleanNick = (nickname || '').trim().slice(0, 16);
    const cleanCode = (newRoomCode || '').trim().toUpperCase().slice(0, 16);
    if (!cleanNick || !cleanCode) return;
    setMyNickname(cleanNick);
    localStorage.setItem('arena_nick', cleanNick);
    sessionStorage.setItem('arena_active_room', cleanCode);
    setRoomCode(cleanCode);

    const newUrl = `${window.location.pathname}?room=${cleanCode}`;
    window.history.replaceState(null, '', newUrl);

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'JOIN', nickname: cleanNick, roomCode: cleanCode }));
    }
  };

  const handleJoinRoom = (nickname, targetRoomCode) => {
    const cleanNick = (nickname || '').trim().slice(0, 16);
    const cleanCode = (targetRoomCode || '').trim().toUpperCase().slice(0, 16);
    if (!cleanNick || !cleanCode) return;
    setMyNickname(cleanNick);
    localStorage.setItem('arena_nick', cleanNick);
    sessionStorage.setItem('arena_active_room', cleanCode);
    setRoomCode(cleanCode);

    const newUrl = `${window.location.pathname}?room=${cleanCode}`;
    window.history.replaceState(null, '', newUrl);

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'JOIN', nickname: cleanNick, roomCode: cleanCode }));
    }
  };

  const handleLeaveRoom = () => {
    sessionStorage.removeItem('arena_active_room');
    setInRoom(false);
    setRoomCode('');
    setMyPlayerId(null);
    setGame({
      state: 'LOBBY',
      config: { roundDurationSec: 180, numberOfRounds: 3, startingBalance: 10000, maxLeverage: 20 },
      currentRoundIndex: 0,
      totalRounds: 3,
      hostPlayerId: null,
      players: [],
      roundSummary: null,
      revealedDate: null,
      betweenRoundCountdown: 0
    });
    setFinalResults(null);
    window.history.pushState(null, '', window.location.pathname);

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
    }
  };

  const sendJoin = (nickname) => {
    handleJoinRoom(nickname, roomCode || initialRoomParam || 'ARENA-BTC');
  };

  const handleUpdateConfig = (newConfig) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'HOST_CONFIG', config: newConfig }));
    }
  };

  const handleStartGame = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'HOST_START_GAME' }));
    }
  };

  const handleForceNextRound = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'HOST_NEXT_ROUND' }));
    }
  };

  const handleOrder = ({ side, sizePct, leverage, amount }) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'PLACE_ORDER',
        side,
        sizePct,
        leverage,
        amount
      }));
      setMobileTradeOpen(false);
    }
  };

  const handleLimitOrder = ({ side, limitPrice, sizePct, leverage, amount }) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'PLACE_LIMIT_ORDER',
        side,
        limitPrice,
        sizePct,
        leverage,
        amount
      }));
      setMobileTradeOpen(false);
    }
  };

  const handleCancelLimitOrder = (orderId) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'CANCEL_LIMIT_ORDER',
        orderId
      }));
    }
  };

  const handleClosePosition = (positionId = null) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'CLOSE_POSITION',
        positionId
      }));
      setMobileTradeOpen(false);
    }
  };

  const handleBankBorrow = (amount) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'BANK_BORROW', amount }));
    }
  };

  const handleBankRepay = (amount) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'BANK_REPAY', amount }));
    }
  };

  const handleRestartGame = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'HOST_RESTART_GAME' }));
    }
  };

  const handleEndGame = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'HOST_END_GAME' }));
    }
  };

  const isHost = Boolean(
    (myPlayerId && myPlayerId === game.hostPlayerId) ||
    (!game.hostPlayerId && myPlayerId) ||
    (game.players && game.players.length > 0 && game.players[0].id === myPlayerId)
  );

  return (
    <div className="app-container">
      <Header
        connected={connected}
        gameState={game.state}
        roundIndex={game.currentRoundIndex}
        totalRounds={game.totalRounds}
        timeLeftSec={tickData.timeLeftSec}
        totalTicks={tickData.totalTicks}
        isHost={isHost}
        roomCode={inRoom ? (roomCode || game.roomCode) : ''}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRestartGame={handleRestartGame}
        onEndGame={handleEndGame}
      />

      {!inRoom || game.state === 'LOBBY' ? (
        <Lobby
          isHost={isHost}
          players={game.players}
          config={game.config}
          myNickname={myNickname}
          myPlayerId={myPlayerId}
          roomCode={roomCode || game.roomCode}
          inRoom={inRoom}
          initialRoomCode={initialRoomParam}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLeaveRoom={handleLeaveRoom}
          onUpdateConfig={handleUpdateConfig}
          onStartGame={handleStartGame}
        />
      ) : (
        <main className="trading-layout">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <PriceHeader
              currentPrice={tickData.currentPrice}
              initialPrice={tickData.initialPrice}
              high={tickData.high}
              low={tickData.low}
            />

            <Chart
              candles={tickData.candles}
              currentCandle={tickData.candle}
              theme={theme}
              positions={myState?.positions || []}
              playerPosition={myState?.position}
              roundIndex={game.currentRoundIndex}
            />

            <Tabs
              leaderboard={tickData.leaderboard}
              feed={tickData.feed}
              gameState={game.state}
              currentUserId={myPlayerId}
              onClosePosition={handleClosePosition}
              limitOrders={myState?.limitOrders || []}
              onCancelLimitOrder={handleCancelLimitOrder}
              currentPrice={tickData.currentPrice}
            />
          </div>

          {/* Desktop Right Column: Trade Panel without embedded positions */}
          <div className="desktop-trade-panel" style={{ display: 'block' }}>
            <TradePanel
              balance={myState?.balance || 10000}
              equity={myState?.equity || 10000}
              currentPrice={tickData.currentPrice}
              isLiquidated={myState?.isLiquidated}
              maxLeverage={game.config?.maxLeverage || 20}
              bankDebt={myState?.bankDebt || 0}
              bankRatePct={myState?.bankRatePct || '0.10'}
              losingTrades={myState?.losingTrades || 0}
              onOrder={handleOrder}
              onLimitOrder={handleLimitOrder}
              openLimitOrders={myState?.limitOrders || []}
              onCancelLimitOrder={handleCancelLimitOrder}
              onBankBorrow={handleBankBorrow}
              onBankRepay={handleBankRepay}
              disabled={game.state !== 'ROUND_ACTIVE'}
            />
          </div>

          {/* Mobile Bottom Action Bar */}
          <div className="mobile-trade-bar" style={{
            display: 'none',
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-hairline)',
            padding: '10px 16px',
            gap: '10px',
            zIndex: 80
          }}>
            <button
              onClick={() => setMobileTradeOpen(true)}
              className="btn-base btn-long"
              style={{ flex: 1, padding: '12px', fontSize: '13px', minHeight: '44px', fontWeight: 700 }}
            >
              BUY / LONG
            </button>
            <button
              onClick={() => setMobileTradeOpen(true)}
              className="btn-base btn-short"
              style={{ flex: 1, padding: '12px', fontSize: '13px', minHeight: '44px', fontWeight: 700 }}
            >
              SELL / SHORT
            </button>
          </div>

          {/* Mobile Bottom Sheet Modal */}
          {mobileTradeOpen && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 90,
              display: 'flex',
              alignItems: 'flex-end'
            }} onClick={() => setMobileTradeOpen(false)}>
              <div
                style={{ width: '100%', backgroundColor: 'var(--bg-surface)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '16px', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <TradePanel
                  balance={myState?.balance || 10000}
                  equity={myState?.equity || 10000}
                  currentPrice={tickData.currentPrice}
                  isLiquidated={myState?.isLiquidated}
                  maxLeverage={game.config?.maxLeverage || 20}
                  bankDebt={myState?.bankDebt || 0}
                  bankRatePct={myState?.bankRatePct || '0.10'}
                  losingTrades={myState?.losingTrades || 0}
                  onOrder={handleOrder}
                  onLimitOrder={handleLimitOrder}
                  openLimitOrders={myState?.limitOrders || []}
                  onCancelLimitOrder={handleCancelLimitOrder}
                  onBankBorrow={handleBankBorrow}
                  onBankRepay={handleBankRepay}
                  disabled={game.state !== 'ROUND_ACTIVE'}
                />
              </div>
            </div>
          )}
        </main>
      )}

      {/* Between Rounds Modal */}
      {game.state === 'ROUND_ENDED' && (
        <BetweenRoundsModal
          roundIndex={game.currentRoundIndex}
          totalRounds={game.totalRounds}
          roundSummary={game.roundSummary}
          revealedDate={game.revealedDate}
          countdown={game.betweenRoundCountdown}
          isHost={isHost}
          onForceNextRound={handleForceNextRound}
          onRestartGame={handleRestartGame}
          onEndGame={handleEndGame}
        />
      )}

      {/* Final Championship Results Modal */}
      {game.state === 'FINAL_RESULTS' && finalResults && (
        <FinalResultsModal
          allHistories={finalResults.allHistories}
          allStats={finalResults.allStats}
          roundDurations={finalResults.roundDurations}
          revealedDate={finalResults.revealedDate}
          isHost={isHost}
          onRestartGame={handleRestartGame}
          onPlayAgain={handleRestartGame}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
