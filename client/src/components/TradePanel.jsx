import React, { useState, useEffect } from 'react';

export default function TradePanel({
  balance = 10000,
  equity = 10000,
  currentPrice = 0,
  isLiquidated = false,
  maxLeverage = 20,
  bankDebt = 0,
  bankRatePct = '0.10',
  losingTrades = 0,
  onOrder,
  onLimitOrder,
  openLimitOrders = [],
  onCancelLimitOrder,
  onBankBorrow,
  onBankRepay,
  disabled = false
}) {
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [side, setSide] = useState('LONG'); // 'LONG' | 'SHORT'
  const [amountStr, setAmountStr] = useState('250');
  const [limitPriceStr, setLimitPriceStr] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [showBankDetails, setShowBankDetails] = useState(false);

  // Initialize or update limit price with current price
  useEffect(() => {
    if (!limitPriceStr && currentPrice > 0) {
      setLimitPriceStr(String(Math.round(currentPrice)));
    }
  }, [currentPrice]);

  // Parse dollar amount safely
  const rawAmount = parseFloat(amountStr) || 0;
  const clampedAmount = Math.max(0, Math.min(balance, rawAmount));

  // Compute margin, notional, fees, liquidation
  const lev = Math.max(1, Math.min(maxLeverage, leverage));
  const feeRate = 0.0005; // 0.05%
  const notional = clampedAmount * lev;
  const estFee = notional * feeRate;

  const isLong = side === 'LONG';
  const targetPrice = orderType === 'LIMIT' && parseFloat(limitPriceStr) > 0
    ? parseFloat(limitPriceStr)
    : currentPrice;

  const estLiqPrice = targetPrice > 0
    ? (isLong ? targetPrice * (1 - (1 / lev)) : targetPrice * (1 + (1 / lev)))
    : 0;

  const liqDistancePct = lev > 0 ? (100 / lev) : 100;

  // Delta relative to starting $10,000 cash
  const delta10k = equity - 10000;
  const deltaPct = (delta10k / 10000) * 100;
  const isProfit = delta10k >= 0;

  // Update default amount if balance drops below it
  useEffect(() => {
    if (balance > 0 && clampedAmount > balance) {
      setAmountStr(String(Math.floor(balance)));
    }
  }, [balance]);

  const handleSetPercent = (pct) => {
    if (balance <= 0) return;
    const val = Math.floor(balance * (pct / 100));
    setAmountStr(String(Math.max(5, val)));
  };

  const handleAddAmount = (addVal) => {
    const current = parseFloat(amountStr) || 0;
    const nextVal = Math.min(balance, current + addVal);
    setAmountStr(String(Math.floor(nextVal)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled || isLiquidated || balance <= 5 || clampedAmount < 5) return;

    const sizePct = Math.min(100, Math.max(1, Math.round((clampedAmount / balance) * 100)));

    if (orderType === 'LIMIT') {
      const parsedLimitPrice = parseFloat(limitPriceStr);
      if (!parsedLimitPrice || parsedLimitPrice <= 0) return;
      if (onLimitOrder) {
        onLimitOrder({
          side,
          limitPrice: parsedLimitPrice,
          sizePct,
          leverage: lev,
          amount: clampedAmount
        });
      }
    } else {
      if (onOrder) {
        onOrder({
          side,
          sizePct,
          leverage: lev,
          amount: clampedAmount
        });
      }
    }
  };

  const isOrderValid = !disabled && !isLiquidated && balance > 5 && clampedAmount >= 5 &&
    (orderType !== 'LIMIT' || (parseFloat(limitPriceStr) > 0));

  return (
    <div style={{
      position: 'sticky',
      top: '72px',
      backgroundColor: '#12161f',
      border: '1px solid #232a38',
      borderRadius: '10px',
      padding: '16px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: '#e2e8f0'
    }}>
      {/* Top Header: Market vs Limit Selector & Account Stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid #1e2636'
      }}>
        {/* Polymarket Order Type Selector: MARKET vs LIMIT */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#0b0f17',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid #1e2636'
        }}>
          <button
            type="button"
            onClick={() => setOrderType('MARKET')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: orderType === 'MARKET' ? '1px solid #38bdf8' : 'none',
              backgroundColor: orderType === 'MARKET' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              color: orderType === 'MARKET' ? '#38bdf8' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            ⚡ MARKET
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderType('LIMIT');
              if (!limitPriceStr && currentPrice > 0) {
                setLimitPriceStr(String(Math.round(currentPrice)));
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: orderType === 'LIMIT' ? '1px solid #f59e0b' : 'none',
              backgroundColor: orderType === 'LIMIT' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
              color: orderType === 'LIMIT' ? '#f59e0b' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            🎯 LIMIT
          </button>
        </div>

        {/* Live Cash Readout */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cash Available
          </div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Net Equity Delta Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#0c1017',
        borderRadius: '6px',
        border: '1px solid #1a2230',
        fontSize: '11px'
      }}>
        <span style={{ color: '#94a3b8' }}>Portfolio Equity:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong className="tabular-nums" style={{ color: '#f1f5f9', fontSize: '12px' }}>
            ${Math.round(equity).toLocaleString()}
          </strong>
          <span className="tabular-nums" style={{
            fontWeight: 700,
            color: isProfit ? '#10b981' : '#ef4444'
          }}>
            {isProfit ? '+' : ''}${Math.round(delta10k).toLocaleString()} ({isProfit ? '+' : ''}{deltaPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {isLiquidated ? (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          textAlign: 'center',
          fontSize: '12px'
        }}>
          <strong style={{ color: '#ef4444', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
            🚨 POSITIONS LIQUIDATED
          </strong>
          <span style={{ color: '#94a3b8' }}>
            Fresh $10,000 cash balance will be granted for next round!
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Polymarket & Kalshi Outcome Selector Cards */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Choose Outcome
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Buy Long / Up Card */}
              <button
                type="button"
                onClick={() => setSide('LONG')}
                style={{
                  padding: '12px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: isLong ? '2px solid #10b981' : '1px solid #2d3748',
                  backgroundColor: isLong ? 'rgba(16, 185, 129, 0.16)' : '#161c27',
                  color: isLong ? '#ffffff' : '#94a3b8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  boxShadow: isLong ? '0 0 12px rgba(16, 185, 129, 0.25)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '14px', color: '#10b981' }}>▲</span>
                  <span style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.02em', color: isLong ? '#10b981' : '#cbd5e1' }}>
                    {orderType === 'LIMIT' ? 'BUY LONG LIMIT' : 'BUY LONG'}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: isLong ? '#86efac' : '#64748b', fontWeight: 500 }}>
                  Bet on Rise ↗
                </span>
              </button>

              {/* Buy Short / Down Card */}
              <button
                type="button"
                onClick={() => setSide('SHORT')}
                style={{
                  padding: '12px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: !isLong ? '2px solid #ef4444' : '1px solid #2d3748',
                  backgroundColor: !isLong ? 'rgba(239, 68, 68, 0.16)' : '#161c27',
                  color: !isLong ? '#ffffff' : '#94a3b8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                  boxShadow: !isLong ? '0 0 12px rgba(239, 68, 68, 0.25)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '14px', color: '#ef4444' }}>▼</span>
                  <span style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.02em', color: !isLong ? '#ef4444' : '#cbd5e1' }}>
                    {orderType === 'LIMIT' ? 'BUY SHORT LIMIT' : 'BUY SHORT'}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: !isLong ? '#fca5a5' : '#64748b', fontWeight: 500 }}>
                  Bet on Drop ↘
                </span>
              </button>
            </div>
          </div>

          {/* Limit Price Input Field (When LIMIT mode is active) */}
          {orderType === 'LIMIT' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Target Limit Price
                </span>
                <button
                  type="button"
                  onClick={() => setLimitPriceStr(String(Math.round(currentPrice)))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Use Market (${Math.round(currentPrice).toLocaleString()})
                </button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#0a0d14',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '8px 14px'
              }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b', marginRight: '6px', userSelect: 'none' }}>
                  $
                </span>
                <input
                  type="number"
                  step="1"
                  value={limitPriceStr}
                  onChange={(e) => setLimitPriceStr(e.target.value)}
                  placeholder={String(Math.round(currentPrice))}
                  className="tabular-nums"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '20px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    width: '100%'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>USD</span>
              </div>

              {/* Quick Nudge Pills (-$50, -$10, +$10, +$50) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
                {[-50, -10, 10, 50].map((nudge) => (
                  <button
                    key={nudge}
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(limitPriceStr) || currentPrice || 43500;
                      setLimitPriceStr(String(Math.max(1, Math.round(cur + nudge))));
                    }}
                    style={{
                      padding: '4px 0',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '5px',
                      border: '1px solid #2d3748',
                      backgroundColor: '#161c27',
                      color: '#cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    {nudge > 0 ? `+${nudge}` : nudge}
                  </button>
                ))}
              </div>

              {/* Helper trigger explanation */}
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '5px', lineHeight: 1.4 }}>
                {isLong ? (
                  <span>📉 <strong>Buy Long Limit:</strong> Will trigger & fill if price drops to or below <strong>${parseFloat(limitPriceStr)?.toLocaleString() || '---'}</strong></span>
                ) : (
                  <span>📈 <strong>Buy Short Limit:</strong> Will trigger & fill if price rises to or above <strong>${parseFloat(limitPriceStr)?.toLocaleString() || '---'}</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Amount Input with Currency Symbol & Quick Chips */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Order Amount
              </span>
              <button
                type="button"
                onClick={() => handleSetPercent(100)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Max (${Math.floor(balance).toLocaleString()})
              </button>
            </div>

            {/* Big Polymarket-Style Amount Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#0a0d14',
              border: '1px solid #2d3748',
              borderRadius: '8px',
              padding: '8px 14px',
              transition: 'border-color 0.15s'
            }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: '#64748b', marginRight: '6px', userSelect: 'none' }}>
                $
              </span>
              <input
                type="number"
                min="5"
                max={Math.floor(balance)}
                step="5"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className="tabular-nums"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  width: '100%'
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>USD</span>
            </div>

            {/* Quick Percentage Presets (25%, 50%, 75%, MAX) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSetPercent(pct)}
                  style={{
                    padding: '6px 0',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #2d3748',
                    backgroundColor: '#161c27',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1f2838';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = '#475569';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#161c27';
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.borderColor = '#2d3748';
                  }}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>

            {/* Quick Cash Presets (+$50, +$100, +$250, +$500) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
              {[50, 100, 250, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleAddAmount(amt)}
                  style={{
                    padding: '5px 0',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #242c3d',
                    backgroundColor: '#0f141d',
                    color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#192231';
                    e.currentTarget.style.color = '#38bdf8';
                    e.currentTarget.style.borderColor = '#38bdf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0f141d';
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.borderColor = '#242c3d';
                  }}
                >
                  +${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Leverage Multiplier Section (Polymarket / Perps Pills) */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Leverage Multiplier
              </span>
              <span className="tabular-nums" style={{
                fontSize: '11px',
                fontWeight: 700,
                color: lev >= 10 ? '#ef4444' : '#38bdf8'
              }}>
                {lev}x ({lev}x Payout Power)
              </span>
            </div>

            {/* Segmented Leverage Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[1, 2, 5, 10, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLeverage(m)}
                  style={{
                    padding: '6px 0',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: lev === m ? '1px solid #38bdf8' : '1px solid #2d3748',
                    backgroundColor: lev === m ? 'rgba(56, 189, 248, 0.18)' : '#161c27',
                    color: lev === m ? '#38bdf8' : '#94a3b8',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {m}x
                </button>
              ))}
            </div>

            {/* Fine-tune Slider */}
            <div style={{ marginTop: '8px' }}>
              <input
                type="range"
                min="1"
                max={maxLeverage}
                value={lev}
                onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Order Details / Fill Receipt (Polymarket & Kalshi Breakdown) */}
          <div style={{
            backgroundColor: '#0c1017',
            borderRadius: '8px',
            border: '1px solid #1e2636',
            padding: '10px 12px',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>{orderType === 'LIMIT' ? 'Target Limit Price' : 'Market Execution Price'}</span>
              <span className="tabular-nums" style={{ fontWeight: 600, color: orderType === 'LIMIT' ? '#f59e0b' : '#f1f5f9' }}>
                ${targetPrice > 0 ? targetPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '---'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Total Position Size (Notional)</span>
              <span className="tabular-nums" style={{ fontWeight: 600, color: '#f1f5f9' }}>
                ${notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8' }}>Est. Liquidation Price</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tabular-nums" style={{ color: '#ef4444', fontWeight: 700 }}>
                  ${estLiqPrice > 0 ? estLiqPrice.toFixed(1) : '---'}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(239, 68, 68, 0.18)',
                  color: '#ef4444',
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}>
                  ±{liqDistancePct.toFixed(0)}%
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid #1a2230' }}>
              <span style={{ color: '#64748b' }}>Taker Fee (0.05%)</span>
              <span className="tabular-nums" style={{ color: '#64748b' }}>
                ${estFee.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Big Polymarket / Kalshi Full-Width Call-to-Action Button */}
          <button
            type="submit"
            disabled={!isOrderValid}
            style={{
              padding: '14px',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              width: '100%',
              borderRadius: '8px',
              border: 'none',
              cursor: isOrderValid ? 'pointer' : 'not-allowed',
              backgroundColor: !isOrderValid
                ? '#1e2636'
                : (isLong ? '#10b981' : '#ef4444'),
              color: !isOrderValid ? '#64748b' : '#ffffff',
              boxShadow: isOrderValid
                ? (isLong ? '0 4px 16px rgba(16, 185, 129, 0.35)' : '0 4px 16px rgba(239, 68, 68, 0.35)')
                : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {!isOrderValid ? (
              <span>{balance <= 5 ? 'INSUFFICIENT BALANCE' : 'ENTER AN AMOUNT'}</span>
            ) : (
              <>
                <span>{orderType === 'LIMIT' ? (isLong ? 'PLACE LONG LIMIT' : 'PLACE SHORT LIMIT') : (isLong ? 'BUY LONG' : 'BUY SHORT')}</span>
                <span>·</span>
                <span className="tabular-nums">${Math.floor(clampedAmount).toLocaleString()}</span>
                {orderType === 'LIMIT' && (
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>@{Math.round(targetPrice).toLocaleString()}</span>
                )}
                <span style={{ fontSize: '12px', opacity: 0.85 }}>({lev}x)</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Open Limit Orders List in TradePanel */}
      {openLimitOrders && openLimitOrders.length > 0 && (
        <div style={{
          backgroundColor: '#0c1017',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.04em' }}>
              🎯 OPEN LIMIT ORDERS ({openLimitOrders.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {openLimitOrders.map((ord) => {
              const isOrdLong = ord.side === 'LONG';
              const distPct = currentPrice > 0
                ? (((ord.limitPrice - currentPrice) / currentPrice) * 100).toFixed(1)
                : '0.0';

              return (
                <div key={ord.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: '#161c27',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      backgroundColor: isOrdLong ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: isOrdLong ? '#10b981' : '#ef4444',
                      fontSize: '10px'
                    }}>
                      {ord.side} {ord.leverage}x
                    </span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: '#f1f5f9' }}>
                      ${ord.limitPrice?.toFixed(0)}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      ({distPct > 0 ? `+${distPct}` : distPct}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tabular-nums" style={{ color: '#94a3b8' }}>
                      ${ord.margin}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCancelLimitOrder && onCancelLimitOrder(ord.id)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid #ef4444',
                        color: '#ff6b6b',
                        borderRadius: '4px',
                        cursor: 'pointer'
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
      )}

      {/* Degenerate Loan Bank Section (Emergency Liquidity) */}
      <div style={{
        backgroundColor: '#0c1017',
        border: '1px solid #1e2636',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setShowBankDetails(prev => !prev)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: '#cbd5e1',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏦</span>
            <span style={{ letterSpacing: '0.04em' }}>LOAN BANK (DEGENERATE LIQUIDITY)</span>
            {bankDebt > 0 && (
              <span style={{
                fontSize: '9px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: 800
              }}>
                DEBT ACTIVE
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            {showBankDetails ? '▲' : '▼'}
          </span>
        </button>

        {/* Bank Actions & Details */}
        <div style={{
          padding: showBankDetails || bankDebt > 0 ? '0 12px 12px 12px' : '0 12px 10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11px' }}>
            <span style={{ color: '#64748b' }}>Outstanding Debt:</span>
            <span className="tabular-nums" style={{ fontWeight: 700, color: bankDebt > 0 ? '#ef4444' : '#94a3b8' }}>
              ${bankDebt?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onBankBorrow && onBankBorrow(1000)}
              disabled={disabled || isLiquidated}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#161c27',
                border: '1px solid #2d3748',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer'
              }}
            >
              +Borrow $1k
            </button>
            <button
              type="button"
              onClick={() => onBankBorrow && onBankBorrow(2500)}
              disabled={disabled || isLiquidated}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#161c27',
                border: '1px solid #2d3748',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer'
              }}
            >
              +Borrow $2.5k
            </button>
            {bankDebt > 0 && (
              <button
                type="button"
                onClick={() => onBankRepay && onBankRepay(bankDebt)}
                disabled={disabled || balance <= 0}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  color: '#10b981',
                  cursor: 'pointer'
                }}
              >
                Repay All
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
