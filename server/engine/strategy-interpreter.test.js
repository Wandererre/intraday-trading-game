import test from 'node:test';
import assert from 'node:assert';
import {
  ALLOWED_BLOCK_TYPES,
  countBlocks,
  validateStrategy,
  evaluateStrategy,
  generatePseudoCode,
  STARTER_TEMPLATES
} from './strategy-interpreter.js';
import { TradingEngine } from './engine.js';

test('Strategy Validation: accepts valid blocks and starter templates', () => {
  for (const [key, template] of Object.entries(STARTER_TEMPLATES)) {
    const res = validateStrategy(template.blocks, 25);
    assert.strictEqual(res.valid, true);
    assert.ok(res.blockCount > 0);
  }
});

test('Strategy Validation: rejects unknown block types', () => {
  const badStrategy = {
    blocks: {
      blocks: [
        {
          type: 'malicious_eval_block',
          fields: { CODE: 'process.exit(1)' }
        }
      ]
    }
  };

  assert.throws(() => {
    validateStrategy(badStrategy, 20);
  }, /Unknown or disallowed block type/);
});

test('Strategy Validation: enforces block budget cap', () => {
  const strategy = STARTER_TEMPLATES.ma_crossover.blocks;
  const count = countBlocks(strategy);

  // Should fail if cap is strictly less than count
  assert.throws(() => {
    validateStrategy(strategy, count - 1);
  }, /Block budget exceeded/);

  // Should pass if cap is >= count
  const res = validateStrategy(strategy, count + 5);
  assert.strictEqual(res.valid, true);
});

