import React from 'react';

const safeNum = (v, defaultVal = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultVal;
};

const formatPrice = (v, dec = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(dec) : '-';
};

const formatPnl = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

const formatPct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
};

export default function PositionCard({ position, currentPrice = 0, onClose, disabled = false }) {
  if (!position) return null;

  const isLong = position.side === 'LONG';
  const uPnL = safeNum(position.unrealizedPnL ?? position.pnl, 0);
  const pnlPct = safeNum(position.pnlPct, 0);
  const isProfit = uPnL >= 0;

  const handleCloseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onClose) {
      onClose(position.id);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface-elevated)',
      border: `1px solid ${isLong ? 'var(--color-long-border)' : 'var(--color-short-border)'}`,
      borderRadius: 'var(--radius-sm)',
      padding: '10px 12px',
      marginBottom: '8px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isLong ? 'var(--color-long-bg)' : 'var(--color-short-bg)',
            color: isLong ? 'var(--color-long)' : 'var(--color-short)'
          }}>
            {position.side} {position.leverage}x
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Margin: <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>${safeNum(position.margin, 0)}</strong>
          </span>
        </div>

        {/* Close Button placed directly on the position itself */}
        <button
          type="button"
          onClick={handleCloseClick}
          disabled={disabled}
          className="btn-base"
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-hairline)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
          title="Market close this position"
        >
          CLOSE
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Entry / Mark:</span>
          <div className="tabular-nums" style={{ fontWeight: 500, marginTop: '1px' }}>
            ${formatPrice(position.entryPrice, 0)} / ${formatPrice(currentPrice, 0)}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ color: 'var(--text-muted)' }}>Unrealized PnL:</span>
          <div
            className="tabular-nums"
            style={{
              fontWeight: 700,
              marginTop: '1px',
              color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
            }}
          >
            {isProfit ? '+' : ''}${formatPnl(uPnL)} ({isProfit ? '+' : ''}{formatPct(pnlPct)}%)
          </div>
        </div>
      </div>

      {Number(position.liquidationPrice) > 0 && (
        <div style={{
          marginTop: '6px',
          paddingTop: '4px',
          borderTop: '1px solid var(--border-hairline)',
          fontSize: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'var(--text-muted)'
        }}>
          <span>Est. Liq Price</span>
          <span className="tabular-nums" style={{ color: 'var(--color-short)', fontWeight: 600 }}>
            ${formatPrice(position.liquidationPrice, 2)}
          </span>
        </div>
      )}
    </div>
  );
}
