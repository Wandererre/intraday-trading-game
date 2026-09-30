/**
 * Pure Blockly Strategy Interpreter & AST Validator (NO EVAL).
 * Interprets serialized Blockly JSON workspace representations safely on the server.
 */

import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculatePctChange,
  calculateHighest,
  calculateLowest
} from './indicators.js';

export const ALLOWED_BLOCK_TYPES = new Set([
  // Values (Numbers & Strings)
  'val_price',
  'val_sma',
  'val_ema',
  'val_rsi',
  'val_pct_change',
  'val_highest',
  'val_lowest',
  'val_my_cash',
  'val_my_equity',
  'val_my_debt',
  'val_my_position_size',
  'val_my_position_side',
  'val_position_side_choice',
  'val_my_entry_price',
  'val_my_pnl_percent',
  'val_seconds_left',
  'val_number',
  'math_number',

  // Math
  'math_arithmetic',
  'math_abs',

  // Comparison
  'comp_compare',

  // Logic
  'logic_operation',
  'logic_negate',
  'logic_boolean',

  // Control
  'control_if',
  'control_if_else',

  // Memory
  'mem_set_variable',
  'mem_get_variable',
  'mem_increment_counter',
  'mem_run_once',

  // Actions
  'action_open_long',
  'action_open_short',
  'action_close_position',
  'action_reduce_position',
  'action_set_stop_loss',
  'action_set_take_profit',
  'action_set_leverage',
  'action_borrow_amount',
  'action_repay_amount'
]);

/**
 * Counts the total number of blocks in a serialized Blockly workspace.
 */
export function countBlocks(strategyJson) {
  if (!strategyJson) return 0;
  let count = 0;

  function walk(block) {
    if (!block || typeof block !== 'object') return;
    count++;

    if (block.inputs && typeof block.inputs === 'object') {
      for (const inputKey of Object.keys(block.inputs)) {
        const inputObj = block.inputs[inputKey];
        if (inputObj && inputObj.block) {
          walk(inputObj.block);
        } else if (inputObj && inputObj.shadow) {
          // shadow blocks (e.g. default number inputs) count if filled
          walk(inputObj.shadow);
        }
      }
    }

    if (block.next && block.next.block) {
      walk(block.next.block);
    }
  }

  const rootBlocks = getRootBlocks(strategyJson);
  for (const block of rootBlocks) {
    walk(block);
  }

  return count;
}

/**
 * Extracts root blocks from Blockly JSON format.
 */
export function getRootBlocks(strategyJson) {
  if (!strategyJson) return [];
  if (Array.isArray(strategyJson)) return strategyJson;
  if (strategyJson.blocks) {
    if (Array.isArray(strategyJson.blocks.blocks)) return strategyJson.blocks.blocks;
    if (Array.isArray(strategyJson.blocks)) return strategyJson.blocks;
  }
  if (typeof strategyJson === 'object' && Object.keys(strategyJson).length > 0) {
    throw new Error('Invalid workspace structure: expected Blockly serialized blocks');
  }
  return [];
}

/**
 * Validates a strategy against schema, unknown blocks, depth and budget cap.
 */
export function validateStrategy(strategyJson, maxAllowedBlocks = 20) {
  if (!strategyJson) {
    return { valid: true, blockCount: 0 };
  }

  let totalCount = 0;
  const maxDepth = 40;

  function checkBlock(block, depth) {
    if (!block || typeof block !== 'object') return;
    if (depth > maxDepth) {
      throw new Error(`Strategy exceeds maximum nesting depth (${maxDepth})`);
    }

    totalCount++;
    const type = block.type;
    if (!type || !ALLOWED_BLOCK_TYPES.has(type)) {
      throw new Error(`Unknown or disallowed block type: "${type || 'undefined'}"`);
    }

    if (block.inputs && typeof block.inputs === 'object') {
      for (const inputKey of Object.keys(block.inputs)) {
        const inputObj = block.inputs[inputKey];
        if (inputObj && inputObj.block) {
          checkBlock(inputObj.block, depth + 1);
        } else if (inputObj && inputObj.shadow) {
          checkBlock(inputObj.shadow, depth + 1);
        }
      }
    }

    if (block.next && block.next.block) {
      checkBlock(block.next.block, depth);
    }
  }

  const rootBlocks = getRootBlocks(strategyJson);
  for (const block of rootBlocks) {
    checkBlock(block, 1);
  }

  if (totalCount > maxAllowedBlocks) {
    throw new Error(`Block budget exceeded: using ${totalCount} blocks (cap is ${maxAllowedBlocks})`);
  }

  return { valid: true, blockCount: totalCount };
}

