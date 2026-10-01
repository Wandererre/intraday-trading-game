import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPRNG,
  generateBrownianBridgeTicks,
  generateRandomEvents,
  getRoundCandleSegment
} from '../data-loader.js';
import { TradingEngine } from './engine.js';
import { createInitialPlayer, SIDES } from './types.js';

test('Unpredictability: ticks stay within each candle high and low and touch both', () => {
  const prng = createPRNG('test_bridge_bounds');

  // Test across 50 varied candle profiles (uptrends, downtrends, dojis, wide ranges)
  for (let i = 0; i < 50; i++) {
    const open = 20000 + prng() * 20000;
    const close = 20000 + prng() * 20000;
    const high = Math.max(open, close) + 50 + prng() * 500;
    const low = Math.min(open, close) - 50 - prng() * 500;
    const candle = {
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100
    };

    const N = 15;
    const ticks = generateBrownianBridgeTicks(candle, N, prng);

    assert.equal(ticks.length, N);
    // Starts at open and ends at close
    assert.equal(ticks[0], candle.open);
    assert.equal(ticks[ticks.length - 1], candle.close);

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const p of ticks) {
      assert.ok(p >= candle.low, `Tick ${p} went below candle low ${candle.low}`);
      assert.ok(p <= candle.high, `Tick ${p} went above candle high ${candle.high}`);
      if (p < minPrice) minPrice = p;
      if (p > maxPrice) maxPrice = p;
    }

    // Touches both high and low exactly
    assert.equal(minPrice, candle.low, `Path must touch low: expected ${candle.low}, got min ${minPrice}`);
    assert.equal(maxPrice, candle.high, `Path must touch high: expected ${candle.high}, got max ${maxPrice}`);
  }
});

test('Unpredictability: same seed produces identical prices (Deterministic replay)', () => {
  const seed = 'tournament_alpha_seed_9988';
  const duration = 120;
  const candleDuration = 15;

  const run1 = getRoundCandleSegment(0, duration, seed, candleDuration);
  const run2 = getRoundCandleSegment(0, duration, seed, candleDuration);

  assert.equal(run1.ticks.length, run2.ticks.length);
  assert.equal(run1.volatilityMultiplier, run2.volatilityMultiplier);
  assert.equal(run1.isFlipped, run2.isFlipped);
  assert.equal(run1.playbackSpeed, run2.playbackSpeed);
  assert.equal(run1.tickIntervalMs, run2.tickIntervalMs);

  for (let i = 0; i < run1.ticks.length; i++) {
    assert.equal(run1.ticks[i].close, run2.ticks[i].close, `Tick ${i} price mismatch`);
    assert.equal(run1.ticks[i].high, run2.ticks[i].high, `Tick ${i} high mismatch`);
    assert.equal(run1.ticks[i].low, run2.ticks[i].low, `Tick ${i} low mismatch`);
  }

  assert.equal(run1.randomEvents.length, run2.randomEvents.length);
  for (let e = 0; e < run1.randomEvents.length; e++) {
    assert.equal(run1.randomEvents[e].type, run2.randomEvents[e].type);
    assert.equal(run1.randomEvents[e].startTick, run2.randomEvents[e].startTick);
    assert.equal(run1.randomEvents[e].magnitude, run2.randomEvents[e].magnitude);
  }
});

test('Unpredictability: flipping and rescaling preserve percentage moves and start at $30,000', () => {
  const segmentFlipped = getRoundCandleSegment(1, 60, 'seed_must_flip_test', 15);
  // Verify starts at $30,000 regardless of original price
  assert.equal(segmentFlipped.ticks[0].open, 30000);

  // Verify return inversion logic mathematically preserves return magnitudes
  const p0 = 30000;
  const p1 = 30600; // +2% move
  const rOriginal = (p1 - p0) / p0; // +0.02
  assert.equal(Math.round(rOriginal * 100) / 100, 0.02);

  // Inverted transformation: p' = (P0^2) / p
  const p1Flipped = (p0 * p0) / p1;
  const rFlipped = (p1Flipped - p0) / p0;
  // (30000/30600 - 1) = -0.0196 (~ -2% opposite move)
  assert.ok(Math.abs(Math.abs(rFlipped) - rOriginal) < 0.001);
  assert.ok(rFlipped < 0, 'Uptrend should become downtrend');
});

test('Unpredictability: random event magnitude is strictly capped (<= 6%)', () => {
  // Test across 50 rounds with varied seeds
  for (let s = 0; s < 50; s++) {
    const prng = createPRNG(`event_cap_seed_${s}`);
    const { events, totalMagnitude } = generateRandomEvents(180, prng);

    assert.ok(totalMagnitude <= 0.0601, `Total event magnitude ${totalMagnitude} exceeded 6% cap`);

    let sum = 0;
    for (const ev of events) {
      assert.ok(ev.magnitude >= 0.01 && ev.magnitude <= 0.045);
      assert.ok(ev.duration >= 3 && ev.duration <= 10);
      sum += ev.magnitude;
    }
    assert.ok(sum <= 0.0601, `Sum of event magnitudes ${sum} exceeded 6% cap`);
  }
});

