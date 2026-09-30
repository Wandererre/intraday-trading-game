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
  const [takeProfitStr, setTakeProfitStr] = useState('');
  const [stopLossStr, setStopLossStr] = useState('');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled || isLiquidated || balance <= 5 || clampedAmount < 5) return;

    const sizePct = Math.min(100, Math.max(1, Math.round((clampedAmount / balance) * 100)));
    const parsedTP = takeProfitStr ? Math.abs(parseFloat(takeProfitStr)) : null;
    const parsedSL = stopLossStr ? Math.abs(parseFloat(stopLossStr)) : null;

    if (orderType === 'LIMIT') {
      const parsedLimitPrice = parseFloat(limitPriceStr);
      if (!parsedLimitPrice || parsedLimitPrice <= 0) return;
      if (onLimitOrder) {
        onLimitOrder({
          side,
          limitPrice: parsedLimitPrice,
          sizePct,
          leverage: lev,
          amount: clampedAmount,
          stopLossPct: parsedSL,
          takeProfitPct: parsedTP
        });
      }
    } else {
      if (onOrder) {
        onOrder({
          side,
          sizePct,
          leverage: lev,
          amount: clampedAmount,
          stopLossPct: parsedSL,
          takeProfitPct: parsedTP
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
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-md, 10px)',
      padding: '16px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: 'var(--text-primary)'
    }}>
      {/* Top Header: Market vs Limit Selector & Available Cash */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-hairline)'
      }}>
        {/* Order Type Selector: MARKET vs LIMIT */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'var(--bg-page)',
          padding: '3px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-hairline)'
        }}>
          <button
            type="button"
            onClick={() => setOrderType('MARKET')}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: orderType === 'MARKET' ? '1px solid var(--accent)' : 'none',
              backgroundColor: orderType === 'MARKET' ? 'var(--accent)' : 'transparent',
              color: orderType === 'MARKET' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            MARKET
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
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: orderType === 'LIMIT' ? '1px solid #f59e0b' : 'none',
              backgroundColor: orderType === 'LIMIT' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: orderType === 'LIMIT' ? '#f59e0b' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            LIMIT
          </button>
        </div>

        {/* Live Cash Readout */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cash Available
          </div>
          <div className="tabular-nums" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
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
        backgroundColor: 'var(--bg-page)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-hairline)',
        fontSize: '11px'
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>Portfolio Equity:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong className="tabular-nums" style={{ color: 'var(--text-primary)', fontSize: '12px' }}>
            ${Math.round(equity).toLocaleString()}
          </strong>
          <span className="tabular-nums" style={{
            fontWeight: 700,
            color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
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
            POSITIONS LIQUIDATED
          </strong>
          <span style={{ color: 'var(--text-secondary)' }}>
            Fresh $10,000 cash balance will be granted for next round!
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Outcome Selector: BUY LONG vs BUY SHORT */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Choose Outcome
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* Buy Long */}
              <button
                type="button"
                onClick={() => setSide('LONG')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: isLong ? '2px solid var(--color-long)' : '1px solid var(--border-hairline)',
                  backgroundColor: isLong ? 'var(--color-long-bg)' : 'var(--bg-page)',
                  color: isLong ? 'var(--color-long)' : 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.02em' }}>
                  {orderType === 'LIMIT' ? 'BUY LONG LIMIT' : 'BUY LONG'}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 500 }}>
                  Bet on Rise
                </span>
              </button>

              {/* Buy Short */}
              <button
                type="button"
                onClick={() => setSide('SHORT')}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  border: !isLong ? '2px solid var(--color-short)' : '1px solid var(--border-hairline)',
                  backgroundColor: !isLong ? 'var(--color-short-bg)' : 'var(--bg-page)',
                  color: !isLong ? 'var(--color-short)' : 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.02em' }}>
                  {orderType === 'LIMIT' ? 'BUY SHORT LIMIT' : 'BUY SHORT'}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 500 }}>
                  Bet on Drop
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
                  Target Limit Price ($)
                </span>
                <button
                  type="button"
                  onClick={() => setLimitPriceStr(String(Math.round(currentPrice)))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
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
                backgroundColor: 'var(--bg-page)',
                border: '1px solid #f59e0b',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px'
              }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b', marginRight: '6px', userSelect: 'none' }}>
                  $
                </span>
                <input
                  type="number"
                  step="1"
                  value={limitPriceStr}
                  onChange={(e) => setLimitPriceStr(e.target.value)}
                  placeholder="e.g. 43000"
                  className="tabular-nums"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '18px',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {isLong ? (
                  <span><strong>Buy Long Limit:</strong> Triggers if price drops to or below <strong>${parseFloat(limitPriceStr)?.toLocaleString() || '---'}</strong></span>
                ) : (
                  <span><strong>Buy Short Limit:</strong> Triggers if price rises to or above <strong>${parseFloat(limitPriceStr)?.toLocaleString() || '---'}</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Simple Amount Input: Only dollar values entered by user */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Order Amount ($)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Max: ${Math.floor(balance).toLocaleString()}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-page)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px'
            }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '6px', userSelect: 'none' }}>
                $
              </span>
              <input
                type="number"
                min="5"
                max={Math.floor(balance)}
                step="5"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="100"
                className="tabular-nums"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '20px',
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  width: '100%'
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>USD</span>
            </div>
          </div>

          {/* Simple Leverage Slider: Only slider */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Leverage Multiplier
              </span>
              <span className="tabular-nums" style={{
                fontSize: '12px',
                fontWeight: 700,
                color: lev >= 10 ? 'var(--color-short)' : 'var(--accent)'
              }}>
                {lev}x Leverage
              </span>
            </div>

            <input
              type="range"
              min="1"
              max={maxLeverage}
              value={lev}
              onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
              <span>{maxLeverage}x</span>
            </div>
          </div>

          {/* Take Profit (TP) & Stop Loss (SL) Inputs for Market Orders */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px'
          }}>
            {/* Take Profit */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-long)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Take Profit (%)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-page)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px'
              }}>
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  placeholder="e.g. 10"
                  value={takeProfitStr}
                  onChange={(e) => setTakeProfitStr(e.target.value)}
                  className="tabular-nums"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    width: '100%'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-long)', fontWeight: 700 }}>%</span>
              </div>
            </div>

            {/* Stop Loss */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-short)',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Stop Loss (%)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-page)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px'
              }}>
                <input
                  type="number"
                  min="1"
                  max="95"
                  step="1"
                  placeholder="e.g. 5"
                  value={stopLossStr}
                  onChange={(e) => setStopLossStr(e.target.value)}
                  className="tabular-nums"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    width: '100%'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--color-short)', fontWeight: 700 }}>%</span>
              </div>
            </div>
          </div>

          {/* Order Details / Fill Receipt */}
          <div style={{
            backgroundColor: 'var(--bg-page)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-hairline)',
            padding: '10px 12px',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Execution Price</span>
              <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                ${targetPrice > 0 ? targetPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '---'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Position Power</span>
              <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                ${notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({lev}x)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Est. Liquidation Price</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tabular-nums" style={{ color: 'var(--color-short)', fontWeight: 700 }}>
                  ${estLiqPrice > 0 ? estLiqPrice.toFixed(1) : '---'}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-short-bg)',
                  color: 'var(--color-short)',
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}>
                  ±{liqDistancePct.toFixed(0)}%
                </span>
              </div>
            </div>

            {(takeProfitStr || stopLossStr) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-hairline)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Exit Orders</span>
                <span style={{ fontSize: '10px', fontWeight: 600 }}>
                  {takeProfitStr && <span style={{ color: 'var(--color-long)', marginRight: '6px' }}>TP: +{takeProfitStr}%</span>}
                  {stopLossStr && <span style={{ color: 'var(--color-short)' }}>SL: -{stopLossStr}%</span>}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-hairline)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Taker Fee (0.05%)</span>
              <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                ${estFee.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Full-Width Action Button */}
          <button
            type="submit"
            disabled={!isOrderValid}
            style={{
              padding: '14px',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: isOrderValid ? 'pointer' : 'not-allowed',
              backgroundColor: !isOrderValid
                ? 'var(--border-hairline)'
                : (isLong ? 'var(--color-long)' : 'var(--color-short)'),
              color: !isOrderValid ? 'var(--text-muted)' : '#ffffff',
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
          backgroundColor: 'var(--bg-page)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.04em' }}>
              OPEN LIMIT ORDERS ({openLimitOrders.length})
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
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isOrdLong ? 'var(--color-long-bg)' : 'var(--color-short-bg)',
                      color: isOrdLong ? 'var(--color-long)' : 'var(--color-short)',
                      fontSize: '10px'
                    }}>
                      {ord.side} {ord.leverage}x
                    </span>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      ${ord.limitPrice?.toFixed(0)}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      ({distPct > 0 ? `+${distPct}` : distPct}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      ${ord.margin}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCancelLimitOrder && onCancelLimitOrder(ord.id)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-short-bg)',
                        border: '1px solid var(--color-short)',
                        color: 'var(--color-short)',
                        borderRadius: 'var(--radius-sm)',
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

      {/* Loan Bank Section (Emergency Liquidity) */}
      <div style={{
        backgroundColor: 'var(--bg-page)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-sm)',
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
            color: 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ letterSpacing: '0.04em' }}>LOAN BANK (DEGENERATE LIQUIDITY)</span>
            {bankDebt > 0 && (
              <span style={{
                fontSize: '9px',
                backgroundColor: 'var(--color-short-bg)',
                color: 'var(--color-short)',
                padding: '1px 5px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800
              }}>
                DEBT ACTIVE
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {showBankDetails ? '▲' : '▼'}
          </span>
        </button>

        {/* Collapsible Content */}
        {showBankDetails && (
          <div style={{
            padding: '12px',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '11px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              textAlign: 'center'
            }}>
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block' }}>Active Debt</span>
                <strong className="tabular-nums" style={{ color: bankDebt > 0 ? 'var(--color-short)' : 'var(--text-primary)', fontSize: '12px' }}>
                  ${Math.round(bankDebt).toLocaleString()}
                </strong>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block' }}>Interest/Sec</span>
                <strong className="tabular-nums" style={{ color: '#f59e0b', fontSize: '12px' }}>
                  {bankRatePct}%
                </strong>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block' }}>Loss Penalty</span>
                <strong className="tabular-nums" style={{ color: losingTrades > 0 ? 'var(--color-short)' : 'var(--text-muted)', fontSize: '12px' }}>
                  +{losingTrades * 5}%
                </strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onBankBorrow && onBankBorrow(1000)}
                disabled={disabled || isLiquidated || bankDebt >= 10000}
                style={{
                  padding: '7px 0',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--accent)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: (disabled || isLiquidated || bankDebt >= 10000) ? 'not-allowed' : 'pointer'
                }}
              >
                BORROW $1,000
              </button>

              <button
                type="button"
                onClick={() => onBankRepay && onBankRepay(1000)}
                disabled={disabled || bankDebt <= 0 || balance < 10}
                style={{
                  padding: '7px 0',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--color-long)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: (disabled || bankDebt <= 0 || balance < 10) ? 'not-allowed' : 'pointer'
                }}
              >
                REPAY $1,000
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
