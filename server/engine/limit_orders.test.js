import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingEngine } from './engine.js';
import { SIDES } from './types.js';

test('Limit Orders: placing reserves margin and fee from cash balance', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer({ id: 'p1', nickname: 'Alice' });
  engine.initRound(0, [{ open: 40000, high: 40500, low: 39500, close: 40000 }], 60);

  // Place a Limit Order to Buy Long @ $39,000 with $1,000 margin at 5x leverage
  const order = engine.placeLimitOrder('p1', SIDES.LONG, 39000, 1000, null, 5);

  assert.ok(order, 'Order should be created');
  assert.equal(order.status, 'PENDING');
  assert.equal(order.limitPrice, 39000);
  assert.equal(order.leverage, 5);

  // Notional = 1000 * 5 = 5000. Fee = 5000 * 0.0005 = 2.50. Reserved = 1002.50
  assert.equal(order.margin, 1000);
  assert.equal(order.reservedMargin, 1002.5);

  // Cash balance should be deducted
  assert.equal(player.balance, 10000 - 1002.5);

  // Equity must still include the reserved margin ($10,000)
  assert.equal(engine.getPlayerEquity(player, 40000), 10000);
});

test('Limit Orders: cancellation refunds reserved margin to cash', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer({ id: 'p1', nickname: 'Alice' });
  engine.initRound(0, [{ open: 40000, high: 40500, low: 39500, close: 40000 }], 60);

  const order = engine.placeLimitOrder('p1', SIDES.LONG, 39000, 2000, null, 10);
  assert.equal(player.limitOrders.length, 1);
  assert.ok(player.balance < 10000);

  const cancelled = engine.cancelLimitOrder('p1', order.id);
  assert.equal(cancelled, true);
  assert.equal(player.limitOrders.length, 0);
  assert.equal(player.balance, 10000);
});

test('Limit Orders: Buy Long limit order triggers when market price drops to or below target', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer({ id: 'p1', nickname: 'Alice' });
  const candles = [
    { open: 40000, high: 40100, low: 39900, close: 40000 },
    { open: 40000, high: 40050, low: 38800, close: 38900 }, // drops to 38800, crosses 39000
    { open: 38900, high: 41000, low: 38900, close: 41000 }
  ];
  engine.initRound(0, candles, 60);

  // Place Limit Buy Long @ 39,000
  engine.placeLimitOrder('p1', SIDES.LONG, 39000, 1000, null, 5);

  // Step 1: price stays at 40000 -> does not trigger
  engine.stepTick();
  assert.equal(player.limitOrders.length, 1);
  assert.equal(player.positions.length, 0);

  // Step 2: candle drops to 38800 -> triggers and fills!
  engine.stepTick();
  assert.equal(player.limitOrders.length, 0);
  assert.equal(player.positions.length, 1);

  const pos = player.positions[0];
  assert.equal(pos.side, SIDES.LONG);
  assert.equal(pos.entryPrice, 38900); // filled at min(limitPrice, currentPrice)
  assert.equal(pos.leverage, 5);
  assert.equal(pos.margin, 1000);
});

test('Limit Orders: Buy Short limit order triggers when market price pumps to or above target', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer({ id: 'p1', nickname: 'Bob' });
  const candles = [
    { open: 40000, high: 40100, low: 39900, close: 40000 },
    { open: 40000, high: 42500, low: 39950, close: 42200 }, // pumps to 42500, crosses 42000
  ];
  engine.initRound(0, candles, 60);

  // Place Limit Buy Short @ 42,000
  engine.placeLimitOrder('p1', SIDES.SHORT, 42000, 1500, null, 10);

  // Step 1: price is 40000 -> does not trigger
  engine.stepTick();
  assert.equal(player.limitOrders.length, 1);
  assert.equal(player.positions.length, 0);

  // Step 2: candle pumps to 42500 -> triggers and fills short!
  engine.stepTick();
  assert.equal(player.limitOrders.length, 0);
  assert.equal(player.positions.length, 1);

  const pos = player.positions[0];
  assert.equal(pos.side, SIDES.SHORT);
  assert.equal(pos.entryPrice, 42200);
  assert.equal(pos.leverage, 10);
});

