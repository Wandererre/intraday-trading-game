/**
 * Client-side pseudo-code generator and block counter for Blockly workspaces.
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

export function getRootBlocks(strategyJson) {
  if (!strategyJson) return [];
  if (Array.isArray(strategyJson)) return strategyJson;
  if (strategyJson.blocks && Array.isArray(strategyJson.blocks.blocks)) {
    return strategyJson.blocks.blocks;
  }
  if (strategyJson.blocks && Array.isArray(strategyJson.blocks)) {
    return strategyJson.blocks;
  }
  return [];
}

export function validateStrategy(strategyJson, maxAllowedBlocks = 20) {
  if (!strategyJson) {
    return { valid: true, blockCount: 0 };
  }

  const count = countBlocks(strategyJson);
  if (count > maxAllowedBlocks) {
    return {
      valid: false,
      blockCount: count,
      error: `Block budget exceeded: using ${count} blocks (cap is ${maxAllowedBlocks})`
    };
  }

  return { valid: true, blockCount: count };
}

export function generatePseudoCode(strategyJson) {
  if (!strategyJson) return '// No active blocks in workspace';

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
      case 'val_my_position_size': return 'my_position_count';
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
