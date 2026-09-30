import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSMA, calculateRSI, calculatePctChange } from './indicators.js';
import { parseRuleText, evaluateCondition, ruleToText } from './rules.js';
import { TradingEngine } from './engine.js';
import { createInitialPlayer, ORDER_TYPES, SIDES } from './types.js';

test('Technical Indicators: calculateSMA', () => {
  const prices = [10, 20, 30, 40, 50];
  assert.equal(calculateSMA(prices, 3), 40);
  assert.equal(calculateSMA(prices, 5), 30);
  assert.equal(calculateSMA(prices, 10), null);
});

test('Technical Indicators: calculatePctChange', () => {
  const prices = [100, 105, 110];
  assert.equal(calculatePctChange(prices, 2), 10);
});

test('Rule Parser: safely parses without eval', () => {
  const text = 'IF price > sma(20) AND position = none THEN buy 50% at 5x';
  const rule = parseRuleText(text);

  assert.equal(rule.hasAnd, true);
  assert.equal(rule.condition1.left.type, 'price');
  assert.equal(rule.condition1.operator, 'is_above');
  assert.equal(rule.condition1.right.type, 'sma');
  assert.equal(rule.condition1.right.param, 20);

  assert.equal(rule.condition2.left.type, 'position');
  assert.equal(rule.condition2.operator, 'equals');
  assert.equal(rule.condition2.right.value, 'none');

  assert.equal(rule.action.type, 'OPEN_LONG');
  assert.equal(rule.action.sizePct, 50);
  assert.equal(rule.action.leverage, 5);
});