test('Limit Orders: attaches TP and SL, preserves them in serialized state, and triggers auto-exit on fill', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer({ id: 'p1', nickname: 'Alice' });
  const candles = [
    { open: 40000, high: 40100, low: 39900, close: 40000 },
    { open: 40000, high: 40050, low: 38800, close: 38900 }, // drops to 38800, triggers limit buy @ 39000
    { open: 38900, high: 43000, low: 38800, close: 42000 }  // pumps to 42000 (+8% spot * 5x = +40% pnl, triggers TP 15%)
  ];
  engine.initRound(0, candles, 60);

  // Place Limit Buy Long @ 39,000 with SL 5% and TP 15%
  const order = engine.placeLimitOrder('p1', SIDES.LONG, 39000, 1000, null, 5, 5, 15);
  assert.equal(order.stopLossPct, 5);
  assert.equal(order.takeProfitPct, 15);

  // Tick 1: order is still pending. Verify serialization in leaderboard
  const tick1 = engine.stepTick();
  const aliceT1 = tick1.leaderboard.find(p => p.id === 'p1');
  assert.equal(aliceT1.limitOrders.length, 1);
  assert.equal(aliceT1.limitOrders[0].stopLossPct, 5);
  assert.equal(aliceT1.limitOrders[0].takeProfitPct, 15);

  // Tick 2: order fills into position. Verify position retains TP & SL in engine & leaderboard
  const tick2 = engine.stepTick();
  const aliceT2 = tick2.leaderboard.find(p => p.id === 'p1');
  assert.equal(aliceT2.limitOrders.length, 0);
  assert.equal(aliceT2.positions.length, 1);
  assert.equal(aliceT2.positions[0].stopLossPct, 5);
  assert.equal(aliceT2.positions[0].takeProfitPct, 15);

  // Tick 3: price pumps to 42000, hitting +15% TP -> position should be auto-closed with profit!
  const tick3 = engine.stepTick();
  const aliceT3 = tick3.leaderboard.find(p => p.id === 'p1');
  assert.equal(aliceT3.positions.length, 0);
  assert.ok(aliceT3.balance > 10000, 'Balance should reflect profit after TP auto-close');
});

test('Positions & Limit Orders: updatePositionTpSl and updateLimitOrderTpSl dynamically', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer({ id: 'p_dyn', nickname: 'Dyno' });
  engine.initRound(0, [{ open: 40000, high: 40500, low: 39500, close: 40000 }], 60);

  // 1. Test updating pending limit order TP/SL
  const ord = engine.placeLimitOrder('p_dyn', SIDES.LONG, 39000, 1000, null, 5);
  assert.equal(ord.takeProfitPct, null);
  assert.equal(ord.stopLossPct, null);

  const ordUpdated = engine.updateLimitOrderTpSl('p_dyn', ord.id, 4, 12);
  assert.equal(ordUpdated, true);
  assert.equal(ord.stopLossPct, 4);
  assert.equal(ord.takeProfitPct, 12);

  // 2. Test updating active position TP/SL
  const pos = engine.openPosition('p_dyn', SIDES.LONG, 20, 5, 'manual', 1000);
  assert.equal(pos.takeProfitPct, null);
  assert.equal(pos.stopLossPct, null);

  const posUpdated = engine.updatePositionTpSl('p_dyn', pos.id, 6, 18);
  assert.equal(posUpdated, true);
  assert.equal(pos.stopLossPct, 6);
  assert.equal(pos.takeProfitPct, 18);

  // Can clear them
  engine.updatePositionTpSl('p_dyn', pos.id, null, null);
  assert.equal(pos.stopLossPct, null);
  assert.equal(pos.takeProfitPct, null);
});
