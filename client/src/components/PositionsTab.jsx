import React from 'react';

export default function PositionsTab({
  leaderboard = [],
  currentUserId = null,
  onClosePosition,
  limitOrders = [],
  onCancelLimitOrder,
  currentPrice = 0
}) {
  // Collect all active positions across all players
  const allPositions = [];

  leaderboard.forEach(player => {
    const list = player.positions || (player.position ? [player.position] : []);
    list.forEach(pos => {
      allPositions.push({
        player,
        pos,
        isCurrentPlayer: player.id === currentUserId
      });
    });
  });

  const hasPositions = allPositions.length > 0;
  const hasLimitOrders = limitOrders.length > 0;

  if (!hasPositions && !hasLimitOrders) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No traders currently hold open positions or pending limit orders.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Open Limit Orders (if any) */}
      {hasLimitOrders && (
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#f59e0b',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>🎯</span>
            <span>YOUR OPEN LIMIT ORDERS ({limitOrders.length})</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px',
            padding: '6px 0',
            fontSize: '11px',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-hairline)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            <span>Side</span>
            <span>Target Price</span>
            <span>Distance</span>
            <span>Reserved Cash</span>
            <span style={{ textAlign: 'right' }}>Status</span>
            <span style={{ textAlign: 'right' }}>Action</span>
          </div>

          {limitOrders.map((ord) => {
            const isLong = ord.side === 'LONG';
            const distPct = currentPrice > 0
              ? (((ord.limitPrice - currentPrice) / currentPrice) * 100).toFixed(1)
              : '0.0';

            return (
              <div key={ord.id} className="list-row" style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px',
                fontSize: '12px',
                alignItems: 'center',
                backgroundColor: 'rgba(245, 158, 11, 0.04)'
              }}>
                <div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isLong ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: isLong ? '#10b981' : '#ef4444'
                  }}>
                    {ord.side} {ord.leverage}x
                  </span>
                </div>

                <div className="tabular-nums" style={{ fontWeight: 600, color: '#f59e0b' }}>
                  ${ord.limitPrice?.toFixed(0)}
                </div>

                <div className="tabular-nums" style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {distPct > 0 ? `+${distPct}` : distPct}%
                </div>

                <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  ${ord.reservedMargin || ord.margin}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#f59e0b',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)'
                  }}>
                    PENDING
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => onCancelLimitOrder && onCancelLimitOrder(ord.id)}
                    className="btn-base"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(239, 68, 68, 0.22)',
                      border: '1px solid #ef4444',
                      color: '#ff6b6b',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      letterSpacing: '0.04em'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.22)';
                      e.currentTarget.style.color = '#ff6b6b';
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Active Positions Table */}
      {hasPositions && (
        <div>
          {hasLimitOrders && (
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--accent)',
              marginBottom: '8px'
            }}>
              ACTIVE POSITIONS ({allPositions.length})
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px',
            padding: '6px 0',
            fontSize: '11px',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-hairline)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            <span>Trader</span>
            <span>Side</span>
            <span>Entry</span>
            <span>Margin</span>
            <span style={{ textAlign: 'right' }}>Unrealized PnL</span>
            <span style={{ textAlign: 'right' }}>Action</span>
          </div>

          {allPositions.map(({ player, pos, isCurrentPlayer }) => {
            const isLong = pos.side === 'LONG';
            const isProfit = (pos.pnl || 0) >= 0;

            return (
              <div key={pos.id || `${player.id}_${pos.entryPrice}`} className="list-row" style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 60px',
                fontSize: '12px',
                alignItems: 'center'
              }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {player.nickname} {isCurrentPlayer && <span style={{ fontSize: '10px', color: 'var(--accent)' }}>(YOU)</span>}
                </div>

                <div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isLong ? 'var(--color-long-bg)' : 'var(--color-short-bg)',
                    color: isLong ? 'var(--color-long)' : 'var(--color-short)'
                  }}>
                    {pos.side} {pos.leverage}x
                  </span>
                </div>

                <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  ${pos.entryPrice?.toFixed(0)}
                </div>

                <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  ${pos.margin}
                </div>

                <div className="tabular-nums" style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
                }}>
                  {isProfit ? '+' : ''}${pos.pnl?.toFixed(2)} ({isProfit ? '+' : ''}{pos.pnlPct?.toFixed(1)}%)
                </div>

                <div style={{ textAlign: 'right' }}>
                  {isCurrentPlayer ? (
                    <button
                      type="button"
                      onClick={() => onClosePosition && onClosePosition(pos.id)}
                      className="btn-base"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(239, 68, 68, 0.22)',
                        border: '1px solid #ef4444',
                        color: '#ff6b6b',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        boxShadow: '0 1px 3px rgba(239, 68, 68, 0.2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ef4444';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.22)';
                        e.currentTarget.style.color = '#ff6b6b';
                      }}
                    >
                      CLOSE
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
