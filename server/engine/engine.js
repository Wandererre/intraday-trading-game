import { SIDES, ORDER_TYPES } from './types.js';
import { evaluateCondition } from './rules.js';
import { evaluateStrategy } from './strategy-interpreter.js';

export class TradingEngine {
  constructor(options = {}) {
    this.feeRate = options.feeRate ?? 0.0005; // 0.05%
    this.maxLeverage = options.maxLeverage ?? 20;
    this.startingBalance = options.startingBalance ?? 10000;
    this.equityRecordInterval = options.equityRecordInterval ?? 1;
    this.players = new Map();
    this.priceHistory = [];
    this.feed = [];
    this.currentTick = 0;
    this.gameTimeSec = 0;
    this.roundIndex = 0;
    this.totalRoundTicks = 0;
    this.candles = [];
  }

  addPlayer(playerOrId, maybeNickname) {
    const player = typeof playerOrId === 'string'
      ? { id: playerOrId, nickname: maybeNickname || playerOrId }
      : playerOrId;

    const pObj = {
      ...player,
      balance: this.startingBalance,
      positions: [], // Multiple open positions supported
      limitOrders: [], // Open limit orders
      isLiquidated: false,
      bankDebt: 0,
      losingTradesCount: 0,
      roundBalances: [],
      rules: player.rules ? [...player.rules] : [],
      strategy: player.strategy || null,
      strategyEnabled: player.strategyEnabled !== false,
      strategyError: null,
      strategyMemory: { variables: {}, firedOnce: {}, prevValues: {} },
      equityHistory: player.equityHistory ? [...player.equityHistory] : [],
      stats: {
        totalTrades: 0,
        profitableTrades: 0,
        losingTrades: 0,
        bestTradePnL: 0,
        worstTradePnL: 0,
        maxLeverageUsed: 1,
        manualPnL: 0,
        rulePnL: 0,
        totalInterestPaid: 0,
        ...(player.stats || {})
      },
      get position() {
        return this.positions && this.positions.length > 0 ? this.positions[0] : null;
      },
      set position(val) {
        if (!val) {
          this.positions = [];
        } else if (Array.isArray(val)) {
          this.positions = val;
        } else {
          this.positions = [val];
        }
      }
    };
    this.players.set(player.id, pObj);
    return pObj;
  }

  initRound(roundIndex, candles, totalRoundTicks) {
    this.roundIndex = roundIndex;
    this.candles = candles;
    this.totalRoundTicks = totalRoundTicks;
    this.currentTick = 0;
    this.priceHistory = [];

    // Fresh set of money each round for every player
    for (const player of this.players.values()) {
      player.balance = this.startingBalance;
      player.positions = [];
      player.limitOrders = [];
      player.isLiquidated = false;
      player.bankDebt = 0;
      player.strategyMemory = { variables: {}, firedOnce: {}, prevValues: {} };
      player.strategyError = null;
      for (const r of player.rules) {
        r.lastTriggeredTick = -999;
      }
    }

    if (candles.length > 0) {
      this.priceHistory.push(candles[0].open || candles[0].close);
      this.recordEquitySnapshot('round_start');
    }
  }

  getCurrentPrice() {
    if (this.priceHistory.length === 0) return 0;
    return this.priceHistory[this.priceHistory.length - 1];
  }

  calculatePositionPnL(pos, currentPrice) {
    if (!pos) return 0;
    const { side, size, entryPrice } = pos;
    if (side === SIDES.LONG) {
      return size * (currentPrice - entryPrice);
    } else {
      return size * (entryPrice - currentPrice);
    }
  }

  calculateTotalUnrealizedPnL(positions, currentPrice) {
    if (!positions || positions.length === 0) return 0;
    return positions.reduce((sum, pos) => sum + this.calculatePositionPnL(pos, currentPrice), 0);
  }

  calculateUnrealizedPnL(posOrPositions, currentPrice = this.getCurrentPrice()) {
    if (Array.isArray(posOrPositions)) {
      return this.calculateTotalUnrealizedPnL(posOrPositions, currentPrice);
    }
    return this.calculatePositionPnL(posOrPositions, currentPrice);
  }

