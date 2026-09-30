import * as Blockly from 'blockly';

let blocksRegistered = false;

export const CUSTOM_BLOCKS = [
  // --- VALUES ---
  {
    type: 'val_price',
    message0: 'price',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Current market price'
  },
  {
    type: 'val_sma',
    message0: 'sma(%1)',
    args0: [
      { type: 'field_number', name: 'PERIOD', value: 14, min: 2, max: 200 }
    ],
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Simple Moving Average over N periods'
  },
  {
    type: 'val_ema',
    message0: 'ema(%1)',
    args0: [
      { type: 'field_number', name: 'PERIOD', value: 14, min: 2, max: 200 }
    ],
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Exponential Moving Average over N periods'
  },
  {
    type: 'val_rsi',
    message0: 'rsi(%1)',
    args0: [
      { type: 'field_number', name: 'PERIOD', value: 14, min: 2, max: 100 }
    ],
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Relative Strength Index (0-100)'
  },
  {
    type: 'val_pct_change',
    message0: '% change over %1 ticks',
    args0: [
      { type: 'field_number', name: 'LOOKBACK', value: 10, min: 1, max: 100 }
    ],
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Percentage price change over last N ticks'
  },
  {
    type: 'val_highest',
    message0: 'highest price over %1 ticks',
    args0: [
      { type: 'field_number', name: 'LOOKBACK', value: 10, min: 1, max: 100 }
    ],
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Highest price over last N ticks'
  },
  {
    type: 'val_lowest',
    message0: 'lowest price over %1 ticks',
    args0: [
      { type: 'field_number', name: 'LOOKBACK', value: 10, min: 1, max: 100 }
    ],
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Lowest price over last N ticks'
  },
  {
    type: 'val_my_cash',
    message0: 'my cash',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Your uninvested cash balance'
  },
  {
    type: 'val_my_equity',
    message0: 'my equity',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Your total live account equity'
  },
  {
    type: 'val_my_debt',
    message0: 'my debt',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Your current outstanding Bank loan debt'
  },
  {
    type: 'val_my_position_size',
    message0: 'my position count',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Number of active positions held'
  },
  {
    type: 'val_my_position_side',
    message0: 'my position side',
    output: 'String',
    colour: '#38bdf8',
    tooltip: 'Position side: "long", "short", or "none"'
  },
  {
    type: 'val_position_side_choice',
    message0: '%1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'SIDE',
        options: [
          ['"none"', 'none'],
          ['"long"', 'long'],
          ['"short"', 'short']
        ]
      }
    ],
    output: 'String',
    colour: '#38bdf8',
    tooltip: 'Select position side to compare'
  },
  {
    type: 'val_my_entry_price',
    message0: 'my entry price',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Average entry price of open position'
  },
  {
    type: 'val_my_pnl_percent',
    message0: 'my PnL %',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Live unrealized PnL percentage'
  },
  {
    type: 'val_seconds_left',
    message0: 'seconds left in round',
    output: 'Number',
    colour: '#38bdf8',
    tooltip: 'Time remaining before round ends'
  },
  {
    type: 'val_number',
    message0: '%1',
    args0: [
      { type: 'field_number', name: 'NUM', value: 0 }
    ],
    output: 'Number',
    colour: '#94a3b8',
    tooltip: 'Numeric constant'
  },

  // --- MATH ---
  {
    type: 'math_arithmetic',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['+', 'ADD'],
          ['-', 'SUBTRACT'],
          ['*', 'MULTIPLY'],
          ['/', 'DIVIDE'],
          ['min', 'MIN'],
          ['max', 'MAX']
        ]
      },
      { type: 'input_value', name: 'B', check: 'Number' }
    ],
    output: 'Number',
    colour: '#818cf8',
    tooltip: 'Math arithmetic operation'
  },
  {
    type: 'math_abs',
    message0: 'abs(%1)',
    args0: [
      { type: 'input_value', name: 'NUM', check: 'Number' }
    ],
    output: 'Number',
    colour: '#818cf8',
    tooltip: 'Absolute value'
  },

  // --- COMPARISON ---
  {
    type: 'comp_compare',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A' },
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['>', 'GT'],
          ['<', 'LT'],
          ['==', 'EQ'],
          ['!=', 'NEQ'],
          ['crosses above', 'CROSSES_ABOVE'],
          ['crosses below', 'CROSSES_BELOW']
        ]
      },
      { type: 'input_value', name: 'B' }
    ],
    output: 'Boolean',
    colour: '#34d399',
    tooltip: 'Comparison condition'
  },

  // --- LOGIC ---
  {
    type: 'logic_operation',
    message0: '%1 %2 %3',
    args0: [
      { type: 'input_value', name: 'A', check: 'Boolean' },
      {
        type: 'field_dropdown',
        name: 'OP',
        options: [
          ['AND', 'AND'],
          ['OR', 'OR']
        ]
      },
      { type: 'input_value', name: 'B', check: 'Boolean' }
    ],
    output: 'Boolean',
    colour: '#10b981',
    tooltip: 'Logical combine'
  },
  {
    type: 'logic_negate',
    message0: 'NOT %1',
    args0: [
      { type: 'input_value', name: 'BOOL', check: 'Boolean' }
    ],
    output: 'Boolean',
    colour: '#10b981',
    tooltip: 'Logical NOT'
  },

  // --- CONTROL ---
  {
    type: 'control_if',
    message0: 'IF %1 THEN',
    args0: [
      { type: 'input_value', name: 'CONDITION', check: 'Boolean' }
    ],
    message1: '%1',
    args1: [
      { type: 'input_statement', name: 'DO' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#c084fc',
    tooltip: 'Execute statements if condition evaluates to true'
  },
  {
    type: 'control_if_else',
    message0: 'IF %1 THEN',
    args0: [
      { type: 'input_value', name: 'CONDITION', check: 'Boolean' }
    ],
    message1: '%1',
    args1: [
      { type: 'input_statement', name: 'DO' }
    ],
    message2: 'ELSE',
    message3: '%1',
    args3: [
      { type: 'input_statement', name: 'ELSE' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#c084fc',
    tooltip: 'If condition is true execute DO, otherwise execute ELSE'
  },

  // --- MEMORY ---
  {
    type: 'mem_set_variable',
    message0: 'set variable %1 = %2',
    args0: [
      { type: 'field_input', name: 'VAR_NAME', text: 'targetPrice' },
      { type: 'input_value', name: 'VALUE', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#f472b6',
    tooltip: 'Set a private variable for this round'
  },
  {
    type: 'mem_get_variable',
    message0: 'get variable %1',
    args0: [
      { type: 'field_input', name: 'VAR_NAME', text: 'targetPrice' }
    ],
    output: 'Number',
    colour: '#f472b6',
    tooltip: 'Get value of private variable'
  },
  {
    type: 'mem_increment_counter',
    message0: 'increment %1 by %2',
    args0: [
      { type: 'field_input', name: 'VAR_NAME', text: 'ticksPassed' },
      { type: 'input_value', name: 'BY', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#f472b6',
    tooltip: 'Increment a counter variable'
  },
  {
    type: 'mem_run_once',
    message0: 'RUN ONCE PER ROUND:',
    message1: '%1',
    args1: [
      { type: 'input_statement', name: 'DO' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#ec4899',
    tooltip: 'Execute inner statements exactly once during the round'
  },

  // --- ACTIONS ---
  {
    type: 'action_open_long',
    message0: 'open Long %1% size at %2x lev',
    args0: [
      { type: 'input_value', name: 'SIZE', check: 'Number' },
      { type: 'input_value', name: 'LEVERAGE', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#10b981',
    tooltip: 'Open a leveraged Long position'
  },
  {
    type: 'action_open_short',
    message0: 'open Short %1% size at %2x lev',
    args0: [
      { type: 'input_value', name: 'SIZE', check: 'Number' },
      { type: 'input_value', name: 'LEVERAGE', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#ef4444',
    tooltip: 'Open a leveraged Short position'
  },
  {
    type: 'action_close_position',
    message0: 'close position',
    previousStatement: null,
    nextStatement: null,
    colour: '#f97316',
    tooltip: 'Close your open position'
  },
  {
    type: 'action_reduce_position',
    message0: 'reduce position by %1%',
    args0: [
      { type: 'input_value', name: 'PERCENT', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#f97316',
    tooltip: 'Reduce or take partial profit on position'
  },
  {
    type: 'action_set_stop_loss',
    message0: 'set stop loss at %1%',
    args0: [
      { type: 'input_value', name: 'PERCENT', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#eab308',
    tooltip: 'Set stop loss percentage'
  },
  {
    type: 'action_set_take_profit',
    message0: 'set take profit at %1%',
    args0: [
      { type: 'input_value', name: 'PERCENT', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#eab308',
    tooltip: 'Set take profit percentage'
  },
  {
    type: 'action_set_leverage',
    message0: 'set leverage to %1x',
    args0: [
      { type: 'input_value', name: 'LEVERAGE', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#eab308',
    tooltip: 'Set leverage multiple'
  },
  {
    type: 'action_borrow_amount',
    message0: 'borrow $%1 from Bank',
    args0: [
      { type: 'input_value', name: 'AMOUNT', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#a855f7',
    tooltip: 'Borrow loan cash from Bank'
  },
  {
    type: 'action_repay_amount',
    message0: 'repay $%1 Bank debt',
    args0: [
      { type: 'input_value', name: 'AMOUNT', check: 'Number' }
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#a855f7',
    tooltip: 'Repay debt to Bank'
  }
];

export function registerCustomTradingBlocks() {
  if (blocksRegistered) return;
  Blockly.common.defineBlocksWithJsonArray(CUSTOM_BLOCKS);
  blocksRegistered = true;
}

export const TOOLBOX_XML = `
<xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
  <category name="Values" colour="#38bdf8">
    <block type="val_price"></block>
    <block type="val_sma"><field name="PERIOD">14</field></block>
    <block type="val_ema"><field name="PERIOD">14</field></block>
    <block type="val_rsi"><field name="PERIOD">14</field></block>
    <block type="val_pct_change"><field name="LOOKBACK">10</field></block>
    <block type="val_highest"><field name="LOOKBACK">10</field></block>
    <block type="val_lowest"><field name="LOOKBACK">10</field></block>
    <block type="val_my_cash"></block>
    <block type="val_my_equity"></block>
    <block type="val_my_debt"></block>
    <block type="val_my_position_size"></block>
    <block type="val_my_position_side"></block>
    <block type="val_position_side_choice"></block>
    <block type="val_my_entry_price"></block>
    <block type="val_my_pnl_percent"></block>
    <block type="val_seconds_left"></block>
    <block type="val_number"><field name="NUM">10</field></block>
  </category>
  <category name="Math" colour="#818cf8">
    <block type="math_arithmetic">
      <value name="A"><shadow type="val_number"><field name="NUM">1</field></shadow></value>
      <value name="B"><shadow type="val_number"><field name="NUM">1</field></shadow></value>
    </block>
    <block type="math_abs">
      <value name="NUM"><shadow type="val_number"><field name="NUM">-5</field></shadow></value>
    </block>
  </category>
  <category name="Comparison" colour="#34d399">
    <block type="comp_compare">
      <value name="A"><shadow type="val_price"></shadow></value>
      <value name="B"><shadow type="val_sma"><field name="PERIOD">20</field></shadow></value>
    </block>
  </category>
  <category name="Logic" colour="#10b981">
    <block type="logic_operation"></block>
    <block type="logic_negate"></block>
  </category>
  <category name="Control" colour="#c084fc">
    <block type="control_if"></block>
    <block type="control_if_else"></block>
  </category>
  <category name="Memory" colour="#f472b6">
    <block type="mem_set_variable">
      <value name="VALUE"><shadow type="val_number"><field name="NUM">0</field></shadow></value>
    </block>
    <block type="mem_get_variable"></block>
    <block type="mem_increment_counter">
      <value name="BY"><shadow type="val_number"><field name="NUM">1</field></shadow></value>
    </block>
    <block type="mem_run_once"></block>
  </category>
  <category name="Actions" colour="#fb923c">
    <block type="action_open_long">
      <value name="SIZE"><shadow type="val_number"><field name="NUM">25</field></shadow></value>
      <value name="LEVERAGE"><shadow type="val_number"><field name="NUM">5</field></shadow></value>
    </block>
    <block type="action_open_short">
      <value name="SIZE"><shadow type="val_number"><field name="NUM">25</field></shadow></value>
      <value name="LEVERAGE"><shadow type="val_number"><field name="NUM">5</field></shadow></value>
    </block>
    <block type="action_close_position"></block>
    <block type="action_reduce_position">
      <value name="PERCENT"><shadow type="val_number"><field name="NUM">50</field></shadow></value>
    </block>
    <block type="action_set_stop_loss">
      <value name="PERCENT"><shadow type="val_number"><field name="NUM">5</field></shadow></value>
    </block>
    <block type="action_set_take_profit">
      <value name="PERCENT"><shadow type="val_number"><field name="NUM">15</field></shadow></value>
    </block>
    <block type="action_set_leverage">
      <value name="LEVERAGE"><shadow type="val_number"><field name="NUM">10</field></shadow></value>
    </block>
    <block type="action_borrow_amount">
      <value name="AMOUNT"><shadow type="val_number"><field name="NUM">1000</field></shadow></value>
    </block>
    <block type="action_repay_amount">
      <value name="AMOUNT"><shadow type="val_number"><field name="NUM">1000</field></shadow></value>
    </block>
  </category>
</xml>
`;

export function getDarkBlocklyTheme() {
  return Blockly.Theme.defineTheme('tradingDarkTheme', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#0d1015',
      toolboxBackgroundColour: '#12151b',
      toolboxForegroundColour: '#e2e8f0',
      flyoutBackgroundColour: '#171b23',
      flyoutForegroundColour: '#e2e8f0',
      flyoutOpacity: 0.95,
      scrollbarColour: '#2e3542',
      scrollbarOpacity: 0.6,
      insertionMarkerColour: '#38bdf8',
      insertionMarkerOpacity: 0.6
    }
  });
}