test('Rule Parser: rejects invalid input safely without eval', () => {
  assert.throws(() => parseRuleText('malicious code alert(1)'), /must start with "IF/);
  assert.throws(() => parseRuleText('IF price > THEN buy 10%'), /Cannot parse|Empty operand/);
});

test('Rule Evaluation: evaluates conditions correctly against context', () => {
  const rule = parseRuleText('IF price > 60000 AND position = none THEN buy 25% at 10x');
  const dummyPlayer = createInitialPlayer('p1', 'Alice', 10000);

  const ctxTrue = {
    currentPrice: 65000,
    priceHistory: [60000, 62000, 65000],
    player: dummyPlayer,
    timeLeftSec: 60
  };
  assert.equal(evaluateCondition(rule.condition1, ctxTrue) && evaluateCondition(rule.condition2, ctxTrue), true);

  const ctxFalse = {
    currentPrice: 58000,
    priceHistory: [60000, 59000, 58000],
    player: dummyPlayer,
    timeLeftSec: 60
  };
  assert.equal(evaluateCondition(rule.condition1, ctxFalse) && evaluateCondition(rule.condition2, ctxFalse), false);
});

test('Trading Engine: manual Long position, leverage, fees & PnL', () => {
  const engine = new TradingEngine({ feeRate: 0.001, maxLeverage: 20 });
  const player = createInitialPlayer('p1', 'Bob', 10000);
  engine.addPlayer(player);

  const mockCandles = [
    { open: 50000, high: 50000, low: 50000, close: 50000, volume: 10 },
    { open: 50000, high: 52000, low: 50000, close: 51000, volume: 20 },
    { open: 51000, high: 53000, low: 51000, close: 52000, volume: 15 }
  ];

  engine.initRound(0, mockCandles, 3);
  assert.equal(engine.getCurrentPrice(), 50000);

  const pos = engine.openPosition('p1', SIDES.LONG, 50, 10, 'manual');
  assert.ok(pos);
  assert.equal(pos.side, SIDES.LONG);
  assert.equal(pos.leverage, 10);
  assert.equal(pos.entryPrice, 50000);
  assert.equal(pos.liquidationPrice, 45000);

  engine.stepTick([]);
  engine.stepTick([]);
  assert.equal(engine.getCurrentPrice(), 51000);

  const equityAt51k = engine.getPlayerEquity(engine.players.get('p1'));
  assert.ok(equityAt51k > 10500, `Bob equity should be > 10500, got ${equityAt51k}`);

  const closeEvent = engine.closePosition('p1', 'manual');
  assert.ok(closeEvent);
  assert.ok(closeEvent.pnl > 0);
  assert.equal(engine.players.get('p1').position, null);
});

test('Trading Engine: Short position profit & Short liquidation on pump', () => {
  const engine = new TradingEngine({ feeRate: 0.0005, maxLeverage: 20 });
  const player = createInitialPlayer('p_short', 'Shorty', 10000);
  engine.addPlayer(player);

  const mockCandles = [
    { open: 50000, high: 50000, low: 50000, close: 50000, volume: 10 },
    { open: 50000, high: 50000, low: 48000, close: 48000, volume: 20 },
    { open: 48000, high: 56000, low: 48000, close: 56000, volume: 100 }
  ];

  engine.initRound(0, mockCandles, 3);
  const pos = engine.openPosition('p_short', SIDES.SHORT, 100, 10, 'manual');
  assert.equal(pos.liquidationPrice, 55000);

  engine.stepTick([]);
  engine.stepTick([]);
  assert.ok(engine.getPlayerEquity(engine.players.get('p_short')) > 10000);

  engine.stepTick([]);
  const shorty = engine.players.get('p_short');
  assert.equal(shorty.isLiquidated, true);
  assert.equal(shorty.position, null);
});

test('Trading Engine: Liquidation and Fresh $10,000 next round', () => {
  const engine = new TradingEngine({ maxLeverage: 20, startingBalance: 10000 });
  const player = createInitialPlayer('p2', 'Charlie', 10000);
  engine.addPlayer(player);

  const mockCandles = [
    { open: 50000, high: 50000, low: 50000, close: 50000, volume: 10 },
    { open: 50000, high: 50000, low: 46000, close: 46000, volume: 100 }
  ];

  engine.initRound(0, mockCandles, 2);
  engine.openPosition('p2', SIDES.LONG, 100, 20, 'manual');

  engine.stepTick([]);
  engine.stepTick([]);
  const charlie = engine.players.get('p2');
  assert.equal(charlie.isLiquidated, true);
  assert.equal(charlie.position, null);

  // Round ends and next round starts: Charlie gets fresh $10,000
  engine.endRound();
  engine.initRound(1, [{ open: 50000, high: 50000, low: 50000, close: 50000, volume: 10 }], 1);
  assert.equal(charlie.isLiquidated, false);
  assert.equal(charlie.balance, 10000);
});

test('Trading Engine: Multiple concurrent positions and partial position liquidation', () => {
  const engine = new TradingEngine({ maxLeverage: 20, startingBalance: 10000 });
  const player = createInitialPlayer('p_multi', 'MultiTrader', 10000);
  engine.addPlayer(player);

  const mockCandles = [
    { open: 50000, high: 50000, low: 50000, close: 50000, volume: 10 },
    { open: 50000, high: 50000, low: 47000, close: 47000, volume: 50 }
  ];

  engine.initRound(0, mockCandles, 2);
  // Open 2 concurrent positions: 1 high leverage Long, 1 lower leverage Short hedge
  const pos1 = engine.openPosition('p_multi', SIDES.LONG, 30, 20, 'manual'); // liq price 47500
  const pos2 = engine.openPosition('p_multi', SIDES.SHORT, 30, 5, 'manual'); // liq price 60000

  assert.equal(engine.players.get('p_multi').positions.length, 2);

  // Price drops to 47000: Pos 1 is liquidated, but Pos 2 is in profit and player still alive
  engine.stepTick([]);
  engine.stepTick([]);

  const multi = engine.players.get('p_multi');
  assert.equal(multi.isLiquidated, false);
  assert.equal(multi.positions.length, 1);
  assert.equal(multi.positions[0].side, SIDES.SHORT);
  assert.ok(multi.balance > 0);
});

test('Trading Engine: Degenerate Bank Loan & Predatory Interest scaling', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = createInitialPlayer('p_bank', 'Degen', 10000);
  engine.addPlayer(player);

  engine.initRound(0, [{ open: 50000, close: 50000 }, { open: 50000, close: 50000 }], 5);

  const p = engine.players.get('p_bank');
  p.losingTradesCount = 2; // Simulate 2 prior losing trades

  // Take $2,500 bank loan
  const res = engine.borrowFromBank('p_bank', 2500);
  assert.equal(res.balance, 12500);
  assert.equal(res.bankDebt, 2500);

  // Interest rate should scale with losing trades: base 0.001 * (1 + 2 * 1.5) = 0.004 (0.4%/s)
  const rate = engine.getBankInterestRatePerSec(p);
  assert.equal(rate, 0.004);

  // Step tick -> interest accrues
  engine.stepTick([]);
  assert.ok(p.bankDebt > 2500, 'Bank debt should accrue interest');

  // Repay $1,000
  engine.repayBankLoan('p_bank', 1000);
  assert.ok(p.bankDebt < 2000, 'Debt should decrease after repayment');
});

