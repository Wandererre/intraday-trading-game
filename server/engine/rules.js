import { calculateSMA, calculateEMA, calculateRSI, calculatePctChange } from './indicators.js';

/**
 * 5-Rule Simple Automation Engine (NO EVAL).
 * Supports:
 * - Things: price, sma(N), ema(N), rsi(N), pct_change(N), my position (none, long, short), my PnL percent, seconds left in round
 * - Comparisons: is above, is below, crosses above, crosses below, equals
 * - Actions: open long, open short, close position, set stop loss, set take profit
 * - Optional AND condition
 * - 10-tick cooldown per rule
 */

export const ALLOWED_THINGS = [
  'price',
  'sma',
  'ema',
  'rsi',
  'pct_change',
  'position',
  'pnl_pct',
  'seconds_left',
  'number'
];

export const ALLOWED_COMPARISONS = [
  'is_above',
  'is_below',
  'crosses_above',
  'crosses_below',
  'equals',
  '>',
  '<',
  '=='
];

export const ALLOWED_ACTIONS = [
  'OPEN_LONG',
  'OPEN_SHORT',
  'CLOSE_POSITION',
  'SET_STOP_LOSS',
  'SET_TAKE_PROFIT'
];

export function validateOperand(op) {
  if (!op || typeof op !== 'object') {
    throw new Error('Operand must be an object');
  }
  if (!ALLOWED_THINGS.includes(op.type)) {
    throw new Error(`Unknown operand type: "${op.type}"`);
  }
  if (['sma', 'ema', 'rsi', 'pct_change'].includes(op.type)) {
    const p = Number(op.param);
    if (!Number.isFinite(p) || p <= 0 || p > 200) {
      throw new Error(`Invalid period for ${op.type}: ${op.param}`);
    }
  }
  if (op.type === 'number') {
    const val = Number(op.value);
    if (!Number.isFinite(val)) {
      throw new Error(`Invalid number constant: ${op.value}`);
    }
  }
  if (op.type === 'position' && op.value) {
    const pos = String(op.value).toLowerCase();
    if (!['none', 'long', 'short'].includes(pos)) {
      throw new Error(`Invalid position target: "${op.value}"`);
    }
  }
  return true;
}

export function validateCondition(cond) {
  if (!cond || typeof cond !== 'object') {
    throw new Error('Condition must be an object');
  }
  validateOperand(cond.left);
  validateOperand(cond.right);

  const op = cond.operator;
  if (!ALLOWED_COMPARISONS.includes(op)) {
    throw new Error(`Invalid comparison operator: "${op}"`);
  }
  return true;
}

export function validateAction(act) {
  if (!act || typeof act !== 'object') {
    throw new Error('Action must be an object');
  }
  if (!ALLOWED_ACTIONS.includes(act.type)) {
    throw new Error(`Invalid action type: "${act.type}"`);
  }
  return true;
}

export function validateRule(rule) {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Rule must be an object');
  }
  validateCondition(rule.condition1);
  if (rule.hasAnd && rule.condition2) {
    validateCondition(rule.condition2);
  }
  validateAction(rule.action);
  return true;
}

export function validateRulesList(rules) {
  if (!Array.isArray(rules)) {
    throw new Error('Rules list must be an array');
  }
  if (rules.length > 5) {
    throw new Error(`Maximum 5 rules allowed, received ${rules.length}`);
  }
  const clean = [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    validateRule(r);
    clean.push({
      id: r.id || 'rule_' + (i + 1),
      enabled: r.enabled !== false,
      cooldownTicks: Math.max(1, Math.min(60, Number(r.cooldownTicks) || 10)),
      lastTriggeredTick: typeof r.lastTriggeredTick === 'number' ? r.lastTriggeredTick : -999,
      condition1: r.condition1,
      hasAnd: Boolean(r.hasAnd && r.condition2),
      condition2: r.hasAnd && r.condition2 ? r.condition2 : null,
      action: {
        type: r.action.type,
        sizePct: Math.min(100, Math.max(1, Number(r.action.sizePct) || 25)),
        leverage: Math.min(20, Math.max(1, Number(r.action.leverage) || 5)),
        stopLossPct: r.action.stopLossPct ? Math.abs(Number(r.action.stopLossPct)) : null,
        takeProfitPct: r.action.takeProfitPct ? Math.abs(Number(r.action.takeProfitPct)) : null
      }
    });
  }
  return clean;
}

/**
 * Resolves operand value against context.
 */
