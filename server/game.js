import { TradingEngine } from './engine/engine.js';
import { createInitialPlayer, ORDER_TYPES, SIDES } from './engine/types.js';
import { getRoundCandleSegment } from './data-loader.js';
import { validateRulesList } from './engine/rules.js';
import { validateStrategy, countBlocks } from './engine/strategy-interpreter.js';

export const GAME_STATES = {
  LOBBY: 'LOBBY',
  ROUND_ACTIVE: 'ROUND_ACTIVE',
  ROUND_ENDED: 'ROUND_ENDED',
  FINAL_RESULTS: 'FINAL_RESULTS'
};

export class GameManager {
  constructor(broadcastCallback) {
    this.broadcast = broadcastCallback;
    this.state = GAME_STATES.LOBBY;

    // Simplified config: 1 round duration slider (up to 15 min), 1 number of rounds slider, candle speed
    this.config = {
      roundDurationSec: 180, // 3 minutes default (1m to 15m)
      numberOfRounds: 3,     // 1 to 5 rounds
      startingBalance: 10000,
      maxLeverage: 20,
      feeRate: 0.0005,
      seed: '',
      candleDurationSec: 15, // 10s to 30s per candle (default 15s)
      tickIntervalMs: 1000   // 1000ms (1 second) per sub-tick for smooth live candle development
    };

    this.hostPlayerId = null;
    this.players = new Map();
    this.nicknameToId = new Map();
    this.clientSockets = new Map();

    this.currentRoundIndex = 0;
    this.engine = new TradingEngine({
      feeRate: this.config.feeRate,
      maxLeverage: this.config.maxLeverage,
      startingBalance: this.config.startingBalance
    });

    this.roundSegment = null;
    this.roundSummary = null;
    this.tickTimer = null;
    this.betweenRoundTimer = null;
    this.betweenRoundCountdown = 0;
    this.queuedIntents = [];
  }

  setHost(playerId) {
    this.hostPlayerId = playerId;
  }

  updateConfig(newConfig) {
    if (this.state !== GAME_STATES.LOBBY) return false;
    this.config = { ...this.config, ...newConfig };
    this.engine.feeRate = this.config.feeRate;
    this.engine.maxLeverage = this.config.maxLeverage;
    this.engine.startingBalance = this.config.startingBalance;
    this.broadcastState();
    return true;
  }

  addOrReconnectPlayer(id, nickname, ws) {
    const cleanNick = nickname.trim().slice(0, 16);
    let playerId = id;

    if (this.nicknameToId.has(cleanNick)) {
      playerId = this.nicknameToId.get(cleanNick);
    } else {
      this.nicknameToId.set(cleanNick, playerId);
      const player = createInitialPlayer(playerId, cleanNick, this.config.startingBalance);
      this.players.set(playerId, player);
      this.engine.addPlayer(player);
      if (!this.hostPlayerId) {
        this.hostPlayerId = playerId;
      }
    }

    this.clientSockets.set(playerId, ws);
    this.broadcastState();
    return playerId;
  }

  removeSocket(playerId) {
    this.clientSockets.delete(playerId);
  }

  startGame() {
    if (this.state !== GAME_STATES.LOBBY) return false;
    if (this.players.size === 0) return false;

    this.currentRoundIndex = 0;
    this.startRound(0);
    return true;
  }

  startRound(roundIndex) {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.betweenRoundTimer) clearInterval(this.betweenRoundTimer);

    this.currentRoundIndex = roundIndex;
    const duration = this.config.roundDurationSec || 180;

    // Get volatile unpredictable crypto segment with 1-second sub-ticks
    this.roundSegment = getRoundCandleSegment(
      roundIndex,
      duration,
      this.config.seed || null,
      this.config.candleDurationSec || 15
    );

    // Apply locked rules for each player
    for (const player of this.players.values()) {
      const enginePlayer = this.engine.players.get(player.id);
      if (enginePlayer) {
        enginePlayer.rules = [...player.rules];
      }
    }