/**
 * Evaluates an input or field to a numeric/string/boolean value.
 */
function evaluateValue(inputOrBlock, ctx) {
  if (!inputOrBlock) return null;
  const block = inputOrBlock.block || inputOrBlock.shadow || inputOrBlock;
  if (!block || !block.type) return null;

  const { player, currentPrice, priceHistory, timeLeftSec, maxLeverage } = ctx;

  switch (block.type) {
    case 'val_price':
      return currentPrice;

    case 'val_sma': {
      const p = Number(block.fields?.PERIOD ?? evaluateValue(block.inputs?.PERIOD, ctx) ?? 14);
      return calculateSMA(priceHistory, p) ?? currentPrice;
    }

    case 'val_ema': {
      const p = Number(block.fields?.PERIOD ?? evaluateValue(block.inputs?.PERIOD, ctx) ?? 14);
      return calculateEMA(priceHistory, p) ?? currentPrice;
    }

    case 'val_rsi': {
      const p = Number(block.fields?.PERIOD ?? evaluateValue(block.inputs?.PERIOD, ctx) ?? 14);
      return calculateRSI(priceHistory, p) ?? 50;
    }

    case 'val_pct_change': {
      const n = Number(block.fields?.LOOKBACK ?? evaluateValue(block.inputs?.LOOKBACK, ctx) ?? 10);
      return calculatePctChange(priceHistory, n) ?? 0;
    }

    case 'val_highest': {
      const n = Number(block.fields?.LOOKBACK ?? evaluateValue(block.inputs?.LOOKBACK, ctx) ?? 10);
      return calculateHighest(priceHistory, n) ?? currentPrice;
    }

    case 'val_lowest': {
      const n = Number(block.fields?.LOOKBACK ?? evaluateValue(block.inputs?.LOOKBACK, ctx) ?? 10);
      return calculateLowest(priceHistory, n) ?? currentPrice;
    }

    case 'val_my_cash':
      return player.balance;

    case 'val_my_equity':
      return ctx.engine.getPlayerEquity(player, currentPrice);

    case 'val_my_debt':
      return player.bankDebt || 0;

    case 'val_my_position_size':
      return player.positions ? player.positions.length : 0;

    case 'val_my_position_side':
      return player.positions && player.positions.length > 0
        ? player.positions[0].side.toLowerCase()
        : 'none';

    case 'val_position_side_choice':
      return (block.fields?.SIDE || 'none').toLowerCase();

    case 'val_my_entry_price':
      return player.positions && player.positions.length > 0
        ? player.positions[0].entryPrice
        : 0;

    case 'val_my_pnl_percent': {
      if (player.positions && player.positions.length > 0) {
        const totalMargin = player.positions.reduce((s, p) => s + p.margin, 0);
        const totalUPnL = ctx.engine.calculateTotalUnrealizedPnL(player.positions, currentPrice);
        return totalMargin > 0 ? (totalUPnL / totalMargin) * 100 : 0;
      }
      return 0;
    }

    case 'val_seconds_left':
      return timeLeftSec;

    case 'val_number':
    case 'math_number':
      return Number(block.fields?.NUM ?? 0);

    case 'math_arithmetic': {
      const a = Number(evaluateValue(block.inputs?.A, ctx) ?? 0);
      const b = Number(evaluateValue(block.inputs?.B, ctx) ?? 0);
      const op = block.fields?.OP || 'ADD';
      switch (op) {
        case 'ADD': return a + b;
        case 'SUBTRACT':
        case 'MINUS': return a - b;
        case 'MULTIPLY': return a * b;
        case 'DIVIDE': return b !== 0 ? a / b : 0;
        case 'MIN': return Math.min(a, b);
        case 'MAX': return Math.max(a, b);
        default: return a + b;
      }
    }

    case 'math_abs': {
      const n = Number(evaluateValue(block.inputs?.NUM, ctx) ?? 0);
      return Math.abs(n);
    }

    case 'comp_compare': {
      const a = evaluateValue(block.inputs?.A, ctx);
      const b = evaluateValue(block.inputs?.B, ctx);
      const op = block.fields?.OP || 'GT';
      const blockId = block.id || 'comp_default';

      if (!player.strategyMemory) {
        player.strategyMemory = { variables: {}, firedOnce: {}, prevValues: {} };
      }
      if (!player.strategyMemory.prevValues) {
        player.strategyMemory.prevValues = {};
      }

      if (op === 'CROSSES_ABOVE') {
        const prev = player.strategyMemory.prevValues[blockId];
        const numA = Number(a);
        const numB = Number(b);
        const crossed = prev && prev.a <= prev.b && numA > numB;
        player.strategyMemory.prevValues[blockId] = { a: numA, b: numB };
        return Boolean(crossed);
      }

      if (op === 'CROSSES_BELOW') {
        const prev = player.strategyMemory.prevValues[blockId];
        const numA = Number(a);
        const numB = Number(b);
        const crossed = prev && prev.a >= prev.b && numA < numB;
        player.strategyMemory.prevValues[blockId] = { a: numA, b: numB };
        return Boolean(crossed);
      }

      // Standard comparisons
      if (typeof a === 'string' || typeof b === 'string') {
        const sa = String(a).toLowerCase();
        const sb = String(b).toLowerCase();
        if (op === 'EQ') return sa === sb;
        if (op === 'NEQ') return sa !== sb;
        return sa === sb;
      }

      const na = Number(a);
      const nb = Number(b);
      switch (op) {
        case 'GT': return na > nb;
        case 'LT': return na < nb;
        case 'GTE': return na >= nb;
        case 'LTE': return na <= nb;
        case 'EQ': return na === nb;
        case 'NEQ': return na !== nb;
        default: return na === nb;
      }
    }

    case 'logic_operation': {
      const a = Boolean(evaluateValue(block.inputs?.A, ctx));
      const b = Boolean(evaluateValue(block.inputs?.B, ctx));
      const op = block.fields?.OP || 'AND';
      return op === 'AND' ? (a && b) : (a || b);
    }

    case 'logic_negate': {
      const val = Boolean(evaluateValue(block.inputs?.BOOL, ctx));
      return !val;
    }

    case 'logic_boolean': {
      return block.fields?.BOOL === 'TRUE';
    }

    case 'mem_get_variable': {
      const varName = block.fields?.VAR_NAME || 'x';
      return player.strategyMemory?.variables?.[varName] ?? 0;
    }

    default:
      return null;
  }
}

