import React, { useState } from 'react';
import { Lock, Plus, Trash2, CheckCircle, Sliders, ChevronRight } from 'lucide-react';

const PRESET_TEMPLATES = [
  { name: 'Trend Following', text: 'IF price > sma(20) AND position = none THEN buy 50% at 5x' },
  { name: 'Mean Reversion Dip', text: 'IF rsi(14) < 30 AND position = none THEN buy 50% at 10x' },
  { name: 'Momentum Short', text: 'IF pct_change(10) < -2 AND position = none THEN sell 25% at 5x' },
  { name: 'Take Profit 20%', text: 'IF pnl > 20 THEN close position' },
  { name: 'Stop Loss 10%', text: 'IF pnl < -10 THEN close position' },
  { name: 'Panic Exit at End', text: 'IF time_left < 10 THEN close position' }
];

export default function RulesTab({ rules = [], isLocked = false, onSaveRules }) {
  const [localRules, setLocalRules] = useState(() => {
    if (rules && rules.length > 0) {
      return rules.map(r => ({
        id: r.id || 'r_' + Math.random().toString(36).substring(2, 7),
        enabled: r.enabled !== false,
        text: r.rawText || (r.condition && r.action ? `IF ${r.rawText || 'condition'} THEN ${r.rawText || 'action'}` : 'IF price > sma(20) THEN buy 50% at 5x')
      }));
    }
    return [
      { id: 'r_1', enabled: true, text: 'IF price > sma(20) AND position = none THEN buy 50% at 5x' },
      { id: 'r_2', enabled: true, text: 'IF pnl > 25 THEN close position' }
    ];
  });

  // Visual builder state
  const [builderLeft, setBuilderLeft] = useState('price');
  const [builderOp, setBuilderOp] = useState('>');
  const [builderRight, setBuilderRight] = useState('sma(20)');
  const [useCompound, setUseCompound] = useState(true);
  const [compoundLogic, setCompoundLogic] = useState('AND');
  const [compoundLeft, setCompoundLeft] = useState('position');
  const [compoundOp, setCompoundOp] = useState('=');
  const [compoundRight, setCompoundRight] = useState('none');
  const [builderAction, setBuilderAction] = useState('buy 50% at 5x');

  // Generate constructed rule text
  const conditionPart1 = `${builderLeft} ${builderOp} ${builderRight}`;
  const conditionPart2 = useCompound ? ` ${compoundLogic} ${compoundLeft} ${compoundOp} ${compoundRight}` : '';
  const constructedRuleText = `IF ${conditionPart1}${conditionPart2} THEN ${builderAction}`;

  const handleToggle = (id) => {
    if (isLocked) return;
    const updated = localRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setLocalRules(updated);
    onSaveRules(updated.map(r => r.text));
  };

  const handleRemove = (id) => {
    if (isLocked) return;
    const updated = localRules.filter(r => r.id !== id);
    setLocalRules(updated);
    onSaveRules(updated.map(r => r.text));
  };

  const handleAddConstructedRule = () => {
    if (isLocked || localRules.length >= 5) return;
    const updated = [...localRules, { id: 'r_' + Date.now(), enabled: true, text: constructedRuleText }];
    setLocalRules(updated);
    onSaveRules(updated.map(r => r.text));
  };

  const handleAddTemplate = (text) => {
    if (isLocked || localRules.length >= 5) return;
    const updated = [...localRules, { id: 'r_' + Date.now(), enabled: true, text }];
    setLocalRules(updated);
    onSaveRules(updated.map(r => r.text));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {isLocked ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-hairline)',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <Lock size={14} style={{ color: 'var(--accent)' }} />
          <span>Bot rules are <strong>locked</strong> during active trading. Rules will automatically evaluate every tick.</span>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <span>Configure 3 to 5 automated rules. Evaluated server-side in order each tick.</span>
          <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{localRules.length}/5 slots</span>
        </div>
      )}

      {/* Active Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {localRules.map((rule, idx) => (
          <div
            key={rule.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: 'var(--bg-page)',
              border: `1px solid ${rule.enabled ? 'var(--border-subtle)' : 'var(--border-hairline)'}`,
              borderRadius: 'var(--radius-sm)',
              opacity: rule.enabled ? 1 : 0.6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>#{idx + 1}</span>
              <code style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: rule.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                wordBreak: 'break-all'
              }}>
                {rule.text}
              </code>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => handleToggle(rule.id)}
                className="btn-base"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: rule.enabled ? 'var(--accent-subtle)' : 'transparent',
                  color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)',
                  border: '1px solid var(--border-hairline)'
                }}
              >
                {rule.enabled ? 'Active' : 'Disabled'}
              </button>

              {!isLocked && (
                <button
                  type="button"
                  onClick={() => handleRemove(rule.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Remove rule"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Visual Rule Builder Dropdown Form (Available when unlocked) */}
      {!isLocked && localRules.length < 5 && (
        <div style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid var(--border-hairline)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <Sliders size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Visual Rule Builder
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Condition 1 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', minWidth: '24px' }}>IF</span>

              <select
                value={builderLeft}
                onChange={(e) => setBuilderLeft(e.target.value)}
                className="input-base"
                style={{ fontSize: '12px', padding: '6px 8px' }}
              >
                <option value="price">price</option>
                <option value="sma(10)">sma(10)</option>
                <option value="sma(20)">sma(20)</option>
                <option value="rsi(14)">rsi(14)</option>
                <option value="pct_change(10)">pct_change(10)</option>
                <option value="position">position</option>
                <option value="pnl">pnl %</option>
                <option value="time_left">time_left (sec)</option>
              </select>

              <select
                value={builderOp}
                onChange={(e) => setBuilderOp(e.target.value)}
                className="input-base"
                style={{ fontSize: '12px', padding: '6px 8px' }}
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="=">=</option>
                <option value="!=">!=</option>
              </select>

              <input
                type="text"
                value={builderRight}
                onChange={(e) => setBuilderRight(e.target.value)}
                placeholder="sma(20) or 50"
                className="input-base"
                style={{ fontSize: '12px', padding: '6px 8px', width: '100px' }}
              />

              <button
                type="button"
                onClick={() => setUseCompound(!useCompound)}
                className="btn-base btn-outline"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                {useCompound ? '- Remove Compound' : '+ Add AND/OR'}
              </button>
            </div>

            {/* Compound Condition 2 (Optional) */}
            {useCompound && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', paddingLeft: '32px' }}>
                <select
                  value={compoundLogic}
                  onChange={(e) => setCompoundLogic(e.target.value)}
                  className="input-base"
                  style={{ fontSize: '12px', padding: '6px 8px', fontWeight: 600, color: 'var(--accent)' }}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>

                <select
                  value={compoundLeft}
                  onChange={(e) => setCompoundLeft(e.target.value)}
                  className="input-base"
                  style={{ fontSize: '12px', padding: '6px 8px' }}
                >
                  <option value="position">position</option>
                  <option value="pnl">pnl %</option>
                  <option value="time_left">time_left</option>
                  <option value="rsi(14)">rsi(14)</option>
                  <option value="price">price</option>
                </select>

                <select
                  value={compoundOp}
                  onChange={(e) => setCompoundOp(e.target.value)}
                  className="input-base"
                  style={{ fontSize: '12px', padding: '6px 8px' }}
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>

                <input
                  type="text"
                  value={compoundRight}
                  onChange={(e) => setCompoundRight(e.target.value)}
                  placeholder="none, long, short or 0"
                  className="input-base"
                  style={{ fontSize: '12px', padding: '6px 8px', width: '100px' }}
                />
              </div>
            )}

            {/* Action */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', minWidth: '40px' }}>THEN</span>

              <select
                value={builderAction}
                onChange={(e) => setBuilderAction(e.target.value)}
                className="input-base"
                style={{ fontSize: '12px', padding: '6px 8px' }}
              >
                <option value="buy 50% at 5x">buy 50% at 5x</option>
                <option value="buy 25% at 10x">buy 25% at 10x</option>
                <option value="buy 100% at 2x">buy 100% at 2x</option>
                <option value="sell 50% at 5x">sell 50% at 5x</option>
                <option value="sell 25% at 10x">sell 25% at 10x</option>
                <option value="close position">close position</option>
                <option value="set stop loss 5%">set stop loss 5%</option>
                <option value="set take profit 15%">set take profit 15%</option>
              </select>

              <button
                type="button"
                onClick={handleAddConstructedRule}
                className="btn-base btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px', gap: '4px', marginLeft: 'auto' }}
              >
                <Plus size={13} /> Add Rule
              </button>
            </div>

            {/* Live Text Preview */}
            <div style={{
              marginTop: '4px',
              padding: '8px 10px',
              backgroundColor: 'var(--bg-page)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-hairline)',
              fontSize: '11px',
              color: 'var(--text-secondary)'
            }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Rule Preview:</span>
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {constructedRuleText}
              </code>
            </div>
          </div>

          {/* Quick Presets Strip */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-hairline)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Or Pick a Quick Preset:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESET_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => handleAddTemplate(tmpl.text)}
                  className="btn-base btn-outline"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  <Plus size={10} style={{ marginRight: '4px' }} /> {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
