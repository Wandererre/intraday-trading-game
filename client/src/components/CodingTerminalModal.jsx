import React, { useState, useEffect } from 'react';
import BeginnerManualModal from './BeginnerManualModal.jsx';
import {
  THING_OPTIONS,
  COMPARISON_OPTIONS,
  ACTION_OPTIONS,
  ruleToEnglish,
  createNewDefaultRule,
  RULE_TEMPLATES
} from '../rules/rulesData.js';

export default function CodingTerminalModal({
  isOpen,
  onClose,
  onSaveRules,
  rules = [],
  isRoundActive = false,
  roundIndex = 0,
  totalRounds = 3,
  timeLeftSec = 0,
  currentPrice = 0,
  liveEquity = 10000,
  automationEnabled = true,
  onToggleAutomation
}) {
  const [localRules, setLocalRules] = useState([]);
  const [showManual, setShowManual] = useState(false);

  // Sync with prop rules when opened or updated
  useEffect(() => {
    if (rules && rules.length > 0) {
      setLocalRules(JSON.parse(JSON.stringify(rules)));
    } else {
      const saved = localStorage.getItem('arena_user_rules');
      if (saved) {
        try {
          setLocalRules(JSON.parse(saved));
          return;
        } catch (e) {}
      }
      // Default to moving average crossover template
      setLocalRules(JSON.parse(JSON.stringify(RULE_TEMPLATES.ma_crossover.rules)));
    }
  }, [isOpen, rules]);

  if (!isOpen) return null;

  const handleUpdateRule = (index, updated) => {
    if (isRoundActive) return;
    setLocalRules(prev => {
      const next = [...prev];
      next[index] = updated;
      localStorage.setItem('arena_user_rules', JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteRule = (index) => {
    if (isRoundActive) return;
    setLocalRules(prev => {
      const next = prev.filter((_, i) => i !== index);
      localStorage.setItem('arena_user_rules', JSON.stringify(next));
      return next;
    });
  };

  const handleAddRule = () => {
    if (isRoundActive || localRules.length >= 5) return;
    setLocalRules(prev => {
      const next = [...prev, createNewDefaultRule(prev.length + 1)];
      localStorage.setItem('arena_user_rules', JSON.stringify(next));
      return next;
    });
  };

  const handleLoadTemplate = (templateKey) => {
    if (isRoundActive) return;
    const template = RULE_TEMPLATES[templateKey];
    if (template && template.rules) {
      const cloned = JSON.parse(JSON.stringify(template.rules));
      setLocalRules(cloned);
      localStorage.setItem('arena_user_rules', JSON.stringify(cloned));
    }
  };

  const handleSaveAndDeploy = () => {
    if (onSaveRules) {
      onSaveRules(localRules);
    }
    localStorage.setItem('arena_user_rules', JSON.stringify(localRules));
    onClose();
  };

  const deltaVs10k = liveEquity - 10000;
  const isPosDelta = deltaVs10k >= 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
      backgroundColor: '#090b0e',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--text-primary)',
      fontFamily: 'Inter, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Top Header Bar */}
      <header style={{
        height: '56px',
        backgroundColor: '#12151b',
        borderBottom: '1px solid var(--border-hairline)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexShrink: 0
      }}>
        {/* Left: Branding & Templates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="8" fill="#1e1e1e" />
              <path d="M12 14L24 24L12 34" stroke="#4EC9B0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="24" y1="34" x2="36" y2="34" stroke="#e0e0e0" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em' }}>
              CODING TERMINAL
            </span>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-hairline)' }} />

          {/* 3 One-Click Starter Templates */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Templates:</span>
            <button
              type="button"
              onClick={() => handleLoadTemplate('ma_crossover')}
              disabled={isRoundActive}
              className="btn-base"
              style={{ padding: '5px 10px', fontSize: '11px', opacity: isRoundActive ? 0.5 : 1 }}
            >
              + MA Cross
            </button>
            <button
              type="button"
              onClick={() => handleLoadTemplate('rsi_dip')}
              disabled={isRoundActive}
              className="btn-base"
              style={{ padding: '5px 10px', fontSize: '11px', opacity: isRoundActive ? 0.5 : 1 }}
            >
              + RSI Dip Buy
            </button>
            <button
              type="button"
              onClick={() => handleLoadTemplate('stop_loss_take_profit')}
              disabled={isRoundActive}
              className="btn-base"
              style={{ padding: '5px 10px', fontSize: '11px', opacity: isRoundActive ? 0.5 : 1 }}
            >
              + SL & TP Guard
            </button>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-hairline)', margin: '0 2px' }} />

            {/* Beginner Manual Button */}
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="btn-base"
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              title="Beginner Guide: How rules and indicators work in plain layman terms"
            >
              <span style={{ fontSize: '12px' }}>📖</span>
              <span>Manual (Beginners)</span>
            </button>
          </div>
        </div>

        {/* Center: Rules Counter */}
        <div style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-hairline)',
          backgroundColor: 'var(--bg-page)',
          color: localRules.length >= 5 ? '#f59e0b' : 'var(--text-primary)'
        }}>
          Rules: <strong>{localRules.length}</strong> / 5
        </div>

        {/* Right: Round Timer, Live Equity, Automation Toggle & Clear Visible Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Round Timer */}
          <div style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-hairline)',
            fontSize: '11px'
          }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
              Round {roundIndex + 1}/{totalRounds}:
            </span>
            <strong style={{ color: timeLeftSec <= 15 && isRoundActive ? '#ef4444' : 'var(--text-primary)' }}>
              {isRoundActive ? `${timeLeftSec}s` : 'Between Rounds'}
            </strong>
          </div>

          {/* Live Equity */}
          <div style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-hairline)',
            fontSize: '11px'
          }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Equity:</span>
            <strong style={{ color: 'var(--text-primary)' }}>
              ${Math.round(liveEquity).toLocaleString()}
            </strong>
            <span className="tabular-nums" style={{
              marginLeft: '6px',
              fontWeight: 600,
              color: isPosDelta ? 'var(--color-long)' : 'var(--color-short)'
            }}>
              (Δ {isPosDelta ? '+' : ''}${Math.round(deltaVs10k).toLocaleString()})
            </span>
          </div>

          {/* Automation ON / OFF Toggle */}
          {onToggleAutomation && (
            <button
              type="button"
              onClick={() => onToggleAutomation(!automationEnabled)}
              className="btn-base"
              style={{
                fontSize: '11px',
                padding: '6px 12px',
                fontWeight: 700,
                backgroundColor: automationEnabled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                borderColor: automationEnabled ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                color: automationEnabled ? 'var(--color-long)' : 'var(--color-short)'
              }}
            >
              Automation: {automationEnabled ? '● ON' : '⏸ OFF'}
            </button>
          )}

          {/* Save & Deploy Button */}
          {!isRoundActive && (
            <button
              type="button"
              onClick={handleSaveAndDeploy}
              className="btn-base btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 700 }}
            >
              Save & Deploy Rules
            </button>
          )}

          {/* Clear, High-Contrast CLOSE Button */}
          <button
            type="button"
            onClick={onClose}
            className="btn-base"
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#334155',
              border: '1px solid #94a3b8',
              color: '#ffffff',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#475569';
              e.currentTarget.style.borderColor = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            title="Close Terminal (returns to game)"
          >
            <span style={{ fontSize: '13px', fontWeight: 900 }}>✕</span>
            <span>CLOSE</span>
          </button>
        </div>
      </header>

      {/* Info / Lock Banner */}
      {isRoundActive ? (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '8px 20px',
          fontSize: '12px',
          color: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            🔒 <strong>RULES LOCKED DURING ACTIVE ROUND</strong> — Rules can only be edited between rounds. You can toggle <strong>Automation ON / OFF</strong> above to pause or resume trading at any time.
          </div>
          <span style={{ fontSize: '11px', opacity: 0.85 }}>All rule trades are tagged with "BOT" in Trade Feed</span>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '8px 20px',
          fontSize: '12px',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            ⚡ <strong>SETUP AUTOMATION (MAX 5 RULES)</strong> — Build simple automated trading rules below using dropdowns. Rules execute top-to-bottom every tick with a 10-tick anti-spam cooldown.
          </div>
          <span style={{ fontSize: '11px', opacity: 0.85 }}>Manual trading remains available while rules run</span>
        </div>
      )}

      {/* Main Rules Container */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {localRules.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No Automation Rules Set</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Choose a starter template above or click below to build your first rule in seconds.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleLoadTemplate('ma_crossover')}
                className="btn-base btn-primary"
                style={{ padding: '8px 16px' }}
              >
                Load MA Crossover Template
              </button>
              <button
                type="button"
                onClick={handleAddRule}
                className="btn-base btn-outline"
                style={{ padding: '8px 16px' }}
              >
                + Create Custom Rule
              </button>
            </div>
          </div>
        ) : (
          localRules.map((rule, idx) => (
            <RuleCard
              key={rule.id || `rule_${idx}`}
              index={idx}
              rule={rule}
              isLocked={isRoundActive}
              onUpdate={(updated) => handleUpdateRule(idx, updated)}
              onDelete={() => handleDeleteRule(idx)}
            />
          ))
        )}

        {/* Add Rule Button (if < 5 rules and not locked) */}
        {!isRoundActive && localRules.length < 5 && (
          <button
            type="button"
            onClick={handleAddRule}
            className="btn-base"
            style={{
              padding: '12px',
              border: '1px dashed var(--border-hairline)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              color: 'var(--accent)',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>+</span>
            <span>Add Rule ({localRules.length + 1} of 5)</span>
          </button>
        )}
      </main>

      {/* Layman Beginner Manual Overlay */}
      <BeginnerManualModal
        isOpen={showManual}
        onClose={() => setShowManual(false)}
      />
    </div>
  );
}

