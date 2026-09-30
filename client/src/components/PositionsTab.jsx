import React, { useState } from 'react';

function TpSlModal({ tradeType, trade, currentPrice, onClose, onSave }) {
  const isPos = tradeType === 'POSITION';
  const isLong = trade.side === 'LONG';
  const lev = trade.leverage || 1;
  const entryPrice = isPos ? (trade.entryPrice || currentPrice) : (trade.limitPrice || currentPrice);
  const margin = trade.margin || trade.reservedMargin || 100;

  const [tpStr, setTpStr] = useState(trade.takeProfitPct ? String(trade.takeProfitPct) : '');
  const [slStr, setSlStr] = useState(trade.stopLossPct ? String(trade.stopLossPct) : '');

  const tpNum = parseFloat(tpStr);
  const slNum = parseFloat(slStr);

  let tpTargetPrice = null;
  let tpEstProfit = null;
  if (!isNaN(tpNum) && tpNum > 0 && entryPrice > 0) {
    tpTargetPrice = isLong
      ? entryPrice * (1 + (tpNum / 100) / lev)
      : entryPrice * (1 - (tpNum / 100) / lev);
    tpEstProfit = margin * (tpNum / 100);
  }

  let slTargetPrice = null;
  let slEstLoss = null;
  if (!isNaN(slNum) && slNum > 0 && entryPrice > 0) {
    slTargetPrice = isLong
      ? entryPrice * (1 - (slNum / 100) / lev)
      : entryPrice * (1 + (slNum / 100) / lev);
    slEstLoss = margin * (slNum / 100);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalTp = (!isNaN(tpNum) && tpNum > 0) ? Math.round(tpNum * 10) / 10 : null;
    const finalSl = (!isNaN(slNum) && slNum > 0) ? Math.round(slNum * 10) / 10 : null;
    onSave({ stopLossPct: finalSl, takeProfitPct: finalTp });
  };

  const handleClear = () => {
    onSave({ stopLossPct: null, takeProfitPct: null });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-md, 10px)',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
          padding: '20px',
          color: 'var(--text-primary)',
          fontFamily: 'Inter, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Set Auto-Exit Targets (TP / SL)
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {isPos ? 'Configures automatic exit for this open position' : 'Attaches targets to this pending limit order'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px 6px'
            }}
          >
            ×
          </button>
        </div>

        {/* Trade Summary Box */}
        <div style={{
          backgroundColor: 'var(--bg-page)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          marginBottom: '16px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isLong ? 'var(--color-long-bg)' : 'var(--color-short-bg)',
              color: isLong ? 'var(--color-long)' : 'var(--color-short)'
            }}>
              {trade.side} {lev}x
            </span>
            <span className="tabular-nums" style={{ fontWeight: 600 }}>
              ${entryPrice?.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Margin: <strong>${margin}</strong></span>
            {isPos && (
              <span className="tabular-nums" style={{
                fontWeight: 700,
                color: (trade.pnl || 0) >= 0 ? 'var(--color-long)' : 'var(--color-short)'
              }}>
                {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Take Profit Target */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-long)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Take Profit (%)
              </label>
              {tpTargetPrice && (
                <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-long)' }}>
                  Exit @ ${tpTargetPrice.toFixed(1)} (+${tpEstProfit?.toFixed(2)})
                </span>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-page)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              marginBottom: '6px'
            }}>
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                placeholder="e.g. 10 (Leave blank for none)"
                value={tpStr}
                onChange={(e) => setTpStr(e.target.value)}
                className="tabular-nums"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'inherit'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-long)', fontWeight: 700 }}>%</span>
            </div>

            {/* Quick TP Chips */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[5, 10, 20, 50, 100].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setTpStr(String(pct))}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                    backgroundColor: tpStr === String(pct) ? 'var(--color-long-bg)' : 'var(--bg-page)',
                    color: tpStr === String(pct) ? 'var(--color-long)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  +{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Stop Loss Target */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-short)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stop Loss (%)
              </label>
              {slTargetPrice && (
                <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-short)' }}>
                  Exit @ ${slTargetPrice.toFixed(1)} (-${slEstLoss?.toFixed(2)})
                </span>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-page)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              marginBottom: '6px'
            }}>
              <input
                type="number"
                min="1"
                max="95"
                step="1"
                placeholder="e.g. 5 (Leave blank for none)"
                value={slStr}
                onChange={(e) => setSlStr(e.target.value)}
                className="tabular-nums"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'inherit'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-short)', fontWeight: 700 }}>%</span>
            </div>

            {/* Quick SL Chips */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[3, 5, 10, 15, 20].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setSlStr(String(pct))}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                    backgroundColor: slStr === String(pct) ? 'var(--color-short-bg)' : 'var(--bg-page)',
                    color: slStr === String(pct) ? 'var(--color-short)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            {(trade.takeProfitPct || trade.stopLossPct) && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '9px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-hairline)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-short)',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-hairline)',
                backgroundColor: 'var(--bg-page)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={{
                flex: 2,
                padding: '9px 16px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              Save Targets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PositionsTab({
  leaderboard = [],
  currentUserId = null,
  onClosePosition,
  onUpdatePositionTpSl,
  limitOrders = [],
  onCancelLimitOrder,
  onUpdateLimitOrderTpSl,
  currentPrice = 0
}) {
  const [subTab, setSubTab] = useState('my'); // 'my' | 'global'
  const [editingTrade, setEditingTrade] = useState(null); // null | { type: 'POSITION'|'LIMIT_ORDER', item }

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

  const myPositions = allPositions.filter(item => item.isCurrentPlayer);
  const hasMyPositions = myPositions.length > 0;
  const hasLimitOrders = limitOrders.length > 0;
  const hasGlobalPositions = allPositions.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sub-tab Switcher: My Positions vs Global Positions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--border-hairline)',
        paddingBottom: '10px'
      }}>
        <button
          type="button"
          onClick={() => setSubTab('my')}
          style={{
            padding: '5px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: subTab === 'my' ? '1px solid var(--accent)' : '1px solid var(--border-hairline)',
            backgroundColor: subTab === 'my' ? 'var(--accent)' : 'transparent',
            color: subTab === 'my' ? 'var(--accent-text, #ffffff)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          My Positions ({myPositions.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('global')}
          style={{
            padding: '5px 14px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: subTab === 'global' ? '1px solid var(--accent)' : '1px solid var(--border-hairline)',
            backgroundColor: subTab === 'global' ? 'var(--accent)' : 'transparent',
            color: subTab === 'global' ? 'var(--accent-text, #ffffff)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Global Positions ({allPositions.length})
        </button>
      </div>

      {/* Sub-tab 1: MY POSITIONS */}
      {subTab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* A. Open Limit Orders (if any) */}
          {hasLimitOrders && (
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#f59e0b',
                marginBottom: '8px'
              }}>
                OPEN LIMIT ORDERS ({limitOrders.length})
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '540px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 130px',
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
                      <div
                        key={ord.id}
                        className="list-row"
                        onClick={() => setEditingTrade({ type: 'LIMIT_ORDER', item: ord })}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 130px',
                          fontSize: '12px',
                          alignItems: 'center',
                          backgroundColor: 'rgba(245, 158, 11, 0.04)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.09)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.04)'; }}
                      >
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
                          {(ord.takeProfitPct || ord.stopLossPct) ? (
                            <div style={{ fontSize: '9px', marginTop: '2px', fontWeight: 600 }}>
                              {ord.takeProfitPct && <span style={{ color: 'var(--color-long)', marginRight: '4px' }}>TP: +{ord.takeProfitPct}%</span>}
                              {ord.stopLossPct && <span style={{ color: 'var(--color-short)' }}>SL: -{ord.stopLossPct}%</span>}
                            </div>
                          ) : (
                            <div style={{ fontSize: '9px', marginTop: '2px', color: 'var(--accent)', fontWeight: 600 }}>
                              + Set TP/SL
                            </div>
                          )}
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

                        <div style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTrade({ type: 'LIMIT_ORDER', item: ord });
                            }}
                            className="btn-base"
                            style={{
                              padding: '4px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: (ord.takeProfitPct || ord.stopLossPct) ? 'var(--accent-subtle)' : 'var(--bg-page)',
                              border: (ord.takeProfitPct || ord.stopLossPct) ? '1px solid var(--accent)' : '1px solid var(--border-hairline)',
                              color: (ord.takeProfitPct || ord.stopLossPct) ? 'var(--accent)' : 'var(--text-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                            title="Set or update TP and SL"
                          >
                            TP/SL
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelLimitOrder && onCancelLimitOrder(ord.id);
                            }}
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
              </div>
            </div>
          )}

          {/* B. Active Positions (for current user) */}
          {hasMyPositions ? (
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
                  OPEN POSITIONS ({myPositions.length})
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '540px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 130px',
                    padding: '6px 0',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-hairline)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    <span>Side</span>
                    <span>Entry Price</span>
                    <span>Margin</span>
                    <span>Liq. Price</span>
                    <span style={{ textAlign: 'right' }}>Unrealized PnL</span>
                    <span style={{ textAlign: 'right' }}>Action</span>
                  </div>

                  {myPositions.map(({ pos }) => {
                    const isLong = pos.side === 'LONG';
                    const isProfit = (pos.pnl || 0) >= 0;

                    return (
                      <div
                        key={pos.id || `${pos.entryPrice}_${pos.side}`}
                        className="list-row"
                        onClick={() => setEditingTrade({ type: 'POSITION', item: pos })}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.2fr 130px',
                          fontSize: '12px',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isLong ? 'var(--color-long-bg)' : 'var(--color-short-bg)',
                            color: isLong ? 'var(--color-long)' : 'var(--color-short)'
                          }}>
                            {pos.side} {pos.leverage}x
                          </span>
                          {(pos.takeProfitPct || pos.stopLossPct) ? (
                            <div style={{ fontSize: '9px', marginTop: '2px', fontWeight: 600 }}>
                              {pos.takeProfitPct && <span style={{ color: 'var(--color-long)', marginRight: '4px' }}>TP: +{pos.takeProfitPct}%</span>}
                              {pos.stopLossPct && <span style={{ color: 'var(--color-short)' }}>SL: -{pos.stopLossPct}%</span>}
                            </div>
                          ) : (
                            <div style={{ fontSize: '9px', marginTop: '2px', color: 'var(--accent)', fontWeight: 600 }}>
                              + Set TP/SL
                            </div>
                          )}
                        </div>

                        <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          ${pos.entryPrice?.toFixed(0)}
                        </div>

                        <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          ${pos.margin}
                        </div>

                        <div className="tabular-nums" style={{ color: '#ef4444', fontSize: '11px' }}>
                          {pos.liquidationPrice ? `$${pos.liquidationPrice.toFixed(0)}` : '-'}
                        </div>

                        <div className="tabular-nums" style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
                        }}>
                          {isProfit ? '+' : ''}${pos.pnl?.toFixed(2)} ({isProfit ? '+' : ''}{pos.pnlPct?.toFixed(1)}%)
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTrade({ type: 'POSITION', item: pos });
                            }}
                            className="btn-base"
                            style={{
                              padding: '4px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: (pos.takeProfitPct || pos.stopLossPct) ? 'var(--accent-subtle)' : 'var(--bg-page)',
                              border: (pos.takeProfitPct || pos.stopLossPct) ? '1px solid var(--accent)' : '1px solid var(--border-hairline)',
                              color: (pos.takeProfitPct || pos.stopLossPct) ? 'var(--accent)' : 'var(--text-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                            title="Set or update TP and SL"
                          >
                            TP/SL
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClosePosition && onClosePosition(pos.id);
                            }}
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : !hasLimitOrders && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              You do not have any open positions or pending limit orders.
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: GLOBAL POSITIONS */}
      {subTab === 'global' && (
        <div>
          {hasGlobalPositions ? (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '600px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1.2fr 60px',
                  padding: '6px 0',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-hairline)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <span>Player</span>
                  <span>Side</span>
                  <span>Entry</span>
                  <span>Margin</span>
                  <span>Liq. Price</span>
                  <span style={{ textAlign: 'right' }}>Unrealized PnL</span>
                  <span style={{ textAlign: 'right' }}>Action</span>
                </div>

                {allPositions.map(({ player, pos, isCurrentPlayer }) => {
                  const isLong = pos.side === 'LONG';
                  const isProfit = (pos.pnl || 0) >= 0;

                  return (
                    <div key={pos.id || `${player.id}_${pos.entryPrice}_${pos.side}`} className="list-row" style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 1.2fr 60px',
                      fontSize: '12px',
                      alignItems: 'center'
                    }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.nickname} {isCurrentPlayer && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>(YOU)</span>}
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
                        {(pos.takeProfitPct || pos.stopLossPct) && (
                          <div style={{ fontSize: '9px', marginTop: '2px', fontWeight: 600 }}>
                            {pos.takeProfitPct && <span style={{ color: 'var(--color-long)', marginRight: '4px' }}>TP: +{pos.takeProfitPct}%</span>}
                            {pos.stopLossPct && <span style={{ color: 'var(--color-short)' }}>SL: -{pos.stopLossPct}%</span>}
                          </div>
                        )}
                      </div>

                      <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        ${pos.entryPrice?.toFixed(0)}
                      </div>

                      <div className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        ${pos.margin}
                      </div>

                      <div className="tabular-nums" style={{ color: '#ef4444', fontSize: '11px' }}>
                        {pos.liquidationPrice ? `$${pos.liquidationPrice.toFixed(0)}` : '-'}
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
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No active positions in the arena.
            </div>
          )}
        </div>
      )}

      {/* Dynamic TP / SL Modal when clicking on a trade */}
      {editingTrade && (
        <TpSlModal
          tradeType={editingTrade.type}
          trade={editingTrade.item}
          currentPrice={currentPrice}
          onClose={() => setEditingTrade(null)}
          onSave={({ stopLossPct, takeProfitPct }) => {
            if (editingTrade.type === 'POSITION') {
              onUpdatePositionTpSl && onUpdatePositionTpSl({
                positionId: editingTrade.item.id,
                stopLossPct,
                takeProfitPct
              });
            } else if (editingTrade.type === 'LIMIT_ORDER') {
              onUpdateLimitOrderTpSl && onUpdateLimitOrderTpSl({
                orderId: editingTrade.item.id,
                stopLossPct,
                takeProfitPct
              });
            }
            setEditingTrade(null);
          }}
        />
      )}
    </div>
  );
}