export function resolveOperand(operand, ctx, isPrev = false) {
  if (!operand) return null;
  const history = isPrev ? ctx.priceHistory.slice(0, -1) : ctx.priceHistory;
  const currentPrice = isPrev
    ? (history.length > 0 ? history[history.length - 1] : ctx.currentPrice)
    : ctx.currentPrice;

  switch (operand.type) {
    case 'number':
      return Number(operand.value ?? 0);
    case 'price':
      return currentPrice;
    case 'sma':
      return calculateSMA(history, operand.param || 20);
    case 'ema':
      return calculateEMA(history, operand.param || 14);
    case 'rsi':
      return calculateRSI(history, operand.param || 14);
    case 'pct_change':
      return calculatePctChange(history, operand.param || 10);
    case 'position': {
      const pos = ctx.player?.position;
      if (!pos) return 'none';
      return String(pos.side).toLowerCase();
    }
    case 'pnl_pct': {
      const pos = ctx.player?.position;
      if (!pos) return 0;
      const { side, entryPrice, leverage } = pos;
      const priceDiff = side === 'LONG' ? (currentPrice - entryPrice) : (entryPrice - currentPrice);
      return (priceDiff / entryPrice) * (leverage || 1) * 100;
    }
    case 'seconds_left':
      return isPrev ? (ctx.timeLeftSec + 1) : ctx.timeLeftSec;
    default:
      if (typeof operand.value !== 'undefined') return operand.value;
      return null;
  }
}

/**
 * Evaluates a single comparison condition against context.
 */
export function evaluateCondition(cond, ctx) {
  if (!cond) return false;
  if (!cond.left || !cond.right) {
    throw new Error('Condition requires both left and right operands');
  }
  const op = cond.operator;
  if (!ALLOWED_COMPARISONS.includes(op)) {
    throw new Error(`Invalid comparison operator: "${op}"`);
  }

  // Handle crosses
  if (op === 'crosses_above' || op === 'crosses_below') {
    if (!ctx.priceHistory || ctx.priceHistory.length < 2) return false;

    const prevLeft = resolveOperand(cond.left, ctx, true);
    const prevRight = resolveOperand(cond.right, ctx, true);
    const currLeft = resolveOperand(cond.left, ctx, false);
    const currRight = resolveOperand(cond.right, ctx, false);

    if (prevLeft === null || prevRight === null || currLeft === null || currRight === null) {
      return false;
    }

    if (op === 'crosses_above') {
      return prevLeft <= prevRight && currLeft > currRight;
    } else {
      return prevLeft >= prevRight && currLeft < currRight;
    }
  }

  // Standard comparisons
  const leftVal = resolveOperand(cond.left, ctx, false);
  const rightVal = resolveOperand(cond.right, ctx, false);

  if (leftVal === null || rightVal === null) return false;

  if (cond.left.type === 'position' || cond.right.type === 'position') {
    const lStr = String(leftVal).toLowerCase();
    const rStr = String(rightVal).toLowerCase();
    return lStr === rStr;
  }

  switch (op) {
    case 'is_above':
    case '>':
      return leftVal > rightVal;
    case 'is_below':
    case '<':
      return leftVal < rightVal;
    case 'equals':
    case '==':
      return Math.abs(Number(leftVal) - Number(rightVal)) < 0.0001;
    default:
      return false;
  }
}

/**
 * Plain-English generator for human readability.
 */
export function operandToEnglish(op) {
  if (!op) return '';
  switch (op.type) {
    case 'price': return 'price';
    case 'sma': return `sma(${op.param || 20})`;
    case 'ema': return `ema(${op.param || 14})`;
    case 'rsi': return `rsi(${op.param || 14})`;
    case 'pct_change': return `percent change over ${op.param || 10} ticks`;
    case 'position': return 'position';
    case 'pnl_pct': return 'my PnL percent';
    case 'seconds_left': return 'seconds left in round';
    case 'number': return `${op.value ?? 0}`;
    default: return String(op.value || op.type);
  }
}