/**
 * Individual Rule Card Component
 */
function RuleCard({ index, rule, isLocked, onUpdate, onDelete }) {
  const cond1 = rule.condition1 || { left: { type: 'price' }, operator: 'crosses_above', right: { type: 'sma', param: 20 } };
  const cond2 = rule.condition2 || { left: { type: 'position' }, operator: 'equals', right: { type: 'position', value: 'none' } };
  const act = rule.action || { type: 'OPEN_LONG', sizePct: 25, leverage: 5 };

  const handleCond1Change = (newCond) => {
    onUpdate({ ...rule, condition1: newCond });
  };

  const handleCond2Change = (newCond) => {
    onUpdate({ ...rule, condition2: newCond });
  };

  const handleToggleAnd = (hasAnd) => {
    onUpdate({
      ...rule,
      hasAnd,
      condition2: hasAnd ? cond2 : null
    });
  };

  const handleActionChange = (newAct) => {
    onUpdate({ ...rule, action: newAct });
  };

  const handleToggleEnabled = () => {
    if (isLocked) return;
    onUpdate({ ...rule, enabled: !rule.enabled });
  };

  const englishPreview = ruleToEnglish(rule);

  return (
    <div className="card" style={{
      padding: '16px 20px',
      backgroundColor: '#12151b',
      border: '1px solid var(--border-hairline)',
      opacity: rule.enabled ? 1 : 0.6
    }}>
      {/* Row Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--accent)',
            backgroundColor: 'var(--accent-subtle)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)'
          }}>
            RULE {index + 1}
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: isLocked ? 'default' : 'pointer' }}>
            <input
              type="checkbox"
              checked={rule.enabled !== false}
              onChange={handleToggleEnabled}
              disabled={isLocked}
              style={{ accentColor: 'var(--color-long)' }}
            />
            <span style={{ color: rule.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {rule.enabled ? 'Enabled' : 'Paused'}
            </span>
          </label>
        </div>

        {/* Delete Button */}
        {!isLocked && (
          <button
            type="button"
            onClick={onDelete}
            className="btn-base"
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              color: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)'
            }}
            title="Delete this rule"
          >
            ✕ Delete
          </button>
        )}
      </div>

      {/* Main Condition Builder Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        backgroundColor: '#090b0e',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-hairline)',
        fontSize: '12px'
      }}>
        {/* IF label */}
        <span style={{ fontWeight: 700, color: 'var(--accent)', padding: '0 4px' }}>IF</span>

        {/* Condition 1 */}
        <ConditionRow
          condition={cond1}
          isLocked={isLocked}
          onChange={handleCond1Change}
        />

        {/* Optional AND Checkbox / Condition 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'default' : 'pointer', fontSize: '11px', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={Boolean(rule.hasAnd)}
              onChange={(e) => handleToggleAnd(e.target.checked)}
              disabled={isLocked}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ color: rule.hasAnd ? 'var(--accent)' : 'var(--text-muted)' }}>AND</span>
          </label>
        </div>

        {rule.hasAnd && (
          <ConditionRow
            condition={cond2}
            isLocked={isLocked}
            onChange={handleCond2Change}
          />
        )}

        {/* THEN label */}
        <span style={{ fontWeight: 700, color: 'var(--color-long)', padding: '0 4px' }}>THEN</span>

        {/* Action Controls */}
        <ActionRow
          action={act}
          isLocked={isLocked}
          onChange={handleActionChange}
        />
      </div>

      {/* Plain English Preview Bar */}
      <div style={{
        marginTop: '10px',
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 'var(--radius-sm)',
        borderLeft: '3px solid var(--accent)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preview:</span>
        <code style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          fontWeight: 600,
          color: '#e2e8f0'
        }}>
          {englishPreview}
        </code>
      </div>
    </div>
  );
}