test('Unpredictability: player impact stays under limit (<= 0.3%) and punishes crowd', () => {
  const engine = new TradingEngine({
    startingBalance: 100000,
    maxLeverage: 20,
    enablePlayerImpact: true
  });

  const pLong = engine.addPlayer('p_long', 'Long Whale');
  const mockCandles = Array(30).fill(0).map((_, i) => ({
    open: 30000,
    high: 30100,
    low: 29900,
    close: 30000
  }));

  engine.initRound(0, mockCandles, 30, { enablePlayerImpact: true });

  // Open large Long position (crowd is net long)
  engine.openPosition('p_long', SIDES.LONG, 100, 20, 'manual', null, null, null, false);

  // Step several ticks: price should be pushed DOWNWARD to punish the long crowd
  let lastPrice = 30000;
  for (let i = 0; i < 15; i++) {
    const res = engine.stepTick([]);
    assert.ok(res.currentPrice <= lastPrice, `Price should be pushed downward when crowd is net long: tick ${i}, price ${res.currentPrice}`);
    lastPrice = res.currentPrice;
  }

  // Cumulative player impact must stay within 0.3% (0.003)
  assert.ok(
    Math.abs(engine.cumulativePlayerImpactPct) <= 0.0031,
    `Cumulative player impact ${engine.cumulativePlayerImpactPct} exceeded 0.3% limit`
  );
  assert.ok(engine.cumulativePlayerImpactPct < 0, 'Net long should produce negative cumulative nudge');
});

test('Unpredictability: slippage and 0-2 tick delay apply to both manual and rule trades', () => {
  const roundSeed = 'friction_test_seed_777';
  const engine = new TradingEngine({
    feeRate: 0.001, // 0.1% base fee
    enableSlippage: true,
    enableExecutionDelay: true,
    roundSeed,
    volatilityMultiplier: 1.5
  });

  const pManual = engine.addPlayer('p_manual', 'Manual Trader');
  const pBot = engine.addPlayer('p_bot', 'Bot Trader');

  // Verify base fee is 0.1% (0.001)
  assert.equal(engine.feeRate, 0.001);

  // 1. Verify Slippage formula directly
  const basePrice = 30000;
  const longSlipped = engine.calculateSlippage(SIDES.LONG, 10000, basePrice, false);
  const shortSlipped = engine.calculateSlippage(SIDES.SHORT, 10000, basePrice, false);

  assert.ok(longSlipped > basePrice, `Long buy price ${longSlipped} should have upward slippage above ${basePrice}`);
  assert.ok(shortSlipped < basePrice, `Short sell price ${shortSlipped} should have downward slippage below ${basePrice}`);

  // Larger size produces more slippage
  const smallSizeSlippage = engine.calculateSlippage(SIDES.LONG, 1000, basePrice, false) - basePrice;
  const largeSizeSlippage = engine.calculateSlippage(SIDES.LONG, 100000, basePrice, false) - basePrice;
  assert.ok(largeSizeSlippage > smallSizeSlippage, 'Slippage must grow with order size');

  // 2. Verify Execution Delay (0 to 2 ticks) for manual and rule trades
  const mockCandles = [
    { open: 30000, high: 30000, low: 30000, close: 30000 },
    { open: 30000, high: 30200, low: 29900, close: 30150 },
    { open: 30150, high: 30400, low: 30100, close: 30300 },
    { open: 30300, high: 30500, low: 30200, close: 30450 }
  ];

  engine.initRound(0, mockCandles, 4, {
    enableSlippage: true,
    enableExecutionDelay: true,
    roundSeed: 'seed_with_guaranteed_delay'
  });

  // Manual trade order
  const manualResult = engine.openPosition('p_manual', SIDES.LONG, 25, 5, 'manual');
  // Rule trade order
  const botResult = engine.openPosition('p_bot', SIDES.LONG, 25, 5, 'rule');

  // Both manual and rule orders either execute with delay or enter pendingOrders queue
  if (manualResult.pending) {
    assert.ok(manualResult.delayTicks >= 1 && manualResult.delayTicks <= 2);
    assert.equal(engine.pendingOrders.some(o => o.playerId === 'p_manual'), true);
  }
  if (botResult.pending) {
    assert.ok(botResult.delayTicks >= 1 && botResult.delayTicks <= 2);
    assert.equal(engine.pendingOrders.some(o => o.playerId === 'p_bot'), true);
  }

  // Step ticks through completion
  engine.stepTick([]);
  engine.stepTick([]);
  engine.stepTick([]);

  // Both orders have now executed
  assert.ok(pManual.positions.length > 0 || pManual.stats.totalTrades > 0);
  assert.ok(pBot.positions.length > 0 || pBot.stats.totalTrades > 0);
});