  getBankInterestRatePerSec(player) {
    const base = 0.001;
    const lossMultiplier = player.losingTradesCount || 0;
    return base * (1 + lossMultiplier * 1.5);
  }

  getPlayerEquity(player, currentPrice = this.getCurrentPrice()) {
    let equity = player.balance - (player.bankDebt || 0);
    if (player.limitOrders) {
      for (const ord of player.limitOrders) {
        equity += ord.reservedMargin || ord.margin;
      }
    }
    if (!player.isLiquidated && player.positions) {
      for (const pos of player.positions) {
        const uPnL = this.calculatePositionPnL(pos, currentPrice);
        equity += pos.margin + uPnL;
      }
    }
    return Math.max(0, equity);
  }

  borrowFromBank(playerId, amount) {
    const player = this.players.get(playerId);
    if (!player || player.isLiquidated) return null;
    const amt = Math.max(500, Math.min(10000, Number(amount) || 1000));

    player.balance += amt;
    player.bankDebt = (player.bankDebt || 0) + amt;

    const ratePct = (this.getBankInterestRatePerSec(player) * 100).toFixed(2);
    const event = {
      id: `bank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'BANK_LOAN',
      playerId,
      nickname: player.nickname,
      amount: amt,
      ratePct,
      losses: player.losingTradesCount,
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();
    this.recordEquitySnapshot('bank_loan');
    return { balance: player.balance, bankDebt: player.bankDebt };
  }

  repayBankLoan(playerId, amount) {
    const player = this.players.get(playerId);
    if (!player || (player.bankDebt || 0) <= 0) return null;

    const maxRepay = Math.min(player.balance, player.bankDebt);
    const repayAmt = amount ? Math.min(maxRepay, Number(amount)) : maxRepay;
    if (repayAmt <= 0) return null;

    player.balance -= repayAmt;
    player.bankDebt -= repayAmt;

    const event = {
      id: `repay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'BANK_REPAY',
      playerId,
      nickname: player.nickname,
      amount: Math.round(repayAmt),
      remainingDebt: Math.round(player.bankDebt),
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();
    return { balance: player.balance, bankDebt: player.bankDebt };
  }

  recordEquitySnapshot(eventType = 'tick') {
    const price = this.getCurrentPrice();
    for (const player of this.players.values()) {
      const uPnL = this.calculateTotalUnrealizedPnL(player.positions, price);
      const equity = this.getPlayerEquity(player, price);

      const prevTotal = (player.roundBalances || []).reduce((a, b) => a + b, 0);
      const totalScore = prevTotal + equity;

      // Cumulative delta from completed previous rounds (does not reset round to round)
      let prevRoundsDelta = 0;
      if (player.roundBalances) {
        for (let r = 0; r < this.roundIndex; r++) {
          if (player.roundBalances[r] !== undefined) {
            prevRoundsDelta += (player.roundBalances[r] - this.startingBalance);
          }
        }
      }
      const currentRoundDelta = equity - this.startingBalance;
      const cumulativeDelta = prevRoundsDelta + currentRoundDelta;
      const cumulativeEquity = this.startingBalance + cumulativeDelta;

      player.equityHistory.push({
        roundIndex: this.roundIndex,
        tickIndex: this.currentTick,
        gameTimeSec: this.gameTimeSec,
        equity: Math.round(cumulativeEquity * 100) / 100,
        roundEquity: Math.round(equity * 100) / 100,
        cumulativeDelta: Math.round(cumulativeDelta * 100) / 100,
        balance: Math.round(player.balance * 100) / 100,
        bankDebt: Math.round((player.bankDebt || 0) * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
        unrealizedPnL: Math.round(uPnL * 100) / 100,
        price,
        event: eventType
      });
    }
  }

  openPosition(playerId, side, sizePct, leverage, source = 'manual', amount = null, stopLossPct = null, takeProfitPct = null) {
    const player = this.players.get(playerId);
    if (!player || player.isLiquidated) return null;

    const currentPrice = this.getCurrentPrice();
    if (currentPrice <= 0) return null;

    player.positions = player.positions || [];
    if (player.positions.length >= 8) {
      return null; // Max 8 concurrent positions
    }

    const lev = Math.min(this.maxLeverage, Math.max(1, leverage || 1));
    const pct = Math.min(100, Math.max(1, sizePct || 10));

    const maxAvailable = player.balance;
    if (maxAvailable <= 5) return null;

    let targetMargin = 0;
    let fee = 0;
    let notional = 0;

    const parsedAmount = (amount !== null && amount !== undefined) ? Number(amount) : null;

    if (parsedAmount && parsedAmount > 0) {
      targetMargin = Math.min(maxAvailable / (1 + lev * this.feeRate), parsedAmount);
      notional = targetMargin * lev;
      fee = notional * this.feeRate;
    } else if (pct >= 100) {
      targetMargin = maxAvailable / (1 + lev * this.feeRate);
      notional = targetMargin * lev;
      fee = notional * this.feeRate;
    } else {
      targetMargin = maxAvailable * (pct / 100);
      notional = targetMargin * lev;
      fee = notional * this.feeRate;
      if (targetMargin + fee > maxAvailable) {
        targetMargin = maxAvailable / (1 + lev * this.feeRate);
        notional = targetMargin * lev;
        fee = notional * this.feeRate;
      }
    }
    if (targetMargin < 5) return null;

    const actualMargin = targetMargin;
    const size = notional / currentPrice;

    player.balance = Math.max(0, player.balance - actualMargin - fee);
    if (player.balance < 0.01) player.balance = 0;

    const liqPrice = side === SIDES.LONG
      ? currentPrice * (1 - (1 / lev))
      : currentPrice * (1 + (1 / lev));

    const newPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      side,
      size,
      entryPrice: currentPrice,
      leverage: lev,
      margin: actualMargin,
      liquidationPrice: Math.round(liqPrice * 100) / 100,
      stopLossPct: stopLossPct ? Math.abs(Number(stopLossPct)) : null,
      takeProfitPct: takeProfitPct ? Math.abs(Number(takeProfitPct)) : null,
      openTick: this.currentTick,
      source
    };

    player.positions.push(newPosition);

    player.stats.totalTrades += 1;
    player.stats.maxLeverageUsed = Math.max(player.stats.maxLeverageUsed, lev);

    const event = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'OPEN',
      playerId,
      nickname: player.nickname,
      positionId: newPosition.id,
      side,
      sizePct: pct,
      leverage: lev,
      price: currentPrice,
      margin: Math.round(actualMargin),
      source,
      isBot: source === 'rule' || source === 'bot',
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();

    this.recordEquitySnapshot('trade');
    return newPosition;
  }

  placeLimitOrder(playerId, side, limitPrice, amount = null, sizePct = 25, leverage = 1, stopLossPct = null, takeProfitPct = null) {
    const player = this.players.get(playerId);
    if (!player || player.isLiquidated) return null;

    player.limitOrders = player.limitOrders || [];
    if (player.limitOrders.length >= 10) return null;

    const price = Number(limitPrice);
    if (!price || price <= 0) return null;

    const lev = Math.min(this.maxLeverage, Math.max(1, leverage || 1));
    const maxAvailable = player.balance;
    if (maxAvailable <= 5) return null;

    let targetMargin = 0;
    const parsedAmount = (amount !== null && amount !== undefined) ? Number(amount) : null;
    const pct = Math.min(100, Math.max(1, sizePct || 25));

    if (parsedAmount && parsedAmount > 0) {
      targetMargin = Math.min(maxAvailable / (1 + lev * this.feeRate), parsedAmount);
    } else {
      targetMargin = (maxAvailable * (pct / 100)) / (1 + lev * this.feeRate);
    }
    if (targetMargin < 5) return null;

    const notional = targetMargin * lev;
    const estFee = notional * this.feeRate;
    const reservedMargin = targetMargin + estFee;

    if (reservedMargin > player.balance) return null;

    player.balance = Math.max(0, player.balance - reservedMargin);

    const order = {
      id: `lmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      playerId,
      nickname: player.nickname,
      side: side === SIDES.SHORT ? SIDES.SHORT : SIDES.LONG,
      limitPrice: Math.round(price * 100) / 100,
      margin: Math.round(targetMargin * 100) / 100,
      reservedMargin: Math.round(reservedMargin * 100) / 100,
      leverage: lev,
      notional: Math.round(notional * 100) / 100,
      stopLossPct: stopLossPct ? Math.abs(Number(stopLossPct)) : null,
      takeProfitPct: takeProfitPct ? Math.abs(Number(takeProfitPct)) : null,
      status: 'PENDING',
      createdAtTick: this.currentTick,
      createdAtPrice: this.getCurrentPrice()
    };

    player.limitOrders.push(order);

    const event = {
      id: `event_${order.id}`,
      type: 'LIMIT_PLACED',
      playerId,
      nickname: player.nickname,
      side: order.side,
      limitPrice: order.limitPrice,
      margin: Math.round(targetMargin),
      leverage: lev,
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();

    return order;
  }

  cancelLimitOrder(playerId, orderId) {
    const player = this.players.get(playerId);
    if (!player || !player.limitOrders) return false;

    const idx = player.limitOrders.findIndex(o => o.id === orderId);
    if (idx === -1) return false;

    const order = player.limitOrders[idx];
    player.limitOrders.splice(idx, 1);

    // Refund reserved margin
    player.balance += order.reservedMargin;

    const event = {
      id: `cancel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'LIMIT_CANCELLED',
      playerId,
      nickname: player.nickname,
      side: order.side,
      limitPrice: order.limitPrice,
      refunded: Math.round(order.reservedMargin),
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();

    return true;
  }

  fillLimitOrder(player, order, fillPrice) {
    player.positions = player.positions || [];
    if (player.positions.length >= 8) {
      // Position cap hit, refund reserved margin
      player.balance += order.reservedMargin;
      return null;
    }

    const lev = order.leverage;
    const notional = order.margin * lev;
    const actualFee = notional * this.feeRate;
    const excessRefund = Math.max(0, order.reservedMargin - (order.margin + actualFee));
    if (excessRefund > 0) {
      player.balance += excessRefund;
    }

    const size = notional / fillPrice;
    const liqPrice = order.side === SIDES.LONG
      ? fillPrice * (1 - (1 / lev))
      : fillPrice * (1 + (1 / lev));

    const newPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      side: order.side,
      size,
      entryPrice: fillPrice,
      leverage: lev,
      margin: order.margin,
      liquidationPrice: Math.round(liqPrice * 100) / 100,
      stopLossPct: order.stopLossPct || null,
      takeProfitPct: order.takeProfitPct || null,
      openTick: this.currentTick,
      source: 'limit_order'
    };

    player.positions.push(newPosition);

    const event = {
      id: `fill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'LIMIT_FILL',
      playerId: player.id,
      nickname: player.nickname,
      side: order.side,
      leverage: lev,
      price: fillPrice,
      margin: Math.round(order.margin),
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();

    return newPosition;
  }

  closePosition(playerId, positionId = null, source = 'manual') {
    const player = this.players.get(playerId);
    if (!player || !player.positions || player.positions.length === 0) return null;

    // Handle backwards compatibility if called as closePosition(playerId, 'manual')
    if (typeof positionId === 'string' && ['manual', 'rule', 'stop_loss', 'take_profit'].includes(positionId)) {
      source = positionId;
      positionId = null;
    }

    // Find specific position or close the oldest/most recent
    let targetIndex = -1;
    if (positionId) {
      targetIndex = player.positions.findIndex(p => p.id === positionId);
    } else {
      targetIndex = player.positions.length - 1;
    }

    if (targetIndex === -1) return null;

    const pos = player.positions[targetIndex];
    const currentPrice = this.getCurrentPrice();
    const uPnL = this.calculatePositionPnL(pos, currentPrice);
    const exitFee = pos.size * currentPrice * this.feeRate;

    const returnedCash = Math.max(0, pos.margin + uPnL - exitFee);
    player.balance = Math.round((player.balance + returnedCash) * 100) / 100;

    const pnlPct = (uPnL / pos.margin) * 100;

    if (uPnL < 0) {
      player.losingTradesCount = (player.losingTradesCount || 0) + 1;
      player.stats.losingTrades = (player.stats.losingTrades || 0) + 1;
    } else {
      player.stats.profitableTrades += 1;
    }

    player.stats.bestTradePnL = Math.max(player.stats.bestTradePnL, uPnL);
    player.stats.worstTradePnL = Math.min(player.stats.worstTradePnL, uPnL);
    if (pos.source === 'rule' || pos.source === 'bot') {
      player.stats.rulePnL += uPnL;
    } else {
      player.stats.manualPnL += uPnL;
    }

    const event = {
      id: `close_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'CLOSE',
      playerId,
      nickname: player.nickname,
      positionId: pos.id,
      side: pos.side,
      leverage: pos.leverage,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      pnl: Math.round(uPnL * 100) / 100,
      pnlPct: Math.round(pnlPct * 10) / 10,
      source,
      isBot: source === 'rule' || source === 'bot' || pos.source === 'rule' || pos.source === 'bot',
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();

    // Remove from array
    player.positions.splice(targetIndex, 1);

    this.recordEquitySnapshot('trade');
    return event;
  }

  closeAllPositions(playerId, source = 'manual') {
    const player = this.players.get(playerId);
    if (!player || !player.positions || player.positions.length === 0) return [];
    const closedEvents = [];
    while (player.positions.length > 0) {
      const ev = this.closePosition(playerId, player.positions[0].id, source);
      if (ev) closedEvents.push(ev);
    }
    return closedEvents;
  }

  updatePositionTpSl(playerId, positionId, stopLossPct = null, takeProfitPct = null) {
    const player = this.players.get(playerId);
    if (!player || !player.positions) return false;
    const pos = player.positions.find(p => p.id === positionId);
    if (!pos) return false;
    pos.stopLossPct = (stopLossPct !== null && stopLossPct !== undefined && !isNaN(Number(stopLossPct)) && Number(stopLossPct) > 0)
      ? Math.abs(Number(stopLossPct))
      : null;
    pos.takeProfitPct = (takeProfitPct !== null && takeProfitPct !== undefined && !isNaN(Number(takeProfitPct)) && Number(takeProfitPct) > 0)
      ? Math.abs(Number(takeProfitPct))
      : null;
    return true;
  }

  updateLimitOrderTpSl(playerId, orderId, stopLossPct = null, takeProfitPct = null) {
    const player = this.players.get(playerId);
    if (!player || !player.limitOrders) return false;
    const ord = player.limitOrders.find(o => o.id === orderId);
    if (!ord) return false;
    ord.stopLossPct = (stopLossPct !== null && stopLossPct !== undefined && !isNaN(Number(stopLossPct)) && Number(stopLossPct) > 0)
      ? Math.abs(Number(stopLossPct))
      : null;
    ord.takeProfitPct = (takeProfitPct !== null && takeProfitPct !== undefined && !isNaN(Number(takeProfitPct)) && Number(takeProfitPct) > 0)
      ? Math.abs(Number(takeProfitPct))
      : null;
    return true;
  }

  liquidatePosition(player, posIndex, currentPrice) {
    const pos = player.positions[posIndex];
    if (!pos) return;
    const lostMargin = pos.margin;

    player.positions.splice(posIndex, 1);
    player.losingTradesCount = (player.losingTradesCount || 0) + 1;
    player.stats.losingTrades = (player.stats.losingTrades || 0) + 1;
    player.stats.worstTradePnL = Math.min(player.stats.worstTradePnL, -lostMargin);

    if (pos.source === 'rule') {
      player.stats.rulePnL -= lostMargin;
    } else {
      player.stats.manualPnL -= lostMargin;
    }

    const event = {
      id: `liq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'LIQUIDATION',
      playerId: player.id,
      nickname: player.nickname,
      side: pos.side,
      leverage: pos.leverage,
      loss: Math.round(lostMargin * 100) / 100,
      price: currentPrice,
      tick: this.currentTick
    };
    this.feed.unshift(event);
    if (this.feed.length > 50) this.feed.pop();

    // If all positions wiped and balance <= 5 (dust), player is out for the round
    const equity = this.getPlayerEquity(player, currentPrice);
    if (equity <= 5 && player.positions.length === 0) {
      player.isLiquidated = true;
      player.balance = 0;
    }

    this.recordEquitySnapshot('liquidation');
  }

  stepTick(intents = []) {
    if (this.currentTick >= this.candles.length) {
      return null;
    }

    const candle = this.candles[this.currentTick];
    const currentPrice = candle.close;
    this.priceHistory.push(currentPrice);
    this.currentTick += 1;
    this.gameTimeSec += 1;

    const timeLeftSec = Math.max(0, this.totalRoundTicks - this.currentTick);

    // 0. Accrue Bank debt interest every second
    for (const player of this.players.values()) {
      if ((player.bankDebt || 0) > 0) {
        const rate = this.getBankInterestRatePerSec(player);
        const interest = player.bankDebt * rate;
        player.bankDebt += interest;
        player.stats.totalInterestPaid += interest;
      }
    }

    // Check for catastrophic bankruptcies (equity <= 0)
    for (const player of this.players.values()) {
      if (player.isLiquidated) continue;
      const eq = this.getPlayerEquity(player, currentPrice);
      if (eq <= 0) {
        player.positions = [];
        player.balance = 0;
        player.isLiquidated = true;
        this.recordEquitySnapshot('liquidation');
      }
    }

    // 1. Check open positions for liquidations, stop loss, take profit
    for (const player of this.players.values()) {
      if (player.isLiquidated || !player.positions || player.positions.length === 0) continue;

      for (let i = player.positions.length - 1; i >= 0; i--) {
        const pos = player.positions[i];
        const uPnL = this.calculatePositionPnL(pos, currentPrice);

        // Check Position Liquidation
        const isPosLiquidated =
          (pos.side === SIDES.LONG && currentPrice <= pos.liquidationPrice) ||
          (pos.side === SIDES.SHORT && currentPrice >= pos.liquidationPrice);

        if (isPosLiquidated) {
          this.liquidatePosition(player, i, currentPrice);
          continue;
        }

        // Check SL / TP
        if (pos.stopLossPct) {
          const pnlPct = (uPnL / pos.margin) * 100;
          if (pnlPct <= -Math.abs(pos.stopLossPct)) {
            this.closePosition(player.id, pos.id, 'stop_loss');
            continue;
          }
        }
        if (pos.takeProfitPct) {
          const pnlPct = (uPnL / pos.margin) * 100;
          if (pnlPct >= Math.abs(pos.takeProfitPct)) {
            this.closePosition(player.id, pos.id, 'take_profit');
            continue;
          }
        }
      }
    }

    // 1b. Check pending limit orders against current tick / candle
    const candleLow = (candle && typeof candle.low === 'number') ? candle.low : currentPrice;
    const candleHigh = (candle && typeof candle.high === 'number') ? candle.high : currentPrice;

    for (const player of this.players.values()) {
      if (player.isLiquidated || !player.limitOrders || player.limitOrders.length === 0) continue;

      for (let i = player.limitOrders.length - 1; i >= 0; i--) {
        const order = player.limitOrders[i];
        let triggered = false;
        let fillPrice = order.limitPrice;

        if (order.side === SIDES.LONG) {
          // BUY LONG: fills if market dropped to or below limitPrice
          if (candleLow <= order.limitPrice) {
            triggered = true;
            fillPrice = Math.min(order.limitPrice, currentPrice);
          }
        } else if (order.side === SIDES.SHORT) {
          // BUY SHORT: fills if market rose to or above limitPrice
          if (candleHigh >= order.limitPrice) {
            triggered = true;
            fillPrice = Math.max(order.limitPrice, currentPrice);
          }
        }

        if (triggered) {
          player.limitOrders.splice(i, 1);
          this.fillLimitOrder(player, order, fillPrice);
        }
      }
    }

    // 2. Evaluate bot automation rules for active players
    for (const player of this.players.values()) {
      if (player.isLiquidated) continue;
      if (player.rulesEnabled === false && player.strategyEnabled === false) continue;

      const ctx = {
        engine: this,
        currentPrice,
        priceHistory: this.priceHistory,
        candle,
        player,
        timeLeftSec,
        maxLeverage: this.maxLeverage
      };

      // 5-Rule Automation Engine
      if (player.rulesEnabled !== false && player.rules && Array.isArray(player.rules) && player.rules.length > 0) {
        for (const rule of player.rules) {
          if (!rule || !rule.enabled) continue;

          // Enforce 10-tick cooldown (default 10)
          const cooldown = rule.cooldownTicks || 10;
          if (typeof rule.lastTriggeredTick === 'number' && (this.currentTick - rule.lastTriggeredTick) < cooldown) {
            continue;
          }

          try {
            // Evaluate condition 1
            const cond1 = rule.condition1 || rule.condition;
            const matches1 = evaluateCondition(cond1, ctx);
            let matches = matches1;
            if (rule.hasAnd && rule.condition2) {
              matches = matches1 && evaluateCondition(rule.condition2, ctx);
            }

            if (matches) {
              rule.lastTriggeredTick = this.currentTick;
              rule.error = null;
              const act = rule.action;
              if (act) {
                if (act.type === 'OPEN_LONG' || act.type === 'BUY') {
                  const sizePct = Math.min(100, Math.max(1, act.sizePct || 25));
                  const leverage = Math.min(this.maxLeverage, Math.max(1, act.leverage || 5));
                  const pos = this.openPosition(player.id, SIDES.LONG, sizePct, leverage, 'bot');
                  if (pos) {
                    if (act.stopLossPct) pos.stopLossPct = Math.abs(act.stopLossPct);
                    if (act.takeProfitPct) pos.takeProfitPct = Math.abs(act.takeProfitPct);
                  }
                } else if (act.type === 'OPEN_SHORT' || act.type === 'SELL') {
                  const sizePct = Math.min(100, Math.max(1, act.sizePct || 25));
                  const leverage = Math.min(this.maxLeverage, Math.max(1, act.leverage || 5));
                  const pos = this.openPosition(player.id, SIDES.SHORT, sizePct, leverage, 'bot');
                  if (pos) {
                    if (act.stopLossPct) pos.stopLossPct = Math.abs(act.stopLossPct);
                    if (act.takeProfitPct) pos.takeProfitPct = Math.abs(act.takeProfitPct);
                  }
                } else if (act.type === 'CLOSE_POSITION' || act.type === 'CLOSE') {
                  this.closePosition(player.id, null, 'bot');
                } else if (act.type === 'SET_STOP_LOSS') {
                  if (player.position) {
                    player.position.stopLossPct = Math.abs(act.stopLossPct || act.pct || 5);
                  }
                } else if (act.type === 'SET_TAKE_PROFIT') {
                  if (player.position) {
                    player.position.takeProfitPct = Math.abs(act.takeProfitPct || act.pct || 10);
                  }
                }
              }
            }
          } catch (err) {
            // An invalid rule is skipped with an inline error and never crashes the round or affects other players.
            rule.error = err.message || 'Rule evaluation error';
          }
        }
      }

      // Optional strategy blocks
      if (player.strategy && player.strategyEnabled) {
        try {
          evaluateStrategy(player.strategy, ctx);
        } catch (err) {
          player.strategyEnabled = false;
          player.strategyError = err.message || 'Strategy execution error';
        }
      }
    }

    // 3. Process manual player intents
    for (const intent of intents) {
      const { playerId, type, side, sizePct, leverage, positionId, amount, stopLossPct, takeProfitPct } = intent;
      if (type === ORDER_TYPES.MARKET_BUY) {
        this.openPosition(playerId, SIDES.LONG, sizePct, leverage, 'manual', amount, stopLossPct, takeProfitPct);
      } else if (type === ORDER_TYPES.MARKET_SELL) {
        this.openPosition(playerId, SIDES.SHORT, sizePct, leverage, 'manual', amount, stopLossPct, takeProfitPct);
      } else if (type === ORDER_TYPES.CLOSE) {
        this.closePosition(playerId, positionId, 'manual');
      } else if (type === ORDER_TYPES.BANK_BORROW) {
        this.borrowFromBank(playerId, amount);
      } else if (type === ORDER_TYPES.BANK_REPAY) {
        this.repayBankLoan(playerId, amount);
      }
    }

    // 4. Record regular tick equity snapshot
    if (this.currentTick % this.equityRecordInterval === 0) {
      this.recordEquitySnapshot('tick');
    }

    // 5. Build leaderboard
    const leaderboard = Array.from(this.players.values()).map(p => {
      const equity = this.getPlayerEquity(p, currentPrice);
      const totalUPnL = this.calculateTotalUnrealizedPnL(p.positions, currentPrice);
      const prevTotal = (p.roundBalances || []).reduce((a, b) => a + b, 0);
      const totalScore = prevTotal + equity;
      const ratePct = (this.getBankInterestRatePerSec(p) * 100).toFixed(2);

      const formattedPositions = (p.positions || []).map(pos => {
        const uPnL = this.calculatePositionPnL(pos, currentPrice);
        return {
          id: pos.id,
          side: pos.side,
          leverage: pos.leverage,
          size: Math.round(pos.size * 1000) / 1000,
          entryPrice: pos.entryPrice,
          margin: Math.round(pos.margin * 100) / 100,
          liquidationPrice: pos.liquidationPrice,
          pnl: Math.round(uPnL * 100) / 100,
          pnlPct: Math.round((uPnL / pos.margin) * 1000) / 10,
          stopLossPct: pos.stopLossPct || null,
          takeProfitPct: pos.takeProfitPct || null
        };
      });

      const formattedLimitOrders = (p.limitOrders || []).map(o => ({
        id: o.id,
        side: o.side,
        limitPrice: o.limitPrice,
        margin: Math.round(o.margin * 100) / 100,
        reservedMargin: Math.round(o.reservedMargin * 100) / 100,
        leverage: o.leverage,
        notional: Math.round(o.notional * 100) / 100,
        status: o.status,
        createdAtTick: o.createdAtTick,
        stopLossPct: o.stopLossPct || null,
        takeProfitPct: o.takeProfitPct || null
      }));

      return {
        id: p.id,
        nickname: p.nickname,
        balance: Math.round(p.balance * 100) / 100,
        equity: Math.round(equity * 100) / 100,
        bankDebt: Math.round((p.bankDebt || 0) * 100) / 100,
        bankRatePct: ratePct,
        losingTrades: p.losingTradesCount || 0,
        totalScore: Math.round(totalScore * 100) / 100,
        unrealizedPnL: Math.round(totalUPnL * 100) / 100,
        positions: formattedPositions,
        limitOrders: formattedLimitOrders,
        // Legacy single position convenience accessor
        position: formattedPositions.length > 0 ? formattedPositions[0] : null,
        strategyActive: Boolean(p.strategy && p.strategyEnabled),
        strategyError: p.strategyError || null,
        isLiquidated: p.isLiquidated
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    return {
      tickIndex: this.currentTick,
      totalTicks: this.totalRoundTicks,
      timeLeftSec,
      candle,
      currentPrice,
      leaderboard,
      feed: this.feed.slice(0, 15)
    };
  }

  endRound() {
    // Close all open positions at final price and settle bank debt
    for (const player of this.players.values()) {
      if (player.positions && player.positions.length > 0) {
        this.closeAllPositions(player.id, 'round_end');
      }
      if ((player.bankDebt || 0) > 0) {
        player.balance = Math.max(0, player.balance - player.bankDebt);
        player.bankDebt = 0;
      }
    }

    this.recordEquitySnapshot('round_end');

    for (const player of this.players.values()) {
      player.roundBalances = player.roundBalances || [];
      player.roundBalances.push(player.balance);
    }

    const sorted = Array.from(this.players.values()).sort((a, b) => {
      const aTotal = a.roundBalances.reduce((x, y) => x + y, 0);
      const bTotal = b.roundBalances.reduce((x, y) => x + y, 0);
      return bTotal - aTotal;
    });

    const winner = sorted[0];
    let biggestWin = null;
    let biggestWipeout = null;

    for (const p of this.players.values()) {
      if (p.stats.bestTradePnL > (biggestWin?.pnl || 0)) {
        biggestWin = { nickname: p.nickname, pnl: p.stats.bestTradePnL };
      }
      if (p.stats.worstTradePnL < (biggestWipeout?.loss || 0)) {
        biggestWipeout = { nickname: p.nickname, loss: Math.abs(p.stats.worstTradePnL) };
      }
    }

    return {
      roundIndex: this.roundIndex,
      winner: winner ? { nickname: winner.nickname, balance: winner.balance } : null,
      biggestWin,
      biggestWipeout,
      rankings: sorted.map((p, idx) => ({
        rank: idx + 1,
        nickname: p.nickname,
        roundBalance: p.balance,
        totalScore: p.roundBalances.reduce((a, b) => a + b, 0),
        stats: p.stats
      }))
    };
  }
}
