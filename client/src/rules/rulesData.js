/**
 * Client-side Rule definitions, helpers, and templates.
 */

export const THING_OPTIONS = [
  { value: 'price', label: 'price', hasParam: false },
  { value: 'sma', label: 'sma(N)', hasParam: true, defaultParam: 20, paramLabel: 'N' },
  { value: 'ema', label: 'ema(N)', hasParam: true, defaultParam: 14, paramLabel: 'N' },
  { value: 'rsi', label: 'rsi(N)', hasParam: true, defaultParam: 14, paramLabel: 'N' },
  { value: 'pct_change', label: '% change(N)', hasParam: true, defaultParam: 10, paramLabel: 'N ticks' },
  { value: 'position', label: 'my position', hasParam: false },
  { value: 'pnl_pct', label: 'my PnL percent', hasParam: false },
  { value: 'seconds_left', label: 'seconds left in round', hasParam: false }
];

export const COMPARISON_OPTIONS = [
  { value: 'is_above', label: 'is above' },
  { value: 'is_below', label: 'is below' },
  { value: 'crosses_above', label: 'crosses above' },
  { value: 'crosses_below', label: 'crosses below' },
  { value: 'equals', label: 'equals' }
];

export const ACTION_OPTIONS = [
  { value: 'OPEN_LONG', label: 'open long' },
  { value: 'OPEN_SHORT', label: 'open short' },
  { value: 'CLOSE_POSITION', label: 'close position' },
  { value: 'SET_STOP_LOSS', label: 'set stop loss' },
  { value: 'SET_TAKE_PROFIT', label: 'set take profit' }
];

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

export function createNewDefaultRule(index = 1) {
  return {
    id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    enabled: true,
    cooldownTicks: 10,
    condition1: {
      left: { type: 'price' },
      operator: 'crosses_above',
      right: { type: 'sma', param: 20 }
    },
    hasAnd: true,
    condition2: {
      left: { type: 'position' },
      operator: 'equals',
      right: { type: 'position', value: 'none' }
    },
    action: {
      type: 'OPEN_LONG',
      sizePct: 25,
      leverage: 5,
      stopLossPct: null,
      takeProfitPct: null
    }
  };
}

export const RULE_TEMPLATES = {
  ma_crossover: {
    name: 'Moving Average Crossover',
    description: 'Opens Long on golden cross, Short on death cross, with position exits',
    rules: [
      {
        id: 't_ma_1',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'price' }, operator: 'crosses_above', right: { type: 'sma', param: 20 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
        action: { type: 'OPEN_LONG', sizePct: 25, leverage: 5 }
      },
      {
        id: 't_ma_2',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'price' }, operator: 'crosses_below', right: { type: 'sma', param: 20 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
        action: { type: 'CLOSE_POSITION' }
      },
      {
        id: 't_ma_3',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'price' }, operator: 'crosses_below', right: { type: 'sma', param: 20 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
        action: { type: 'OPEN_SHORT', sizePct: 25, leverage: 5 }
      },
      {
        id: 't_ma_4',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'price' }, operator: 'crosses_above', right: { type: 'sma', param: 20 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
        action: { type: 'CLOSE_POSITION' }
      }
    ]
  },
  rsi_dip: {
    name: 'RSI Dip Buy & Mean Reversion',
    description: 'Buys oversold RSI (<30), sells overbought RSI (>70)',
    rules: [
      {
        id: 't_rsi_1',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_below', right: { type: 'number', value: 30 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
        action: { type: 'OPEN_LONG', sizePct: 50, leverage: 5 }
      },
      {
        id: 't_rsi_2',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_above', right: { type: 'number', value: 70 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
        action: { type: 'CLOSE_POSITION' }
      },
      {
        id: 't_rsi_3',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_above', right: { type: 'number', value: 70 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } },
        action: { type: 'OPEN_SHORT', sizePct: 50, leverage: 5 }
      },
      {
        id: 't_rsi_4',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'rsi', param: 14 }, operator: 'is_below', right: { type: 'number', value: 30 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
        action: { type: 'CLOSE_POSITION' }
      }
    ]
  },
  stop_loss_take_profit: {
    name: 'Simple Stop Loss and Take Profit',
    description: 'Guards positions with -5% Stop Loss and +10% Take Profit',
    rules: [
      {
        id: 't_sltp_1',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'pnl_pct' }, operator: 'is_below', right: { type: 'number', value: -5 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
        action: { type: 'CLOSE_POSITION' }
      },
      {
        id: 't_sltp_2',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'pnl_pct' }, operator: 'is_above', right: { type: 'number', value: 10 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'long' } },
        action: { type: 'CLOSE_POSITION' }
      },
      {
        id: 't_sltp_3',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'pnl_pct' }, operator: 'is_below', right: { type: 'number', value: -5 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
        action: { type: 'CLOSE_POSITION' }
      },
      {
        id: 't_sltp_4',
        enabled: true,
        cooldownTicks: 10,
        condition1: { left: { type: 'pnl_pct' }, operator: 'is_above', right: { type: 'number', value: 10 } },
        hasAnd: true,
        condition2: { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'short' } },
        action: { type: 'CLOSE_POSITION' }
      }
    ]
  }
};
