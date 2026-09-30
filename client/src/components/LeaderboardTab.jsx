import React from 'react';

export default function LeaderboardTab({ leaderboard = [], currentUserId = null }) {
  if (leaderboard.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No traders joined yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '32px 1.3fr 1.4fr 1fr 1fr 1.3fr',
        padding: '6px 0',
        fontSize: '11px',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-hairline)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}>
        <span>#</span>
        <span>Trader</span>
        <span style={{ textAlign: 'right' }}>Δ vs 10k (Round)</span>
        <span style={{ textAlign: 'right' }}>Cash</span>
        <span style={{ textAlign: 'center' }}>Positions</span>
        <span style={{ textAlign: 'right' }}>Total Score (Δ)</span>
      </div>

      {leaderboard.map((p, idx) => {
        const isCurrent = p.id === currentUserId;
        const positions = p.positions || (p.position ? [p.position] : []);
        const roundEquity = p.equity ?? p.balance ?? 10000;
        const delta10k = roundEquity - 10000;
        const deltaPct = (delta10k / 10000) * 100;
        const isProfit = delta10k >= 0;

        const prevRoundsCount = (p.roundBalances || []).length;
        const baseCapital = Math.max(10000, (prevRoundsCount + 1) * 10000);
        const cumDelta = (p.totalScore || roundEquity) - baseCapital;
        const isCumProfit = cumDelta >= 0;

        return (
          <div
            key={p.id}
            className="list-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1.3fr 1.4fr 1fr 1fr 1.3fr',
              fontSize: '13px',
              alignItems: 'center',
              backgroundColor: isCurrent ? 'var(--accent-subtle)' : 'transparent',
              borderRadius: isCurrent ? 'var(--radius-sm)' : '0',
              padding: isCurrent ? '8px 6px' : '10px 0'
            }}
          >
            <div style={{ fontWeight: 700, color: idx === 0 ? 'var(--color-long)' : 'var(--text-secondary)' }}>
              #{idx + 1}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {p.nickname}
              </span>
              {isCurrent && (
                <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                  (YOU)
                </span>
              )}
              {p.isLiquidated && (
                <span style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-short-bg)',
                  color: 'var(--color-short)',
                  fontWeight: 700
                }}>
                  REKT
                </span>
              )}
            </div>

            {/* Delta vs 10k for current round */}
            <div className="tabular-nums" style={{
              textAlign: 'right',
              fontWeight: 700,
              color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
            }}>
              {isProfit ? '+' : ''}${delta10k.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.85 }}>
                ({isProfit ? '+' : ''}{deltaPct.toFixed(1)}%)
              </span>
            </div>

            {/* Available Cash */}
            <div className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
              ${p.balance?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>

            {/* Positions summary */}
            <div style={{ textAlign: 'center' }}>
              {positions.length > 0 ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-primary)'
                }}>
                  {positions.length} active
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>FLAT</span>
              )}
            </div>

            {/* Total Score Delta */}
            <div className="tabular-nums" style={{
              textAlign: 'right',
              fontWeight: 600,
              color: isCumProfit ? 'var(--color-long)' : 'var(--color-short)'
            }}>
              {isCumProfit ? '+' : ''}${cumDelta.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                ${(p.totalScore || roundEquity)?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
