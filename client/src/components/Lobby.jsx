import React, { useState } from 'react';

function generateRandomRoomCode() {
  const words = ['BULL', 'BEAR', 'MOON', 'APEX', 'NOVA', 'PUMP', 'WAVE', 'SWAP'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${word}-${num}`;
}

export default function Lobby({
  players = [],
  isHost = false,
  config = {},
  myNickname = '',
  myPlayerId = '',
  roomCode = '',
  inRoom = false,
  initialRoomCode = '',
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onUpdateConfig,
  onStartGame
}) {
  const [nicknameInput, setNicknameInput] = useState(() => localStorage.getItem('arena_nick') || '');
  const [joinRoomInput, setJoinRoomInput] = useState(initialRoomCode || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCustomRoomInput, setShowCustomRoomInput] = useState(false);

  // Simplified settings: 1 slider for duration (1 to 15 min), 1 slider for rounds (1 to 5)
  const [durationMin, setDurationMin] = useState(Math.round((config.roundDurationSec || 180) / 60));
  const [roundsCount, setRoundsCount] = useState(config.numberOfRounds || 3);
  const [maxLeverage, setMaxLeverage] = useState(config.maxLeverage || 20);
  const [seed, setSeed] = useState(config.seed || '');
  const [candleDurationSec, setCandleDurationSec] = useState(config.candleDurationSec || 15);

  const activeRoomCode = roomCode || initialRoomCode || 'ARENA-BTC';

  const handleCopyLink = () => {
    const joinUrl = `${window.location.origin}/?room=${activeRoomCode}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeRoomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const cleanNick = nicknameInput.trim();
    if (!cleanNick) return;
    const newRoomCode = generateRandomRoomCode();
    if (onCreateRoom) {
      onCreateRoom(cleanNick, newRoomCode);
    } else if (onJoinRoom) {
      onJoinRoom(cleanNick, newRoomCode);
    }
  };

  const handleJoinExistingSubmit = (e) => {
    e.preventDefault();
    const cleanNick = nicknameInput.trim();
    const cleanRoom = (joinRoomInput.trim() || initialRoomCode || 'ARENA-BTC').toUpperCase();
    if (!cleanNick) return;
    if (onJoinRoom) {
      onJoinRoom(cleanNick, cleanRoom);
    }
  };

  const handleConfigChange = (newMin, newRounds, newLev, newSeed, newCandleSec) => {
    onUpdateConfig({
      roundDurationSec: (newMin ?? durationMin) * 60,
      numberOfRounds: newRounds ?? roundsCount,
      maxLeverage: newLev ?? maxLeverage,
      seed: (newSeed ?? seed).trim(),
      candleDurationSec: newCandleSec ?? candleDurationSec
    });
  };

  // HOME SCREEN (Before entering or creating a room)
  if (!inRoom) {
    return (
      <div style={{
        maxWidth: '440px',
        margin: '60px auto',
        padding: '0 20px',
        width: '100%'
      }}>
        <div className="card" style={{ padding: '28px', boxShadow: '0 12px 32px rgba(0,0,0,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent)'
            }}>
              Multiplayer Trading Simulation
            </span>
            <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', marginTop: '4px', marginBottom: '6px' }}>
              INTRADAY TRADING ARENA
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Compete in accelerated historical markets. Pure server-authoritative trading.
            </p>
          </div>

          {/* If user clicked an invite link with ?room=CODE */}
          {initialRoomCode && (
            <div style={{
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Invited to room: </span>
                <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{initialRoomCode}</strong>
              </div>
              <button
                type="button"
                onClick={() => setJoinRoomInput('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Change
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-secondary)',
                marginBottom: '6px'
              }}>
                Your Trader Nickname
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Satoshi"
                maxLength={16}
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                className="input-base"
                style={{ width: '100%', fontSize: '14px', padding: '10px 12px' }}
              />
            </div>

            {/* Direct Join button if invite room code is present */}
            {initialRoomCode ? (
              <button
                type="button"
                onClick={handleJoinExistingSubmit}
                disabled={!nicknameInput.trim()}
                className="btn-base btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
              >
                JOIN ROOM {initialRoomCode}
              </button>
            ) : (
              <>
                {/* Create Room Action */}
                <button
                  type="button"
                  onClick={handleCreateSubmit}
                  disabled={!nicknameInput.trim()}
                  className="btn-base btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
                >
                  CREATE NEW ROOM
                </button>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  margin: '6px 0',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-hairline)' }} />
                  <span>or join existing</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-hairline)' }} />
                </div>

                {/* Join Existing Room */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Room Code (e.g. BULL-82)"
                    maxLength={16}
                    value={joinRoomInput}
                    onChange={(e) => setJoinRoomInput(e.target.value.toUpperCase())}
                    className="input-base"
                    style={{ flex: 1, fontSize: '13px', padding: '9px 12px', textTransform: 'uppercase' }}
                  />
                  <button
                    type="button"
                    onClick={handleJoinExistingSubmit}
                    disabled={!nicknameInput.trim()}
                    className="btn-base btn-outline"
                    style={{ padding: '9px 16px', fontWeight: 600, fontSize: '13px' }}
                  >
                    JOIN
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE ROOM LOBBY SCREEN (Waiting for Host to start)
  return (
    <div style={{
      maxWidth: '680px',
      margin: '40px auto',
      padding: '0 20px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Session Info Card */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontWeight: 600 }}>
              GAME LOBBY
            </span>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px' }}>
              Waiting for Host to Start
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Room Code:</span>
              <code style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-subtle)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)'
              }}>
                {activeRoomCode}
              </code>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleCopyCode}
              className="btn-base btn-outline"
              style={{ fontSize: '11px', padding: '6px 10px', fontWeight: 600 }}
              title="Copy Room Code to clipboard"
            >
              {copiedCode ? 'COPIED' : 'COPY CODE'}
            </button>

            <button
              onClick={handleCopyLink}
              className="btn-base btn-outline"
              style={{ fontSize: '11px', padding: '6px 10px', fontWeight: 600 }}
              title="Copy shareable link for friends to join this exact room"
            >
              {copiedLink ? 'COPIED' : 'COPY JOIN LINK'}
            </button>

            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="btn-base"
                style={{
                  fontSize: '11px',
                  padding: '6px 10px',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-page)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-secondary)'
                }}
                title="Leave room and return to home screen"
              >
                ← LEAVE ROOM
              </button>
            )}
          </div>
        </div>

        {/* Connected Players List */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Connected Traders ({players.length})
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {players.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  backgroundColor: 'var(--bg-page)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '12px'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-long)' }} />
                <span style={{ fontWeight: 500 }}>{p.nickname}</span>
                {p.isHost && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    backgroundColor: 'var(--accent-subtle)',
                    padding: '1px 4px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    HOST
                  </span>
                )}
                {p.nickname === myNickname && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(YOU)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Host Controls */}
      {isHost ? (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Host Game Settings
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Each round starts with fresh $10,000. Final winner is the sum of all rounds added up.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Slider 1: Round Duration (1 to 15 min) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Round Duration</span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  {durationMin} {durationMin === 1 ? 'Minute' : 'Minutes'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={durationMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDurationMin(val);
                  handleConfigChange(val, roundsCount, maxLeverage, seed);
                }}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>1 min</span>
                <span>5 min</span>
                <span>10 min</span>
                <span>15 min</span>
              </div>
            </div>

            {/* Slider 2: Number of Rounds (1 to 5) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Rounds</span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  {roundsCount} {roundsCount === 1 ? 'Round' : 'Rounds'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={roundsCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setRoundsCount(val);
                  handleConfigChange(durationMin, val, maxLeverage, seed);
                }}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>1 round</span>
                <span>3 rounds</span>
                <span>5 rounds</span>
              </div>
            </div>

            {/* Max Leverage Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Max Leverage</span>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>{maxLeverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={maxLeverage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setMaxLeverage(val);
                  handleConfigChange(durationMin, roundsCount, val, seed);
                }}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            {/* Candle Pace Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Candle Pace</span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  {candleDurationSec}s per candle
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[10, 15, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setCandleDurationSec(sec);
                      handleConfigChange(durationMin, roundsCount, maxLeverage, seed, sec);
                    }}
                    className="btn-base"
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: candleDurationSec === sec ? 'var(--accent-subtle)' : 'var(--bg-page)',
                      borderColor: candleDurationSec === sec ? 'var(--accent)' : 'var(--border-hairline)',
                      color: candleDurationSec === sec ? 'var(--accent)' : 'var(--text-secondary)'
                    }}
                  >
                    {sec}s {sec === 15 ? '★' : ''}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Smooth 1s live ticks, closes every {candleDurationSec}s
              </div>
            </div>

            {/* Optional Replay Seed */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Replay Seed (Optional)
              </label>
              <input
                type="text"
                value={seed}
                onChange={(e) => {
                  setSeed(e.target.value);
                  handleConfigChange(durationMin, roundsCount, maxLeverage, e.target.value, candleDurationSec);
                }}
                placeholder="e.g. BTC_VOLATILITY"
                className="input-base"
                style={{ width: '100%', fontSize: '12px' }}
              />
            </div>
          </div>

          <button
            onClick={onStartGame}
            disabled={players.length === 0}
            className="btn-base btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
          >
            START GAME
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Game Rules (Host Configured)
          </h4>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', margin: '10px 0', fontSize: '12px' }}>
            <span>Round Duration: <strong style={{ color: 'var(--accent)' }}>{durationMin}m</strong></span>
            <span>Rounds: <strong style={{ color: 'var(--accent)' }}>{roundsCount}</strong></span>
            <span>Candle Pace: <strong style={{ color: 'var(--accent)' }}>{candleDurationSec}s</strong></span>
            <span>Max Lev: <strong style={{ color: 'var(--accent)' }}>{maxLeverage}x</strong></span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Waiting for host to launch the arena...
          </p>
        </div>
      )}
    </div>
  );
}
