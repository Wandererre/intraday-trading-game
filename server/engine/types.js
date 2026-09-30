/**
 * Type contracts and factory functions for the trading game engine.
 */

export const ORDER_TYPES = {
  MARKET_BUY: 'MARKET_BUY',
  MARKET_SELL: 'MARKET_SELL',
  CLOSE: 'CLOSE',
  SET_SL_TP: 'SET_SL_TP',
  BANK_BORROW: 'BANK_BORROW',
  BANK_REPAY: 'BANK_REPAY'
};

export const SIDES = {
  LONG: 'LONG',
  SHORT: 'SHORT'
};

export function createInitialPlayer(id, nickname, startingBalance = 10000) {
  return {
    id,
    nickname,
    balance: startingBalance,
    positions: [], // Array of multiple concurrent open positions
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
    },
    isLiquidated: false,
    rules: [],
    equityHistory: [],
    // Bank mechanics
    bankDebt: 0,
    losingTradesCount: 0,
    // Multi-round score accumulation
    roundBalances: [],
    stats: {
      totalTrades: 0,
      profitableTrades: 0,
      losingTrades: 0,
      bestTradePnL: 0,
      worstTradePnL: 0,
      maxLeverageUsed: 1,
      manualPnL: 0,
      rulePnL: 0,
      totalInterestPaid: 0
    }
  };
}
