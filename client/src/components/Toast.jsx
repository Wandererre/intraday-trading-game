import React, { useEffect } from 'react';
import { Skull, TrendingUp } from 'lucide-react';

export default function Toast({ toasts = [], onDismiss }) {
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        onDismiss(toasts[0].id);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 100,
      pointerEvents: 'none'
    }}>
      {toasts.map((t) => {
        const isLiq = t.type === 'LIQUIDATION';
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: `1px solid ${isLiq ? 'var(--color-short-border)' : 'var(--color-long-border)'}`,
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              fontSize: '13px',
              color: 'var(--text-primary)',
              pointerEvents: 'auto',
              animation: 'fadeIn 200ms ease'
            }}
          >
            {isLiq ? (
              <Skull size={16} style={{ color: 'var(--color-short)', flexShrink: 0 }} />
            ) : (
              <TrendingUp size={16} style={{ color: 'var(--color-long)', flexShrink: 0 }} />
            )}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