/**
 * Executes a statement block (and follows block.next sequentially).
 */
function executeStatement(block, ctx, actionsExecuted) {
  let curr = block;

  while (curr) {
    if (!curr.type) break;
    const { player, engine, maxLeverage } = ctx;

    if (!player.strategyMemory) {
      player.strategyMemory = { variables: {}, firedOnce: {}, prevValues: {} };
    }

    switch (curr.type) {
      case 'control_if': {
        const cond = Boolean(evaluateValue(curr.inputs?.CONDITION, ctx));
        if (cond && curr.inputs?.DO?.block) {
          executeStatement(curr.inputs.DO.block, ctx, actionsExecuted);
        }
        break;
      }

      case 'control_if_else': {
        const cond = Boolean(evaluateValue(curr.inputs?.CONDITION, ctx));
        if (cond) {
          if (curr.inputs?.DO?.block) {
            executeStatement(curr.inputs.DO.block, ctx, actionsExecuted);
          }
        } else {
          if (curr.inputs?.ELSE?.block) {
            executeStatement(curr.inputs.ELSE.block, ctx, actionsExecuted);
          }
        }
        break;
      }

      case 'mem_set_variable': {
        const varName = curr.fields?.VAR_NAME || 'x';
        const val = Number(evaluateValue(curr.inputs?.VALUE, ctx) ?? 0);
        player.strategyMemory.variables[varName] = val;
        break;
      }

      case 'mem_increment_counter': {
        const varName = curr.fields?.VAR_NAME || 'counter';
        const byVal = Number(evaluateValue(curr.inputs?.BY, ctx) ?? 1);
        player.strategyMemory.variables[varName] = (player.strategyMemory.variables[varName] || 0) + byVal;
        break;
      }

      case 'mem_run_once': {
        const blockId = curr.id || 'run_once_default';
        if (!player.strategyMemory.firedOnce[blockId]) {
          player.strategyMemory.firedOnce[blockId] = true;
          if (curr.inputs?.DO?.block) {
            executeStatement(curr.inputs.DO.block, ctx, actionsExecuted);
          }
        }
        break;
      }

      case 'action_open_long': {
        const rawSize = Number(evaluateValue(curr.inputs?.SIZE, ctx) ?? 25);
        const rawLev = Number(evaluateValue(curr.inputs?.LEVERAGE, ctx) ?? 5);
        const sizePct = Math.max(1, Math.min(100, Math.round(rawSize)));
        const leverage = Math.max(1, Math.min(maxLeverage || 20, Math.round(rawLev)));
        const ev = engine.openPosition(player.id, 'LONG', sizePct, leverage, 'rule');
        if (ev) actionsExecuted.push(ev);
        break;
      }

      case 'action_open_short': {
        const rawSize = Number(evaluateValue(curr.inputs?.SIZE, ctx) ?? 25);
        const rawLev = Number(evaluateValue(curr.inputs?.LEVERAGE, ctx) ?? 5);
        const sizePct = Math.max(1, Math.min(100, Math.round(rawSize)));
        const leverage = Math.max(1, Math.min(maxLeverage || 20, Math.round(rawLev)));
        const ev = engine.openPosition(player.id, 'SHORT', sizePct, leverage, 'rule');
        if (ev) actionsExecuted.push(ev);
        break;
      }

      case 'action_close_position': {
        const evs = engine.closeAllPositions ? engine.closeAllPositions(player.id, 'rule') : [engine.closePosition(player.id, null, 'rule')];
        if (evs) actionsExecuted.push(...(Array.isArray(evs) ? evs : [evs]));
        break;
      }

      case 'action_reduce_position': {
        // Close oldest position
        if (player.positions && player.positions.length > 0) {
          const ev = engine.closePosition(player.id, player.positions[0].id, 'rule');
          if (ev) actionsExecuted.push(ev);
        }
        break;
      }

      case 'action_set_stop_loss': {
        const rawPct = Number(evaluateValue(curr.inputs?.PERCENT, ctx) ?? 5);
        const slPct = Math.max(0.5, Math.min(95, rawPct));
        if (player.positions) {
          player.positions.forEach(p => { p.stopLossPct = slPct; });
        }
        break;
      }

      case 'action_set_take_profit': {
        const rawPct = Number(evaluateValue(curr.inputs?.PERCENT, ctx) ?? 10);
        const tpPct = Math.max(0.5, Math.min(500, rawPct));
        if (player.positions) {
          player.positions.forEach(p => { p.takeProfitPct = tpPct; });
        }
        break;
      }

      case 'action_set_leverage': {
        const rawLev = Number(evaluateValue(curr.inputs?.LEVERAGE, ctx) ?? 5);
        const lev = Math.max(1, Math.min(maxLeverage || 20, Math.round(rawLev)));
        if (player.positions) {
          player.positions.forEach(p => { p.leverage = lev; });
        }
        break;
      }

      case 'action_borrow_amount': {
        const rawAmt = Number(evaluateValue(curr.inputs?.AMOUNT, ctx) ?? 1000);
        const amt = Math.max(500, Math.min(10000, rawAmt));
        const res = engine.borrowFromBank(player.id, amt);
        if (res) actionsExecuted.push({ type: 'BORROW', amount: amt });
        break;
      }

      case 'action_repay_amount': {
        const rawAmt = Number(evaluateValue(curr.inputs?.AMOUNT, ctx) ?? 1000);
        const amt = Math.max(100, Math.min(player.bankDebt || 10000, rawAmt));
        const res = engine.repayBankLoan(player.id, amt);
        if (res) actionsExecuted.push({ type: 'REPAY', amount: amt });
        break;
      }

      default:
        break;
    }

    curr = curr.next?.block;
  }
}