test('Strategy Interpreter: nested IF/ELSE control flow', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer('p1', 'Alice');
  engine.initRound(0, [{ open: 40000, close: 40000, high: 40000, low: 40000 }], 100);

  const nestedStrategy = {
    blocks: {
      blocks: [
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: {
              block: {
                type: 'comp_compare',
                fields: { OP: 'GT' },
                inputs: {
                  A: { block: { type: 'val_price' } },
                  B: { block: { type: 'val_number', fields: { NUM: 50000 } } } // False
                }
              }
            },
            DO: {
              block: {
                type: 'action_open_long',
                inputs: {
                  SIZE: { block: { type: 'val_number', fields: { NUM: 50 } } },
                  LEVERAGE: { block: { type: 'val_number', fields: { NUM: 5 } } }
                }
              }
            },
            ELSE: {
              block: {
                type: 'control_if',
                inputs: {
                  CONDITION: {
                    block: {
                      type: 'comp_compare',
                      fields: { OP: 'EQ' },
                      inputs: {
                        A: { block: { type: 'val_my_position_side' } },
                        B: { block: { type: 'val_position_side_choice', fields: { SIDE: 'none' } } }
                      }
                    }
                  },
                  DO: {
                    block: {
                      type: 'action_open_short',
                      inputs: {
                        SIZE: { block: { type: 'val_number', fields: { NUM: 25 } } },
                        LEVERAGE: { block: { type: 'val_number', fields: { NUM: 4 } } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
  };

  const ctx = {
    engine,
    player,
    currentPrice: 40000,
    priceHistory: [40000],
    timeLeftSec: 100,
    maxLeverage: 20
  };

  const actions = evaluateStrategy(nestedStrategy, ctx);
  assert.strictEqual(actions.length, 1);
  assert.strictEqual(player.positions.length, 1);
  assert.strictEqual(player.positions[0].side, 'SHORT');
  assert.strictEqual(player.positions[0].leverage, 4);
});

test('Strategy Interpreter: crosses above and below detection', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer('p1', 'Alice');
  engine.initRound(0, [{ open: 100, close: 100, high: 100, low: 100 }], 100);

  const crossStrategy = {
    blocks: {
      blocks: [
        {
          type: 'control_if',
          id: 'cross_block',
          inputs: {
            CONDITION: {
              block: {
                type: 'comp_compare',
                id: 'comp_cross',
                fields: { OP: 'CROSSES_ABOVE' },
                inputs: {
                  A: { block: { type: 'val_price' } },
                  B: { block: { type: 'val_number', fields: { NUM: 105 } } }
                }
              }
            },
            DO: {
              block: {
                type: 'action_open_long',
                inputs: {
                  SIZE: { block: { type: 'val_number', fields: { NUM: 10 } } },
                  LEVERAGE: { block: { type: 'val_number', fields: { NUM: 2 } } }
                }
              }
            }
          }
        }
      ]
    }
  };

  // Tick 1: price 100 (below 105). Cross should NOT trigger
  let ctx = { engine, player, currentPrice: 100, priceHistory: [100], timeLeftSec: 100, maxLeverage: 20 };
  let actions = evaluateStrategy(crossStrategy, ctx);
  assert.strictEqual(actions.length, 0);
  assert.strictEqual(player.positions.length, 0);

  // Tick 2: price 102 (still below 105). Cross should NOT trigger
  ctx = { engine, player, currentPrice: 102, priceHistory: [100, 102], timeLeftSec: 99, maxLeverage: 20 };
  actions = evaluateStrategy(crossStrategy, ctx);
  assert.strictEqual(actions.length, 0);

  // Tick 3: price jumps to 110 (crosses above 105!). Should trigger
  ctx = { engine, player, currentPrice: 110, priceHistory: [100, 102, 110], timeLeftSec: 98, maxLeverage: 20 };
  actions = evaluateStrategy(crossStrategy, ctx);
  assert.strictEqual(actions.length, 1);
  assert.strictEqual(player.positions.length, 1);

  // Tick 4: price remains 112 (still above, but did NOT cross this tick). Should NOT trigger again
  ctx = { engine, player, currentPrice: 112, priceHistory: [100, 102, 110, 112], timeLeftSec: 97, maxLeverage: 20 };
  actions = evaluateStrategy(crossStrategy, ctx);
  assert.strictEqual(actions.length, 0);
});

test('Strategy Interpreter: variable persistence across ticks and reset between rounds', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer('p1', 'Alice');
  engine.initRound(0, [{ open: 100, close: 100, high: 100, low: 100 }], 100);

  const memStrategy = {
    blocks: {
      blocks: [
        {
          type: 'mem_increment_counter',
          fields: { VAR_NAME: 'tickCount' },
          inputs: {
            BY: { block: { type: 'val_number', fields: { NUM: 5 } } }
          }
        }
      ]
    }
  };

  const ctx = { engine, player, currentPrice: 100, priceHistory: [100], timeLeftSec: 100, maxLeverage: 20 };

  // Tick 1
  evaluateStrategy(memStrategy, ctx);
  assert.strictEqual(player.strategyMemory.variables.tickCount, 5);

  // Tick 2
  evaluateStrategy(memStrategy, ctx);
  assert.strictEqual(player.strategyMemory.variables.tickCount, 10);

  // Tick 3
  evaluateStrategy(memStrategy, ctx);
  assert.strictEqual(player.strategyMemory.variables.tickCount, 15);

  // Round 2 resets player strategyMemory
  engine.initRound(1, [{ open: 100, close: 100, high: 100, low: 100 }], 100);
  assert.strictEqual(player.strategyMemory.variables.tickCount, undefined);

  // Tick 1 of round 2 starts at 5 again
  evaluateStrategy(memStrategy, ctx);
  assert.strictEqual(player.strategyMemory.variables.tickCount, 5);
});

test('Strategy Interpreter: run_once wrapper fires exactly once per round', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer('p1', 'Alice');
  engine.initRound(0, [{ open: 100, close: 100, high: 100, low: 100 }], 100);

  const runOnceStrategy = {
    blocks: {
      blocks: [
        {
          type: 'mem_run_once',
          id: 'initial_loan',
          inputs: {
            DO: {
              block: {
                type: 'action_borrow_amount',
                inputs: {
                  AMOUNT: { block: { type: 'val_number', fields: { NUM: 2000 } } }
                }
              }
            }
          }
        }
      ]
    }
  };

  const ctx = { engine, player, currentPrice: 100, priceHistory: [100], timeLeftSec: 100, maxLeverage: 20 };

  // Tick 1
  evaluateStrategy(runOnceStrategy, ctx);
  assert.strictEqual(player.bankDebt, 2000);
  assert.strictEqual(player.balance, 12000);

  // Tick 2: should NOT borrow again
  evaluateStrategy(runOnceStrategy, ctx);
  assert.strictEqual(player.bankDebt, 2000);
  assert.strictEqual(player.balance, 12000);
});

test('Strategy Interpreter: action clamping to trade panel limits & bank caps', () => {
  const engine = new TradingEngine({ startingBalance: 10000, maxLeverage: 15 });
  const player = engine.addPlayer('p1', 'Alice');
  engine.initRound(0, [{ open: 100, close: 100, high: 100, low: 100 }], 100);

  // Try opening with 999% size and 100x leverage (should clamp to 100% and 15x)
  const extremeStrategy = {
    blocks: {
      blocks: [
        {
          type: 'action_open_long',
          inputs: {
            SIZE: { block: { type: 'val_number', fields: { NUM: 999 } } },
            LEVERAGE: { block: { type: 'val_number', fields: { NUM: 100 } } }
          }
        }
      ]
    }
  };

  const ctx = { engine, player, currentPrice: 100, priceHistory: [100], timeLeftSec: 100, maxLeverage: 15 };
  evaluateStrategy(extremeStrategy, ctx);

  assert.strictEqual(player.positions.length, 1);
  assert.strictEqual(player.positions[0].leverage, 15); // clamped to maxLeverage
  assert.ok(player.positions[0].margin <= 10000);
});

test('Strategy Interpreter: borrow and repay respect bank caps', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const player = engine.addPlayer('p1', 'Alice');
  engine.initRound(0, [{ open: 100, close: 100, high: 100, low: 100 }], 100);

  const borrowRepay = {
    blocks: {
      blocks: [
        {
          type: 'action_borrow_amount',
          inputs: {
            AMOUNT: { block: { type: 'val_number', fields: { NUM: 50000 } } } // Over 10k max limit
          },
          next: {
            block: {
              type: 'action_repay_amount',
              inputs: {
                AMOUNT: { block: { type: 'val_number', fields: { NUM: 4000 } } }
              }
            }
          }
        }
      ]
    }
  };

  const ctx = { engine, player, currentPrice: 100, priceHistory: [100], timeLeftSec: 100, maxLeverage: 20 };
  evaluateStrategy(borrowRepay, ctx);

  // Borrow should be clamped to 10,000, then repaid 4,000 -> remaining debt 6,000
  assert.strictEqual(player.bankDebt, 6000);
});

test('Strategy Interpreter: invalid strategy disabled without crashing engine or affecting other players', () => {
  const engine = new TradingEngine({ startingBalance: 10000 });
  const p1 = engine.addPlayer('p1', 'Alice');
  const p2 = engine.addPlayer('p2', 'Bob');
  engine.initRound(0, [{ open: 100, close: 100, high: 100, low: 100 }], 100);

  p1.strategy = { badFormat: true }; // corrupted strategy
  p1.strategyEnabled = true;

  p2.strategy = STARTER_TEMPLATES.ma_crossover.blocks;
  p2.strategyEnabled = true;

  // Step tick should not throw, should disable p1's strategy and safely evaluate p2
  assert.doesNotThrow(() => {
    engine.stepTick();
  });

  assert.strictEqual(p1.strategyEnabled, false);
  assert.ok(p1.strategyError);
  assert.strictEqual(p2.strategyEnabled, true);
});