export function conditionToEnglish(cond) {
  if (!cond || !cond.left || !cond.right) return '';
  const leftStr = operandToEnglish(cond.left);
  let opStr = 'equals';
  if (cond.operator === 'is_above' || cond.operator === '>') opStr = 'is above';
  else if (cond.operator === 'is_below' || cond.operator === '<') opStr = 'is below';
  else if (cond.operator === 'crosses_above') opStr = 'crosses above';
  else if (cond.operator === 'crosses_below') opStr = 'crosses below';
  else if (cond.operator === 'equals' || cond.operator === '==') {
    opStr = cond.left.type === 'position' ? 'is' : 'equals';
  }

  let rightStr = operandToEnglish(cond.right);
  if (cond.left.type === 'position') {
    rightStr = String(cond.right.value || 'none');
  }
  return `${leftStr} ${opStr} ${rightStr}`;
}

export function actionToEnglish(act) {
  if (!act) return '';
  switch (act.type) {
    case 'OPEN_LONG': {
      let str = `open long ${act.sizePct || 25}% at ${act.leverage || 5}x`;
      if (act.stopLossPct) str += `, SL ${act.stopLossPct}%`;
      if (act.takeProfitPct) str += `, TP ${act.takeProfitPct}%`;
      return str;
    }
    case 'OPEN_SHORT': {
      let str = `open short ${act.sizePct || 25}% at ${act.leverage || 5}x`;
      if (act.stopLossPct) str += `, SL ${act.stopLossPct}%`;
      if (act.takeProfitPct) str += `, TP ${act.takeProfitPct}%`;
      return str;
    }
    case 'CLOSE_POSITION':
      return 'close position';
    case 'SET_STOP_LOSS':
      return `set stop loss ${act.stopLossPct || 5}%`;
    case 'SET_TAKE_PROFIT':
      return `set take profit ${act.takeProfitPct || 10}%`;
    default:
      return act.type;
  }
}

export function ruleToEnglish(rule) {
  if (!rule) return '';
  const cond1Str = conditionToEnglish(rule.condition1);
  const cond2Str = (rule.hasAnd && rule.condition2) ? ` AND ${conditionToEnglish(rule.condition2)}` : '';
  const actStr = actionToEnglish(rule.action);
  return `IF ${cond1Str}${cond2Str} THEN ${actStr}`;
}

/**
 * Three one-click templates:
 * 1. moving average crossover
 * 2. RSI dip buy
 * 3. simple stop loss and take profit
 */
export const RULE_TEMPLATES = {
  ma_crossover: [
    {
      id: 'template_ma_1',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'price' }, operator: 'crosses_above', right: { type: 'sma', param: 20 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
      action: { type: 'OPEN_LONG', sizePct: 25, leverage: 5 }
    },
    {
      id: 'template_ma_2',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'price' }, operator: 'crosses_below', right: { type: 'sma', param: 20 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
      action: { type: 'CLOSE_POSITION' }
    },
    {
      id: 'template_ma_3',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'price' }, operator: 'crosses_below', right: { type: 'sma', param: 20 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
      action: { type: 'OPEN_SHORT', sizePct: 25, leverage: 5 }
    },
    {
      id: 'template_ma_4',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'price' }, operator: 'crosses_above', right: { type: 'sma', param: 20 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
      action: { type: 'CLOSE_POSITION' }
    }
  ],
  rsi_dip: [
    {
      id: 'template_rsi_1',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_below', right: { type: 'number', value: 30 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
      action: { type: 'OPEN_LONG', sizePct: 50, leverage: 5 }
    },
    {
      id: 'template_rsi_2',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_above', right: { type: 'number', value: 70 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
      action: { type: 'CLOSE_POSITION' }
    },
    {
      id: 'template_rsi_3',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_above', right: { type: 'number', value: 70 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
      action: { type: 'OPEN_SHORT', sizePct: 50, leverage: 5 }
    },
    {
      id: 'template_rsi_4',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_below', right: { type: 'number', value: 30 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
      action: { type: 'CLOSE_POSITION' }
    }
  ],
  stop_loss_take_profit: [
    {
      id: 'template_sltp_1',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'pnl_pct' }, operator: 'is_below', right: { type: 'number', value: -5 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
      action: { type: 'CLOSE_POSITION' }
    },
    {
      id: 'template_sltp_2',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'pnl_pct' }, operator: 'is_above', right: { type: 'number', value: 10 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
      action: { type: 'CLOSE_POSITION' }
    },
    {
      id: 'template_sltp_3',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'pnl_pct' }, operator: 'is_below', right: { type: 'number', value: -5 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
      action: { type: 'CLOSE_POSITION' }
    },
    {
      id: 'template_sltp_4',
      enabled: true,
      cooldownTicks: 10,
      condition1: { left: { type: 'pnl_pct' }, operator: 'is_above', right: { type: 'number', value: 10 } },
      hasAnd: true,
      condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
      action: { type: 'CLOSE_POSITION' }
    }
  ]
};

