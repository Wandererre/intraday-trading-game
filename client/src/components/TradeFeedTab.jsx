import React from 'react';

export default function TradeFeedTab({ feed = [] }) {
  if (feed.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No trades executed in this round yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {feed.map((item) => {
        const isLiq = item.type === 'LIQUIDATION';
        const isClose = item.type === 'CLOSE';
        const isOpen = item.type === 'OPEN';
        const isBank = item.type === 'BANK_LOAN' || item.type === 'BANK_REPAY';
        const isLong = item.side === 'LONG';
        const isProfit = isClose && item.pnl >= 0;

        return (
          <div
            key={item.id}
            className="list-row"
            style={{
              padding: '8px 0',
              backgroundColor: isLiq ? 'var(--color-short-bg)' : 'transparent',
              borderRadius: isLiq ? 'var(--radius-sm)' : '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isLiq ? (
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-short)', letterSpacing: '0.04em' }}>
                  [LIQ]
                </span>
              ) : isBank ? (
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                  [BANK]
                </span>
              ) : isLong ? (
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-long)', letterSpacing: '0.04em' }}>
                  [BUY]
                </span>
              ) : (
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-short)', letterSpacing: '0.04em' }}>
                  [SELL]
                </span>
              )}

              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {item.nickname}
              </span>



              <span style={{ color: 'var(--text-secondary)' }}>
                {isOpen && `opened ${item.side} ${item.leverage}x`}
                {isClose && `closed ${item.side} ${item.leverage}x`}
                {isLiq && `liquidated on ${item.side} ${item.leverage}x`}
                {item.type === 'BANK_LOAN' && `borrowed $${item.amount} at ${item.ratePct}%/s`}
                {item.type === 'BANK_REPAY' && `repaid $${item.amount} loan`}
              </span>
            </div>

            <div className="tabular-nums" style={{ fontSize: '12px' }}>
              {isOpen && (
                <span style={{ color: 'var(--text-muted)' }}>
                  @ ${item.price?.toFixed(0)} (${item.margin} margin)
                </span>
              )}
              {isClose && (
                <span style={{
                  fontWeight: 600,
                  color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
                }}>
                  {isProfit ? '+' : ''}${item.pnl?.toFixed(2)} ({isProfit ? '+' : ''}{item.pnlPct?.toFixed(1)}%)
                </span>
              )}
              {isLiq && (
                <span style={{ fontWeight: 700, color: 'var(--color-short)' }}>
                  -${item.loss?.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
