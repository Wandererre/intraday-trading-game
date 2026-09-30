import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRule,
  validateRulesList,
  evaluateCondition,
  ruleToEnglish,
  RULE_TEMPLATES,
  parseRuleText
} from './rules.js';
import { TradingEngine } from './engine.js';
import { createInitialPlayer, SIDES } from './types.js';

test('Rules: validation accepts valid 5-rule list and starter templates', () => {
  assert.equal(validateRulesList(RULE_TEMPLATES.ma_crossover).length, 4);
  assert.equal(validateRulesList(RULE_TEMPLATES.rsi_dip).length, 4);
  assert.equal(validateRulesList(RULE_TEMPLATES.stop_loss_take_profit).length, 4);
});

test('Rules: rejects invalid input, unknown things, bad ops, and >5 rules', () => {
  // Over 5 rules
  assert.throws(() => {
    validateRulesList([{}, {}, {}, {}, {}, {}]);
  }, /Maximum 5 rules/);

  // Unknown operand type
  assert.throws(() => {
    validateRule({
      condition1: { left: { type: 'magic_wand' }, operator: 'is_above', right: { type: 'number', value: 10 } },
      action: { type: 'OPEN_LONG' }
    });
  }, /Unknown operand type/);

  // Bad comparison operator
  assert.throws(() => {
    validateRule({
      condition1: { left: { type: 'price' }, operator: 'kinda_equals', right: { type: 'number', value: 10 } },
      action: { type: 'OPEN_LONG' }
    });
  }, /Invalid comparison operator/);

  // Bad action type
  assert.throws(() => {
    validateRule({
      condition1: { left: { type: 'price' }, operator: 'is_above', right: { type: 'number', value: 10 } },
      action: { type: 'STEAL_MONEY' }
    });
  }, /Invalid action type/);
});

test('Rules: comparison types (is_above, is_below, equals)', () => {
  const dummyPlayer = createInitialPlayer('p1', 'Alice', 10000);
  const ctx = {
    currentPrice: 42000,
    priceHistory: [40000, 41000, 42000],
    player: dummyPlayer,
    timeLeftSec: 120
  };

  // is_above
  assert.equal(evaluateCondition({
    left: { type: 'price' },
    operator: 'is_above',
    right: { type: 'number', value: 41000 }
  }, ctx), true);

  assert.equal(evaluateCondition({
    left: { type: 'price' },
    operator: 'is_above',
    right: { type: 'number', value: 43000 }
  }, ctx), false);

  // is_below
  assert.equal(evaluateCondition({
    left: { type: 'price' },
    operator: 'is_below',
    right: { type: 'number', value: 43000 }
  }, ctx), true);

  // equals (position)
  assert.equal(evaluateCondition({
    left: { type: 'position' },
    operator: 'equals',
    right: { type: 'position', value: 'none' }
  }, ctx), true);
});

test('Rules: crosses above and crosses below detection', () => {
  const dummyPlayer = createInitialPlayer('p1', 'Alice', 10000);

  // Crosses above: previous price <= 41500, current price > 41500
  const condCrossUp = {
    left: { type: 'price' },
    operator: 'crosses_above',
    right: { type: 'number', value: 41500 }
  };

  const ctxCrossUp = {
    currentPrice: 42000,
    priceHistory: [41000, 41400, 42000], // prev was 41400 <= 41500, current is 42000 > 41500
    player: dummyPlayer,
    timeLeftSec: 100
  };
  assert.equal(evaluateCondition(condCrossUp, ctxCrossUp), true);

  // If already above in previous tick, cross above should be FALSE
  const ctxAlreadyAbove = {
    currentPrice: 42500,
    priceHistory: [41400, 42000, 42500], // prev was 42000 > 41500
    player: dummyPlayer,
    timeLeftSec: 100
  };
  assert.equal(evaluateCondition(condCrossUp, ctxAlreadyAbove), false);

  // Crosses below: prev was 42000 >= 41500, current is 41000 < 41500
  const condCrossDown = {
    left: { type: 'price' },
    operator: 'crosses_below',
    right: { type: 'number', value: 41500 }
  };
  const ctxCrossDown = {
    currentPrice: 41000,
    priceHistory: [42500, 42000, 41000],
    player: dummyPlayer,
    timeLeftSec: 100
  };
  assert.equal(evaluateCondition(condCrossDown, ctxCrossDown), true);
});

test('Rules: AND handling', () => {
  const dummyPlayer = createInitialPlayer('p1', 'Alice', 10000);
  const ctx = {
    currentPrice: 42000,
    priceHistory: [40000, 41000, 42000],
    player: dummyPlayer,
    timeLeftSec: 50
  };

  const rule = {
    id: 'r1',
    enabled: true,
    condition1: { left: { type: 'price' }, operator: 'is_above', right: { type: 'number', value: 40000 } },
    hasAnd: true,
    condition2: { left: { type: 'seconds_left' }, operator: 'is_below', right: { type: 'number', value: 60 } },
    action: { type: 'CLOSE_POSITION' }
  };

  const cond1 = evaluateCondition(rule.condition1, ctx);
  const cond2 = evaluateCondition(rule.condition2, ctx);
  assert.equal(cond1 && cond2, true);

  // When second condition fails
  const ctxLongTime = { ...ctx, timeLeftSec: 100 };
  assert.equal(evaluateCondition(rule.condition1, ctxLongTime) && evaluateCondition(rule.condition2, ctxLongTime), false);
});