export function parseOperandText(token) {
  token = (token || '').trim();
  if (!token) throw new Error('Empty operand');
  const num = Number(token);
  if (!Number.isNaN(num)) {
    return { type: 'number', value: num };
  }
  const lower = token.toLowerCase();
  if (['none', 'long', 'short'].includes(lower)) {
    return { type: 'position', value: lower };
  }
  if (lower === 'price') return { type: 'price' };
  if (lower === 'position') return { type: 'position' };
  if (lower === 'pnl' || lower === 'pnl_pct') return { type: 'pnl_pct' };
  if (lower === 'seconds_left' || lower === 'time_left') return { type: 'seconds_left' };

  const fnMatch = lower.match(/^([a-z_]+)\((\d+)\)$/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const param = parseInt(fnMatch[2], 10);
    if (['sma', 'ema', 'rsi', 'pct_change'].includes(fnName)) {
      return { type: fnName, param };
    }
  }
  throw new Error(`Invalid operand: "${token}"`);
}

export function parseComparisonText(expr) {
  const match = expr.match(/^(.*?)\s*(crosses\s+above|crosses\s+below|is\s+above|is\s+below|equals|>=|<=|==|!=|>|<|=)\s*(.*?)$/i);
  if (!match) throw new Error(`Cannot parse comparison: "${expr}"`);
  const [, leftStr, rawOp, rightStr] = match;
  let op = rawOp.toLowerCase().replace(/\s+/g, '_');
  if (op === '=') op = 'equals';
  if (op === '==') op = 'equals';
  if (op === '>') op = 'is_above';
  if (op === '<') op = 'is_below';

  return {
    left: parseOperandText(leftStr),
    operator: op,
    right: parseOperandText(rightStr)
  };
}

export function parseRuleText(text) {
  const match = text.trim().match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);
  if (!match) {
    throw new Error(`Rule must start with "IF ... THEN ...": "${text}"`);
  }
  const condText = match[1].trim();
  const actText = match[2].trim();

  let condition1 = null;
  let hasAnd = false;
  let condition2 = null;

  const andSplit = condText.split(/\s+AND\s+/i);
  if (andSplit.length > 1) {
    condition1 = parseComparisonText(andSplit[0]);
    hasAnd = true;
    condition2 = parseComparisonText(andSplit[1]);
  } else {
    condition1 = parseComparisonText(condText);
  }

  // Parse action
  const lowerAct = actText.toLowerCase();
  let action = null;
  if (lowerAct === 'close' || lowerAct === 'close position') {
    action = { type: 'CLOSE_POSITION' };
  } else {
    const buyMatch = actText.match(/^(?:open\s+long|buy)\s+(\d+)%?(?:\s+at\s+(\d+)x)?/i);
    const sellMatch = actText.match(/^(?:open\s+short|sell)\s+(\d+)%?(?:\s+at\s+(\d+)x)?/i);
    const slMatch = actText.match(/^set\s+stop\s*loss\s+(-?\d+)%?/i);
    const tpMatch = actText.match(/^set\s+take\s*profit\s+(\d+)%?/i);

    if (buyMatch) {
      action = {
        type: 'OPEN_LONG',
        sizePct: parseInt(buyMatch[1], 10),
        leverage: buyMatch[2] ? parseInt(buyMatch[2], 10) : 5
      };
    } else if (sellMatch) {
      action = {
        type: 'OPEN_SHORT',
        sizePct: parseInt(sellMatch[1], 10),
        leverage: sellMatch[2] ? parseInt(sellMatch[2], 10) : 5
      };
    } else if (slMatch) {
      action = { type: 'SET_STOP_LOSS', stopLossPct: Math.abs(parseInt(slMatch[1], 10)) };
    } else if (tpMatch) {
      action = { type: 'SET_TAKE_PROFIT', takeProfitPct: parseInt(tpMatch[1], 10) };
    } else {
      throw new Error(`Invalid action: "${actText}"`);
    }
  }

  const rule = {
    id: 'rule_' + Math.random().toString(36).substring(2, 7),
    enabled: true,
    cooldownTicks: 10,
    condition1,
    hasAnd,
    condition2,
    action,
    rawText: text.trim()
  };
  validateRule(rule);
  return rule;
}

export function ruleToText(rule) {
  return ruleToEnglish(rule);
}

