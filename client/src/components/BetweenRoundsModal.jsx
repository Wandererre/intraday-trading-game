import React from 'react';

export default function BetweenRoundsModal({
  roundIndex = 0,
  totalRounds = 3,
  roundSummary,
  revealedDate,
  countdown = 0,
  isHost = false,
  onForceNextRound,
  onRestartGame,
  onEndGame
}) {
  if (!roundSummary) return null;

  const { winner, biggestWin, biggestWipeout, rankings = [] } = roundSummary;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 90,
      padding: '20px'
    }}>
      <div className="card" style={{
        maxWidth: '580px',
        width: '100%',
        padding: '28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        animation: 'fadeIn 250ms ease'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 700 }}>
            ROUND {roundIndex + 1} OF {totalRounds} COMPLETE
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginTop: '2px', letterSpacing: '-0.02em' }}>
            Round Standings & Market Reveal
          </h2>

          {revealedDate && (
            <div style={{
              display: 'inline-block',
              marginTop: '10px',
              padding: '6px 14px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-hairline)',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              Historical Event: <strong style={{ color: 'var(--text-primary)' }}>{revealedDate}</strong>
            </div>
          )}
        </div>

        {/* Highlights Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            backgroundColor: 'var(--bg-page)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 10px',
            textAlign: 'center',
            border: '1px solid var(--border-hairline)'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>ROUND LEADER</span>
            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {winner ? winner.nickname : '-'}
            </strong>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-page)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 10px',
            textAlign: 'center',
            border: '1px solid var(--border-hairline)'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>BEST TRADE</span>
            <strong style={{ fontSize: '14px', color: 'var(--color-long)' }} className="tabular-nums">
              {biggestWin ? `+${biggestWin.pnl.toFixed(0)}` : '-'}
            </strong>
            {biggestWin && <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>{biggestWin.nickname}</span>}
          </div>

          <div style={{
            backgroundColor: 'var(--bg-page)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 10px',
            textAlign: 'center',
            border: '1px solid var(--border-hairline)'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>BIGGEST LOSS</span>
            <strong style={{ fontSize: '14px', color: 'var(--color-short)' }} className="tabular-nums">
              {biggestWipeout ? `-${biggestWipeout.loss.toFixed(0)}` : '-'}
            </strong>
            {biggestWipeout && <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>{biggestWipeout.nickname}</span>}
          </div>
        </div>

        {/* Fresh Balance Notice */}
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--accent-subtle)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          color: 'var(--text-primary)',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          Every trader receives a <strong>fresh $10,000 balance</strong> for next round. Final champion is decided by the <strong>sum of all rounds</strong>!
        </div>

        {/* Mini Ranking list in Delta of 10k */}
        <div style={{ marginBottom: '20px', maxHeight: '160px', overflowY: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '30px 1.4fr 1.3fr 1.3fr',
            fontSize: '11px',
            color: 'var(--text-muted)',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--border-hairline)',
            textTransform: 'uppercase'
          }}>
            <span>#</span>
            <span>Trader</span>
            <span style={{ textAlign: 'right' }}>Round Δ (vs 10k)</span>
            <span style={{ textAlign: 'right' }}>Cumulative Total</span>
          </div>

          {rankings.map((r) => {
            const roundBal = r.roundBalance ?? 10000;
            const delta10k = roundBal - 10000;
            const isProfit = delta10k >= 0;

            return (
              <div key={r.nickname} className="list-row" style={{
                display: 'grid',
                gridTemplateColumns: '30px 1.4fr 1.3fr 1.3fr',
                padding: '8px 0',
                fontSize: '13px',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>#{r.rank}</span>
                <span style={{ fontWeight: 500 }}>{r.nickname}</span>
                <span className="tabular-nums" style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: isProfit ? 'var(--color-long)' : 'var(--color-short)'
                }}>
                  {isProfit ? '+' : ''}${delta10k.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  <span style={{ fontSize: '10px', marginLeft: '3px' }}>
                    ({isProfit ? '+' : ''}{(delta10k / 100).toFixed(1)}%)
                  </span>
                </span>
                <span className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>
                  ${r.totalScore?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-hairline)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Next round in</span>
            <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>
              {countdown}s
            </div>
          </div>

          {isHost ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onRestartGame && (
                <button
                  type="button"
                  onClick={onRestartGame}
                  className="btn-base"
                  style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-hairline)'
                  }}
                  title="Restart game with everyone connected"
                >
                  Restart
                </button>
              )}
              {onEndGame && (
                <button
                  type="button"
                  onClick={onEndGame}
                  className="btn-base"
                  style={{
                    padding: '8px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-short-bg)',
                    border: '1px solid var(--color-short-border)',
                    color: 'var(--color-short)'
                  }}
                  title="End tournament and view final standings"
                >
                  End Game
                </button>
              )}
              <button
                type="button"
                onClick={onForceNextRound}
                className="btn-base btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600 }}
              >
                START NEXT ROUND
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Waiting for round countdown...</span>
          )}
        </div>
      </div>
    </div>
  );
}