test('Rules: cooldowns (10 ticks) prevent spamming', () => {
  const engine = new TradingEngine({ startingBalance: 10000, maxLeverage: 20 });
  const player = engine.addPlayer('p1', 'Alice');

  player.rules = [{
    id: 'rule_cd',
    enabled: true,
    cooldownTicks: 10,
    lastTriggeredTick: -999,
    condition1: { left: { type: 'price' }, operator: 'is_above', right: { type: 'number', value: 100 } },
    action: { type: 'OPEN_LONG', sizePct: 10, leverage: 2 }
  }];

  const ticks50 = Array.from({ length: 50 }, (_, i) => ({
    open: 200, high: 200, low: 200, close: 200, time: 1000 + i * 15
  }));
  engine.initRound(0, ticks50, 50);

  // Tick 1: fires
  engine.stepTick([]);
  assert.equal(player.positions.length, 1);
  assert.equal(player.rules[0].lastTriggeredTick, 1);

  // Tick 2: within 10-tick cooldown, should NOT fire
  engine.stepTick([]);
  assert.equal(player.positions.length, 1);

  // Advance ticks up to tick 10: still on cooldown
  for (let i = 3; i <= 10; i++) {
    engine.stepTick([]);
  }
  assert.equal(player.positions.length, 1);

  // Tick 11: (11 - 1 = 10 >= cooldown) cooldown expired, fires again!
  engine.stepTick([]);
  assert.equal(player.positions.length, 2);
  assert.equal(player.rules[0].lastTriggeredTick, 11);
});

test('Rules: action clamping to trade panel limits', () => {
  const engine = new TradingEngine({ startingBalance: 10000, maxLeverage: 10 });
  const player = engine.addPlayer('p1', 'Alice');

  // Rule tries to request 500% size and 100x leverage
  player.rules = validateRulesList([{
    id: 'r_clamp',
    enabled: true,
    condition1: { left: { type: 'price' }, operator: 'is_above', right: { type: 'number', value: 0 } },
    action: { type: 'OPEN_LONG', sizePct: 500, leverage: 100 }
  }]);

  assert.equal(player.rules[0].action.sizePct, 100); // clamped to 100%
  assert.equal(player.rules[0].action.leverage, 20);  // schema clamped to 20

  engine.initRound(0, [{ open: 200, high: 200, low: 200, close: 200, time: 1000 }], 10);
  engine.stepTick([]);

  assert.equal(player.positions.length, 1);
  // Engine max leverage clamp (10x) enforced
  assert.equal(player.positions[0].leverage, 10);
});

test('Rules: invalid rule skipped with error without affecting other players', () => {
  const engine = new TradingEngine({ startingBalance: 10000, maxLeverage: 20 });
  const p1 = engine.addPlayer('p1', 'Alice');
  const p2 = engine.addPlayer('p2', 'Bob');

  // Alice has a corrupt/bad rule
  p1.rules = [{
    id: 'bad_rule',
    enabled: true,
    condition1: { left: { type: 'corrupted' }, operator: 'invalid', right: null },
    action: { type: 'OPEN_LONG' }
  }];

  // Bob has a healthy valid rule
  p2.rules = [{
    id: 'good_rule',
    enabled: true,
    condition1: { left: { type: 'price' }, operator: 'is_above', right: { type: 'number', value: 0 } },
    action: { type: 'OPEN_LONG', sizePct: 25, leverage: 5 }
  }];

  const ticks10 = Array.from({ length: 10 }, (_, i) => ({
    open: 200, high: 200, low: 200, close: 200, time: 1000 + i * 15
  }));
  engine.initRound(0, ticks10, 10);

  // stepTick should run safely without throwing
  assert.doesNotThrow(() => {
    engine.stepTick([]);
  });

  // Alice's rule should record error
  assert.ok(p1.rules[0].error);
  assert.equal(p1.positions.length, 0);

  // Bob's valid rule fired cleanly!
  assert.equal(p2.positions.length, 1);
});

test('Rules: plain English generation matches expected formats', () => {
  const rule = {
    id: 'r_eng',
    enabled: true,
    condition1: { left: { type: 'price' }, operator: 'crosses_above', right: { type: 'sma', param: 20 } },
    hasAnd: true,
    condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
    action: { type: 'OPEN_LONG', sizePct: 25, leverage: 5 }
  };
  const english = ruleToEnglish(rule);
  assert.equal(english, 'IF price crosses above sma(20) AND position is none THEN open long 25% at 5x');
});