/**
 * Condition builder dropdowns: [thing] [comparison] [thing or number]
 */
function ConditionRow({ condition, isLocked, onChange }) {
  const left = condition.left || { type: 'price' };
  const op = condition.operator || 'is_above';
  const right = condition.right || { type: 'number', value: 0 };

  const handleLeftTypeChange = (type) => {
    const opt = THING_OPTIONS.find(o => o.value === type);
    const newLeft = { type };
    if (opt?.hasParam) newLeft.param = opt.defaultParam;
    onChange({ ...condition, left: newLeft });
  };

  const handleLeftParamChange = (param) => {
    onChange({ ...condition, left: { ...left, param: Math.max(1, parseInt(param, 10) || 1) } });
  };

  const handleOpChange = (operator) => {
    onChange({ ...condition, operator });
  };

  const handleRightValueChange = (val) => {
    onChange({ ...condition, right: { ...right, value: val } });
  };

  const isLeftPosition = left.type === 'position';
  const isRightIndicator = ['sma', 'ema', 'rsi', 'pct_change', 'price'].includes(right.type);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {/* Left Thing Dropdown */}
      <select
        value={left.type}
        disabled={isLocked}
        onChange={(e) => handleLeftTypeChange(e.target.value)}
        className="input-base"
        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#161a22' }}
      >
        {THING_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Left Param Input (if function) */}
      {['sma', 'ema', 'rsi', 'pct_change'].includes(left.type) && (
        <input
          type="number"
          min="1"
          max="100"
          value={left.param || 20}
          disabled={isLocked}
          onChange={(e) => handleLeftParamChange(e.target.value)}
          className="input-base"
          style={{ width: '50px', padding: '4px 6px', fontSize: '12px', textAlign: 'center' }}
          title="Indicator Period"
        />
      )}

      {/* Comparison Operator Dropdown */}
      <select
        value={op}
        disabled={isLocked}
        onChange={(e) => handleOpChange(e.target.value)}
        className="input-base"
        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#161a22', color: 'var(--accent)' }}
      >
        {COMPARISON_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Right Target: Position vs Value vs Indicator */}
      {isLeftPosition ? (
        <select
          value={right.value || 'none'}
          disabled={isLocked}
          onChange={(e) => onChange({ ...condition, right: { type: 'position', value: e.target.value } })}
          className="input-base"
          style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#161a22' }}
        >
          <option value="none">none</option>
          <option value="long">long</option>
          <option value="short">short</option>
        </select>
      ) : (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {/* Target Type selector: Number vs Thing */}
          <select
            value={isRightIndicator ? right.type : 'number'}
            disabled={isLocked}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'number') {
                onChange({ ...condition, right: { type: 'number', value: 0 } });
              } else if (val === 'price') {
                onChange({ ...condition, right: { type: 'price' } });
              } else {
                onChange({ ...condition, right: { type: val, param: 20 } });
              }
            }}
            className="input-base"
            style={{ padding: '4px 6px', fontSize: '11px', backgroundColor: '#1a1f2c' }}
          >
            <option value="number">Number</option>
            <option value="price">price</option>
            <option value="sma">sma(N)</option>
            <option value="ema">ema(N)</option>
            <option value="rsi">rsi(N)</option>
          </select>

          {/* If Number */}
          {right.type === 'number' && (
            <input
              type="number"
              value={right.value ?? 0}
              disabled={isLocked}
              onChange={(e) => handleRightValueChange(parseFloat(e.target.value) || 0)}
              className="input-base"
              style={{ width: '70px', padding: '4px 6px', fontSize: '12px' }}
            />
          )}

          {/* If Indicator with Param */}
          {['sma', 'ema', 'rsi'].includes(right.type) && (
            <input
              type="number"
              min="1"
              max="100"
              value={right.param || 20}
              disabled={isLocked}
              onChange={(e) => onChange({ ...condition, right: { ...right, param: Math.max(1, parseInt(e.target.value, 10) || 1) } })}
              className="input-base"
              style={{ width: '50px', padding: '4px 6px', fontSize: '12px', textAlign: 'center' }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Action builder dropdowns: [action] [size %] [leverage] [SL %] [TP %]
 */
function ActionRow({ action, isLocked, onChange }) {
  const type = action.type || 'OPEN_LONG';

  const handleTypeChange = (newType) => {
    onChange({
      ...action,
      type: newType,
      sizePct: action.sizePct || 25,
      leverage: action.leverage || 5
    });
  };

  const isOpenAction = type === 'OPEN_LONG' || type === 'OPEN_SHORT';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <select
        value={type}
        disabled={isLocked}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="input-base"
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: '#161a22',
          color: type === 'OPEN_LONG' ? 'var(--color-long)' : type === 'OPEN_SHORT' ? 'var(--color-short)' : 'var(--text-primary)'
        }}
      >
        {ACTION_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {isOpenAction && (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <input
              type="number"
              min="1"
              max="100"
              value={action.sizePct || 25}
              disabled={isLocked}
              onChange={(e) => onChange({ ...action, sizePct: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 25)) })}
              className="input-base"
              style={{ width: '48px', padding: '4px 4px', fontSize: '12px', textAlign: 'center' }}
              title="Size percent of available cash"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>at</span>
            <input
              type="number"
              min="1"
              max="20"
              value={action.leverage || 5}
              disabled={isLocked}
              onChange={(e) => onChange({ ...action, leverage: Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 5)) })}
              className="input-base"
              style={{ width: '42px', padding: '4px 4px', fontSize: '12px', textAlign: 'center' }}
              title="Leverage multiple"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>x</span>
          </div>

          {/* Optional SL / TP fields */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
            <span style={{ fontSize: '10px', color: '#ef4444' }}>SL:</span>
            <input
              type="number"
              min="1"
              max="100"
              placeholder="-"
              value={action.stopLossPct || ''}
              disabled={isLocked}
              onChange={(e) => onChange({ ...action, stopLossPct: e.target.value ? Math.abs(parseInt(e.target.value, 10)) : null })}
              className="input-base"
              style={{ width: '42px', padding: '3px 4px', fontSize: '11px', textAlign: 'center' }}
              title="Stop Loss %"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>%</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '10px', color: '#10b981' }}>TP:</span>
            <input
              type="number"
              min="1"
              max="500"
              placeholder="-"
              value={action.takeProfitPct || ''}
              disabled={isLocked}
              onChange={(e) => onChange({ ...action, takeProfitPct: e.target.value ? Math.abs(parseInt(e.target.value, 10)) : null })}
              className="input-base"
              style={{ width: '42px', padding: '3px 4px', fontSize: '11px', textAlign: 'center' }}
              title="Take Profit %"
            />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>%</span>
          </div>
        </>
      )}

      {type === 'SET_STOP_LOSS' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <input
            type="number"
            min="1"
            max="100"
            value={action.stopLossPct || 5}
            disabled={isLocked}
            onChange={(e) => onChange({ ...action, stopLossPct: Math.abs(parseInt(e.target.value, 10) || 5) })}
            className="input-base"
            style={{ width: '50px', padding: '4px', fontSize: '12px', textAlign: 'center' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%</span>
        </div>
      )}

      {type === 'SET_TAKE_PROFIT' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <input
            type="number"
            min="1"
            max="500"
            value={action.takeProfitPct || 10}
            disabled={isLocked}
            onChange={(e) => onChange({ ...action, takeProfitPct: Math.abs(parseInt(e.target.value, 10) || 10) })}
            className="input-base"
            style={{ width: '50px', padding: '4px', fontSize: '12px', textAlign: 'center' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>%</span>
        </div>
      )}
    </div>
  );
}