test('Trading Engine: Replay Determinism and Cumulative Score Recording', () => {
  function runSimulation() {
    const p1 = createInitialPlayer('p1', 'DeterministicTrader', 10000);
    const engine = new TradingEngine({ startingBalance: 10000 });
    engine.addPlayer(p1);

    const mockCandles = [
      { open: 100, high: 105, low: 95, close: 102, volume: 1 },
      { open: 102, high: 110, low: 101, close: 108, volume: 1 },
      { open: 108, high: 115, low: 107, close: 112, volume: 1 }
    ];

    engine.initRound(0, mockCandles, 3);
    engine.stepTick([{ playerId: 'p1', type: ORDER_TYPES.MARKET_BUY, sizePct: 50, leverage: 5 }]);
    engine.stepTick([]);
    engine.stepTick([{ playerId: 'p1', type: ORDER_TYPES.CLOSE }]);
    engine.endRound();
    return engine.players.get('p1').equityHistory;
  }

  const run1 = runSimulation();
  const run2 = runSimulation();

  assert.equal(run1.length, run2.length);
  assert.deepEqual(run1, run2, 'Both simulation runs must be bit-for-bit identical');
});

test('Trading Engine: Take Profit and Stop Loss auto-execution', () => {
  const p1 = createInitialPlayer('p_tp', 'TPTrader', 10000);
  const p2 = createInitialPlayer('p_sl', 'SLTrader', 10000);
  const engine = new TradingEngine({ startingBalance: 10000 });
  engine.addPlayer(p1);
  engine.addPlayer(p2);

  // Candles: starting at 50,000, then pump to 55,000 (+10%), then dump to 45,000 (-10%)
  const mockCandles = [
    { open: 50000, high: 50000, low: 50000, close: 50000, volume: 1 },
    { open: 50000, high: 56000, low: 49000, close: 55000, volume: 1 },
    { open: 55000, high: 55000, low: 44000, close: 45000, volume: 1 }
  ];

  engine.initRound(0, mockCandles, 3);

  // Player 1 buys LONG 1x with TP 8% (at 50,000 -> +10% pump should hit TP)
  // Player 2 buys LONG 1x with SL 5% (at 55,000 -> dump to 45,000 should hit SL)
  engine.stepTick([
    { playerId: 'p_tp', type: ORDER_TYPES.MARKET_BUY, sizePct: 20, leverage: 1, amount: 2000, takeProfitPct: 8 },
    { playerId: 'p_sl', type: ORDER_TYPES.MARKET_BUY, sizePct: 20, leverage: 1, amount: 2000, stopLossPct: 5 }
  ]);

  const p1Pos = engine.players.get('p_tp').positions[0];
  assert.equal(p1Pos.takeProfitPct, 8);
  const p2Pos = engine.players.get('p_sl').positions[0];
  assert.equal(p2Pos.stopLossPct, 5);

  // Step 2: Price pumps to 55,000 (+10% gain). Player 1's position (+10% > 8%) should hit Take Profit and auto-close!
  engine.stepTick([]);
  assert.equal(engine.players.get('p_tp').positions.length, 0, 'P1 position should auto-close via Take Profit');
  assert.ok(engine.players.get('p_tp').balance > 10100, 'P1 should have locked in profit');

  // Step 3: Price dumps to 45,000. Player 2's position was still open, now it is in loss and hits Stop Loss (-5%)!
  engine.stepTick([]);
  assert.equal(engine.players.get('p_sl').positions.length, 0, 'P2 position should auto-close via Stop Loss');
  assert.ok(engine.players.get('p_sl').balance < 10000, 'P2 took limited loss from SL');
});

