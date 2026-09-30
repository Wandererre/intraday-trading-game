import React, { useEffect, useRef, useState } from 'react';

export default function PriceHeader({ currentPrice = 0, initialPrice = 0, high = 0, low = 0 }) {
  const [flashClass, setFlashClass] = useState('');
  const prevPriceRef = useRef(currentPrice);

  useEffect(() => {
    if (prevPriceRef.current !== currentPrice && prevPriceRef.current > 0) {
      if (currentPrice > prevPriceRef.current) {
        setFlashClass('flash-up');
      } else if (currentPrice < prevPriceRef.current) {
        setFlashClass('flash-down');
      }
      const timer = setTimeout(() => setFlashClass(''), 750);
      prevPriceRef.current = currentPrice;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  const diff = initialPrice > 0 ? currentPrice - initialPrice : 0;
  const pct = initialPrice > 0 ? (diff / initialPrice) * 100 : 0;
  const isUp = diff >= 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      padding: '4px 0 12px 0',
      borderBottom: '1px solid var(--border-hairline)',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            BTC / USD
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '2px' }}>
            <span
              className={`tabular-nums ${flashClass}`}
              style={{
                fontSize: '28px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                transition: 'color 150ms ease'
              }}
            >
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>

            <span
              className="tabular-nums"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: isUp ? 'var(--color-long)' : 'var(--color-short)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              {isUp ? '+' : ''}{diff.toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div>
          <span>High </span>
          <span className="tabular-nums" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            ${(high || currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span>Low </span>
          <span className="tabular-nums" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            ${(low || currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