/**
 * Runs a player's strategy on the current tick.
 * Top-to-bottom, no loops, no recursion, safe and bounded.
 */
export function evaluateStrategy(strategyJson, ctx) {
  if (!strategyJson) return [];
  const actionsExecuted = [];
  const rootBlocks = getRootBlocks(strategyJson);

  for (const block of rootBlocks) {
    executeStatement(block, ctx, actionsExecuted);
  }

  return actionsExecuted;
}

/**
 * Generates human-readable pseudo-code preview from serialized Blockly workspace.
 */
export function generatePseudoCode(strategyJson) {
  if (!strategyJson) return '// No active strategy loaded';

  function formatValue(block) {
    if (!block) return '?';
    const b = block.block || block.shadow || block;
    if (!b || !b.type) return '?';

    switch (b.type) {
      case 'val_price': return 'price';
      case 'val_sma': return `sma(${b.fields?.PERIOD ?? formatValue(b.inputs?.PERIOD) ?? 14})`;
      case 'val_ema': return `ema(${b.fields?.PERIOD ?? formatValue(b.inputs?.PERIOD) ?? 14})`;
      case 'val_rsi': return `rsi(${b.fields?.PERIOD ?? formatValue(b.inputs?.PERIOD) ?? 14})`;
      case 'val_pct_change': return `pct_change(${b.fields?.LOOKBACK ?? formatValue(b.inputs?.LOOKBACK) ?? 10})`;
      case 'val_highest': return `highest(${b.fields?.LOOKBACK ?? formatValue(b.inputs?.LOOKBACK) ?? 10})`;
      case 'val_lowest': return `lowest(${b.fields?.LOOKBACK ?? formatValue(b.inputs?.LOOKBACK) ?? 10})`;
      case 'val_my_cash': return 'my_cash';
      case 'val_my_equity': return 'my_equity';
      case 'val_my_debt': return 'my_debt';
      case 'val_my_position_size': return 'my_position_size';
      case 'val_my_position_side': return 'my_position_side';
      case 'val_position_side_choice': return `"${b.fields?.SIDE || 'none'}"`;
      case 'val_my_entry_price': return 'my_entry_price';
      case 'val_my_pnl_percent': return 'my_pnl%';
      case 'val_seconds_left': return 'seconds_left';
      case 'val_number':
      case 'math_number': return `${b.fields?.NUM ?? 0}`;
      case 'math_arithmetic': {
        const opMap = { ADD: '+', SUBTRACT: '-', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', MIN: 'min', MAX: 'max' };
        const op = opMap[b.fields?.OP] || '+';
        if (op === 'min' || op === 'max') {
          return `${op}(${formatValue(b.inputs?.A)}, ${formatValue(b.inputs?.B)})`;
        }
        return `(${formatValue(b.inputs?.A)} ${op} ${formatValue(b.inputs?.B)})`;
      }
      case 'math_abs': return `abs(${formatValue(b.inputs?.NUM)})`;
      case 'comp_compare': {
        const opMap = {
          GT: '>', LT: '<', GTE: '>=', LTE: '<=', EQ: '==', NEQ: '!=',
          CROSSES_ABOVE: 'crosses above',
          CROSSES_BELOW: 'crosses below'
        };
        const op = opMap[b.fields?.OP] || '==';
        return `${formatValue(b.inputs?.A)} ${op} ${formatValue(b.inputs?.B)}`;
      }
      case 'logic_operation': {
        const op = b.fields?.OP || 'AND';
        return `(${formatValue(b.inputs?.A)} ${op} ${formatValue(b.inputs?.B)})`;
      }
      case 'logic_negate': return `NOT (${formatValue(b.inputs?.BOOL)})`;
      case 'mem_get_variable': return b.fields?.VAR_NAME || 'var';
      default: return b.type;
    }
  }

  const lines = [];

  function formatStatement(block, indent = '') {
    let curr = block;
    while (curr) {
      if (!curr.type) break;

      switch (curr.type) {
        case 'control_if':
          lines.push(`${indent}IF ${formatValue(curr.inputs?.CONDITION)} THEN`);
          if (curr.inputs?.DO?.block) {
            formatStatement(curr.inputs.DO.block, indent + '  ');
          }
          lines.push(`${indent}END`);
          break;

        case 'control_if_else':
          lines.push(`${indent}IF ${formatValue(curr.inputs?.CONDITION)} THEN`);
          if (curr.inputs?.DO?.block) {
            formatStatement(curr.inputs.DO.block, indent + '  ');
          }
          lines.push(`${indent}ELSE`);
          if (curr.inputs?.ELSE?.block) {
            formatStatement(curr.inputs.ELSE.block, indent + '  ');
          }
          lines.push(`${indent}END`);
          break;

        case 'mem_set_variable':
          lines.push(`${indent}SET ${curr.fields?.VAR_NAME || 'x'} = ${formatValue(curr.inputs?.VALUE)}`);
          break;

        case 'mem_increment_counter':
          lines.push(`${indent}INCREMENT ${curr.fields?.VAR_NAME || 'counter'} BY ${formatValue(curr.inputs?.BY) || '1'}`);
          break;

        case 'mem_run_once':
          lines.push(`${indent}RUN ONCE PER ROUND:`);
          if (curr.inputs?.DO?.block) {
            formatStatement(curr.inputs.DO.block, indent + '  ');
          }
          lines.push(`${indent}END RUN ONCE`);
          break;

        case 'action_open_long':
          lines.push(`${indent}open_long(${formatValue(curr.inputs?.SIZE) || '25'}% at ${formatValue(curr.inputs?.LEVERAGE) || '5'}x)`);
          break;

        case 'action_open_short':
          lines.push(`${indent}open_short(${formatValue(curr.inputs?.SIZE) || '25'}% at ${formatValue(curr.inputs?.LEVERAGE) || '5'}x)`);
          break;

        case 'action_close_position':
          lines.push(`${indent}close_position()`);
          break;

        case 'action_reduce_position':
          lines.push(`${indent}reduce_position(${formatValue(curr.inputs?.PERCENT) || '50'}%)`);
          break;

        case 'action_set_stop_loss':
          lines.push(`${indent}set_stop_loss(${formatValue(curr.inputs?.PERCENT) || '5'}%)`);
          break;

        case 'action_set_take_profit':
          lines.push(`${indent}set_take_profit(${formatValue(curr.inputs?.PERCENT) || '10'}%)`);
          break;

        case 'action_set_leverage':
          lines.push(`${indent}set_leverage(${formatValue(curr.inputs?.LEVERAGE) || '5'}x)`);
          break;

        case 'action_borrow_amount':
          lines.push(`${indent}borrow_amount($${formatValue(curr.inputs?.AMOUNT) || '1000'})`);
          break;

        case 'action_repay_amount':
          lines.push(`${indent}repay_amount($${formatValue(curr.inputs?.AMOUNT) || '1000'})`);
          break;

        default:
          break;
      }

      curr = curr.next?.block;
    }
  }

  const rootBlocks = getRootBlocks(strategyJson);
  for (const b of rootBlocks) {
    formatStatement(b, '');
  }

  return lines.length > 0 ? lines.join('\n') : '// Empty workspace';
}

/**
 * Starter Templates (Moving Average Crossover, RSI Mean Reversion, Trailing Stop)
 */
export const STARTER_TEMPLATES = {
  ma_crossover: {
    name: 'Moving Average Crossover',
    description: 'Goes Long when fast SMA(10) crosses above SMA(30); closes when it crosses below.',
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'control_if',
          id: 'ma_long_if',
          inputs: {
            CONDITION: {
              block: {
                type: 'comp_compare',
                id: 'ma_cross_up',
                fields: { OP: 'CROSSES_ABOVE' },
                inputs: {
                  A: { block: { type: 'val_sma', fields: { PERIOD: 10 } } },
                  B: { block: { type: 'val_sma', fields: { PERIOD: 30 } } }
                }
              }
            },
            DO: {
              block: {
                type: 'action_open_long',
                id: 'ma_open_long',
                inputs: {
                  SIZE: { block: { type: 'val_number', fields: { NUM: 50 } } },
                  LEVERAGE: { block: { type: 'val_number', fields: { NUM: 5 } } }
                }
              }
            }
          },
          next: {
            block: {
              type: 'control_if',
              id: 'ma_close_if',
              inputs: {
                CONDITION: {
                  block: {
                    type: 'comp_compare',
                    id: 'ma_cross_down',
                    fields: { OP: 'CROSSES_BELOW' },
                    inputs: {
                      A: { block: { type: 'val_sma', fields: { PERIOD: 10 } } },
                      B: { block: { type: 'val_sma', fields: { PERIOD: 30 } } }
                    }
                  }
                },
                DO: {
                  block: {
                    type: 'action_close_position',
                    id: 'ma_close_act'
                  }
                }
              }
            }
          }
        }
      ]
    }
  },

  rsi_reversion: {
    name: 'RSI Mean Reversion',
    description: 'Buys dip when RSI < 30 and position is none; takes profit when RSI > 70.',
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'control_if',
          id: 'rsi_dip_if',
          inputs: {
            CONDITION: {
              block: {
                type: 'logic_operation',
                fields: { OP: 'AND' },
                inputs: {
                  A: {
                    block: {
                      type: 'comp_compare',
                      fields: { OP: 'LT' },
                      inputs: {
                        A: { block: { type: 'val_rsi', fields: { PERIOD: 14 } } },
                        B: { block: { type: 'val_number', fields: { NUM: 30 } } }
                      }
                    }
                  },
                  B: {
                    block: {
                      type: 'comp_compare',
                      fields: { OP: 'EQ' },
                      inputs: {
                        A: { block: { type: 'val_my_position_side' } },
                        B: { block: { type: 'val_position_side_choice', fields: { SIDE: 'none' } } }
                      }
                    }
                  }
                }
              }
            },
            DO: {
              block: {
                type: 'action_open_long',
                inputs: {
                  SIZE: { block: { type: 'val_number', fields: { NUM: 40 } } },
                  LEVERAGE: { block: { type: 'val_number', fields: { NUM: 8 } } }
                }
              }
            }
          },
          next: {
            block: {
              type: 'control_if',
              id: 'rsi_exit_if',
              inputs: {
                CONDITION: {
                  block: {
                    type: 'comp_compare',
                    fields: { OP: 'GT' },
                    inputs: {
                      A: { block: { type: 'val_rsi', fields: { PERIOD: 14 } } },
                      B: { block: { type: 'val_number', fields: { NUM: 70 } } }
                    }
                  }
                },
                DO: {
                  block: {
                    type: 'action_close_position'
                  }
                }
              }
            }
          }
        }
      ]
    }
  },

  trailing_stop: {
    name: 'Trailing Stop & Trend',
    description: 'Opens momentum Long on 5-tick surge, sets 6% Stop Loss and 18% Take Profit, exits if PnL turns negative after profit.',
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'control_if',
          id: 'ts_entry',
          inputs: {
            CONDITION: {
              block: {
                type: 'logic_operation',
                fields: { OP: 'AND' },
                inputs: {
                  A: {
                    block: {
                      type: 'comp_compare',
                      fields: { OP: 'GT' },
                      inputs: {
                        A: { block: { type: 'val_pct_change', fields: { LOOKBACK: 5 } } },
                        B: { block: { type: 'val_number', fields: { NUM: 1 } } }
                      }
                    }
                  },
                  B: {
                    block: {
                      type: 'comp_compare',
                      fields: { OP: 'EQ' },
                      inputs: {
                        A: { block: { type: 'val_my_position_side' } },
                        B: { block: { type: 'val_position_side_choice', fields: { SIDE: 'none' } } }
                      }
                    }
                  }
                }
              }
            },
            DO: {
              block: {
                type: 'action_open_long',
                inputs: {
                  SIZE: { block: { type: 'val_number', fields: { NUM: 50 } } },
                  LEVERAGE: { block: { type: 'val_number', fields: { NUM: 10 } } }
                },
                next: {
                  block: {
                    type: 'action_set_stop_loss',
                    inputs: {
                      PERCENT: { block: { type: 'val_number', fields: { NUM: 6 } } }
                    },
                    next: {
                      block: {
                        type: 'action_set_take_profit',
                        inputs: {
                          PERCENT: { block: { type: 'val_number', fields: { NUM: 18 } } }
                        }
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
  }
};