    // Initialize round with fresh $10,000 for everyone
    this.engine.initRound(roundIndex, this.roundSegment.ticks, this.roundSegment.ticks.length);
    this.state = GAME_STATES.ROUND_ACTIVE;
    this.queuedIntents = [];

    // Broadcast round start with initial price
    const initialTick = this.roundSegment.ticks[0];
    this.broadcast({
      type: 'ROUND_STARTED',
      roundIndex,
      totalRounds: this.config.numberOfRounds,
      duration,
      regime: this.roundSegment.regimeName,
      initialPrice: initialTick.open,
      candle: initialTick
    });

    this.broadcastState();

    // Start accelerated sub-tick clock
    this.tickTimer = setInterval(() => {
      this.stepGameTick();
    }, this.config.tickIntervalMs);
  }

  stepGameTick() {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return;

    const intentsToProcess = [...this.queuedIntents];
    this.queuedIntents = [];

    const stepResult = this.engine.stepTick(intentsToProcess);

    if (!stepResult) {
      this.endCurrentRound();
      return;
    }

    // Broadcast tick packet
    this.broadcast({
      type: 'TICK',
      roundIndex: this.currentRoundIndex,
      tickIndex: stepResult.tickIndex,
      totalTicks: stepResult.totalTicks,
      timeLeftSec: stepResult.timeLeftSec,
      price: stepResult.currentPrice,
      candle: stepResult.candle,
      leaderboard: stepResult.leaderboard,
      feed: stepResult.feed
    });
  }

  endCurrentRound() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;

    this.roundSummary = this.engine.endRound();
    const isFinalRound = this.currentRoundIndex >= this.config.numberOfRounds - 1;

    if (isFinalRound) {
      this.state = GAME_STATES.FINAL_RESULTS;
      const allHistories = {};
      const allStats = {};

      for (const [id, p] of this.engine.players.entries()) {
        const totalScore = (p.roundBalances || []).reduce((a, b) => a + b, 0);
        allHistories[p.nickname] = p.equityHistory;
        allStats[p.nickname] = {
          ...p.stats,
          roundBalances: p.roundBalances,
          finalBalance: totalScore, // Cumulative sum of all remaining round money
          totalReturnPct: Math.round(((totalScore - (this.config.startingBalance * this.config.numberOfRounds)) / (this.config.startingBalance * this.config.numberOfRounds)) * 1000) / 10
        };
      }

      this.broadcast({
        type: 'GAME_OVER',
        roundSummary: this.roundSummary,
        revealedDate: this.roundSegment.dateLabel,
        allHistories,
        allStats,
        roundDurations: Array(this.config.numberOfRounds).fill(this.config.roundDurationSec)
      });
      this.broadcastState();
    } else {
      this.state = GAME_STATES.ROUND_ENDED;
      this.betweenRoundCountdown = 20;

      this.broadcast({
        type: 'ROUND_FINISHED',
        roundIndex: this.currentRoundIndex,
        roundSummary: this.roundSummary,
        revealedDate: this.roundSegment.dateLabel,
        countdown: this.betweenRoundCountdown
      });
      this.broadcastState();

      this.betweenRoundTimer = setInterval(() => {
        this.betweenRoundCountdown -= 1;
        this.broadcast({
          type: 'COUNTDOWN_TICK',
          countdown: this.betweenRoundCountdown
        });

        if (this.betweenRoundCountdown <= 0) {
          clearInterval(this.betweenRoundTimer);
          this.startRound(this.currentRoundIndex + 1);
        }
      }, 1000);
    }
  }

  forceNextRound() {
    if (this.state !== GAME_STATES.ROUND_ENDED) return false;
    if (this.betweenRoundTimer) clearInterval(this.betweenRoundTimer);
    this.startRound(this.currentRoundIndex + 1);
    return true;
  }

  restartGame() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.betweenRoundTimer) clearInterval(this.betweenRoundTimer);

    this.currentRoundIndex = 0;
    this.roundSummary = null;
    this.roundSegment = null;
    this.state = GAME_STATES.LOBBY;
    this.betweenRoundCountdown = 0;
    this.queuedIntents = [];

    // Reset engine
    this.engine = new TradingEngine({
      feeRate: this.config.feeRate,
      maxLeverage: this.config.maxLeverage,
      startingBalance: this.config.startingBalance
    });

    // Reset each player for a fresh new match while preserving connection & rules
    for (const player of this.players.values()) {
      player.balance = this.config.startingBalance;
      player.positions = [];
      player.isLiquidated = false;
      player.bankDebt = 0;
      player.losingTradesCount = 0;
      player.roundBalances = [];
      player.equityHistory = [];
      player.stats = {
        totalTrades: 0,
        profitableTrades: 0,
        losingTrades: 0,
        bestTradePnL: 0,
        worstTradePnL: 0,
        maxLeverageUsed: 1,
        manualPnL: 0,
        rulePnL: 0,
        totalInterestPaid: 0
      };
      this.engine.addPlayer(player);
    }

    this.broadcast({
      type: 'GAME_RESTARTED',
      message: 'Host restarted the game. Ready in lobby.'
    });
    this.broadcastState();
    return true;
  }

  endGame() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.betweenRoundTimer) clearInterval(this.betweenRoundTimer);

    if (this.state === GAME_STATES.ROUND_ACTIVE) {
      this.roundSummary = this.engine.endRound();
    }

    this.state = GAME_STATES.FINAL_RESULTS;
    const allHistories = {};
    const allStats = {};

    for (const [id, p] of this.engine.players.entries()) {
      const totalScore = (p.roundBalances || []).reduce((a, b) => a + b, 0);
      allHistories[p.nickname] = p.equityHistory;
      allStats[p.nickname] = {
        ...p.stats,
        roundBalances: p.roundBalances,
        finalBalance: totalScore,
        totalReturnPct: Math.round(((totalScore - (this.config.startingBalance * Math.max(1, this.currentRoundIndex + 1))) / (this.config.startingBalance * Math.max(1, this.currentRoundIndex + 1))) * 1000) / 10
      };
    }

    this.broadcast({
      type: 'GAME_OVER',
      roundSummary: this.roundSummary,
      revealedDate: this.roundSegment ? this.roundSegment.dateLabel : 'Match Ended by Host',
      allHistories,
      allStats,
      roundDurations: Array(this.currentRoundIndex + 1).fill(this.config.roundDurationSec)
    });
    this.broadcastState();
    return true;
  }

  // Instant execution for market orders: Zero lag
  queueOrder(playerId, side, sizePct, leverage) {
    return this.executeImmediateOrder(playerId, side, sizePct, leverage);
  }

  queueClose(playerId) {
    return this.executeImmediateClose(playerId);
  }

  executeImmediateOrder(playerId, side, sizePct, leverage, amount = null) {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return false;
    const pos = this.engine.openPosition(playerId, side, sizePct, leverage, 'manual', amount);
    this.broadcastState();
    return !!pos;
  }

  executeLimitOrder(playerId, data = {}) {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return null;
    const res = this.engine.placeLimitOrder(
      playerId,
      data.side,
      data.limitPrice,
      data.amount,
      data.sizePct,
      data.leverage
    );
    this.broadcastState();
    return res;
  }

  executeCancelLimitOrder(playerId, orderId) {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return false;
    const res = this.engine.cancelLimitOrder(playerId, orderId);
    this.broadcastState();
    return res;
  }

  // Instant execution for close: Zero lag
  executeImmediateClose(playerId, positionId = null) {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return false;
    const res = this.engine.closePosition(playerId, positionId, 'manual');
    this.broadcastState();
    return !!res;
  }

  // Instant Bank loan borrow
  executeImmediateBankBorrow(playerId, amount) {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return false;
    const res = this.engine.borrowFromBank(playerId, amount);
    this.broadcastState();
    return !!res;
  }

  // Instant Bank loan repay
  executeImmediateBankRepay(playerId, amount) {
    if (this.state !== GAME_STATES.ROUND_ACTIVE) return false;
    const res = this.engine.repayBankLoan(playerId, amount);
    this.broadcastState();
    return !!res;
  }

  updatePlayerRules(playerId, rulesArray) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (this.state === GAME_STATES.ROUND_ACTIVE) {
      return { success: false, error: 'Rules are locked during an active round.' };
    }

    try {
      const cleanRules = validateRulesList(rulesArray || []);
      player.rules = cleanRules;
      const enginePlayer = this.engine.players.get(playerId);
      if (enginePlayer) {
        enginePlayer.rules = [...cleanRules];
      }
      return { success: true, count: cleanRules.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  togglePlayerAutomation(playerId, enabled) {
    const player = this.players.get(playerId);
    if (!player) return false;
    const isEn = Boolean(enabled);
    player.rulesEnabled = isEn;
    player.strategyEnabled = isEn;
    const enginePlayer = this.engine.players.get(playerId);
    if (enginePlayer) {
      enginePlayer.rulesEnabled = isEn;
      enginePlayer.strategyEnabled = isEn;
    }
    this.broadcastState();
    return true;
  }

  togglePlayerStrategy(playerId, enabled) {
    return this.togglePlayerAutomation(playerId, enabled);
  }

  setPlayerStrategy(playerId, strategyJson, enabled = true) {
    const budgetCap = 20 + 5 * (this.currentRoundIndex || 0);
    try {
      const val = validateStrategy(strategyJson, budgetCap);
      const player = this.players.get(playerId);
      if (player) {
        player.strategy = strategyJson;
        player.strategyEnabled = enabled !== false;
        player.strategyError = null;
        const enginePlayer = this.engine.players.get(playerId);
        if (enginePlayer) {
          enginePlayer.strategy = strategyJson;
          enginePlayer.strategyEnabled = enabled !== false;
          enginePlayer.strategyError = null;
        }
      }
      return { success: true, blockCount: val.blockCount };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  testPlayerStrategy(playerId, strategyJson) {
    try {
      validateStrategy(strategyJson, 100);
      const testTicks = (this.roundSegment && this.roundSegment.ticks && this.roundSegment.ticks.length > 0)
        ? this.roundSegment.ticks
        : getRoundCandleSegment(0, this.config.roundDurationSec || 180, 'backtest_default', this.config.candleDurationSec || 15).ticks;

      const testEngine = new TradingEngine({
        startingBalance: 10000,
        maxLeverage: this.config.maxLeverage || 20,
        feeRate: this.config.feeRate || 0.0005
      });
      const testPlayer = testEngine.addPlayer('test_player', 'Test Bot');
      testPlayer.strategy = strategyJson;
      testPlayer.strategyEnabled = true;

      testEngine.initRound(0, testTicks, testTicks.length);
      for (let i = 0; i < testTicks.length; i++) {
        testEngine.stepTick([]);
      }

      testEngine.closeAllPositions(testPlayer.id, 'test_end');
      const finalEquity = testPlayer.balance;
      const pnl = Math.round((finalEquity - 10000) * 100) / 100;
      const returnPct = Math.round(((finalEquity - 10000) / 10000) * 1000) / 10;

      return {
        success: true,
        pnl,
        returnPct,
        tradesCount: testPlayer.stats.totalTrades,
        profitableTrades: testPlayer.stats.profitableTrades,
        losingTrades: testPlayer.stats.losingTrades,
        finalEquity: Math.round(finalEquity * 100) / 100
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  getPlayerState(playerId) {
    const enginePlayer = this.engine.players.get(playerId);
    if (!enginePlayer) return null;
    const playerRecord = this.players.get(playerId) || {};
    const currentPrice = this.engine.getCurrentPrice();
    const uPnL = this.engine.calculateUnrealizedPnL(enginePlayer.position, currentPrice);
    const equity = this.engine.getPlayerEquity(enginePlayer, currentPrice);
    const ratePct = (this.engine.getBankInterestRatePerSec(enginePlayer) * 100).toFixed(2);
    const prevTotal = (enginePlayer.roundBalances || []).reduce((a, b) => a + b, 0);

    return {
      id: playerId,
      nickname: enginePlayer.nickname,
      balance: Math.round(enginePlayer.balance * 100) / 100,
      equity: Math.round(equity * 100) / 100,
      bankDebt: Math.round((enginePlayer.bankDebt || 0) * 100) / 100,
      bankRatePct: ratePct,
      losingTrades: enginePlayer.losingTradesCount || 0,
      roundBalances: enginePlayer.roundBalances || [],
      totalCumulativeScore: Math.round((prevTotal + equity) * 100) / 100,
      isLiquidated: enginePlayer.isLiquidated,
      positions: (enginePlayer.positions || []).map(p => ({
        id: p.id,
        side: p.side,
        size: Math.round(p.size * 1000) / 1000,
        entryPrice: p.entryPrice,
        leverage: p.leverage,
        margin: Math.round(p.margin * 100) / 100,
        liquidationPrice: p.liquidationPrice,
        unrealizedPnL: Math.round(this.engine.calculatePositionPnL(p, currentPrice) * 100) / 100,
        pnlPct: Math.round((this.engine.calculatePositionPnL(p, currentPrice) / p.margin) * 1000) / 10
      })),
      position: (enginePlayer.positions && enginePlayer.positions.length > 0) ? {
        side: enginePlayer.position.side,
        size: Math.round(enginePlayer.position.size * 1000) / 1000,
        entryPrice: enginePlayer.position.entryPrice,
        leverage: enginePlayer.position.leverage,
        margin: Math.round(enginePlayer.position.margin * 100) / 100,
        liquidationPrice: enginePlayer.position.liquidationPrice,
        unrealizedPnL: Math.round(uPnL * 100) / 100,
        pnlPct: Math.round((uPnL / enginePlayer.position.margin) * 1000) / 10
      } : null,
      limitOrders: (enginePlayer.limitOrders || []).map(o => ({
        id: o.id,
        side: o.side,
        limitPrice: o.limitPrice,
        margin: Math.round(o.margin * 100) / 100,
        reservedMargin: Math.round(o.reservedMargin * 100) / 100,
        leverage: o.leverage,
        notional: Math.round(o.notional * 100) / 100,
        status: o.status,
        createdAtTick: o.createdAtTick
      })),
      rules: enginePlayer.rules || [],
      strategy: playerRecord.strategy || null,
      strategyEnabled: playerRecord.strategyEnabled !== false,
      strategyError: enginePlayer.strategyError || null,
      blockBudgetCap: 20 + 5 * (this.currentRoundIndex || 0)
    };
  }

  getPublicState() {
    const playersList = Array.from(this.players.values()).map(p => {
      const ep = this.engine.players.get(p.id) || p;
      const prevTotal = (ep.roundBalances || []).reduce((a, b) => a + b, 0);
      return {
        id: p.id,
        nickname: p.nickname,
        balance: ep.balance,
        totalScore: prevTotal + ep.balance,
        isHost: p.id === this.hostPlayerId
      };
    });

    return {
      state: this.state,
      config: this.config,
      currentRoundIndex: this.currentRoundIndex,
      totalRounds: this.config.numberOfRounds,
      hostPlayerId: this.hostPlayerId,
      players: playersList,
      roundSummary: this.roundSummary,
      revealedDate: this.roundSegment ? this.roundSegment.dateLabel : null,
      betweenRoundCountdown: this.betweenRoundCountdown
    };
  }

  broadcastState() {
    const publicState = this.getPublicState();
    for (const [playerId, ws] of this.clientSockets.entries()) {
      if (ws.readyState === 1) {
        const myState = this.getPlayerState(playerId);
        ws.send(JSON.stringify({
          type: 'GAME_STATE',
          game: publicState,
          myState
        }));
      }
    }
  }
}
