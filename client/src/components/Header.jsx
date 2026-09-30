import React from 'react';

export default function Header({
  connected,
  gameState,
  roundIndex = 0,
  totalRounds = 3,
  timeLeftSec = 0,
  totalTicks = 60,
  isHost = false,
  roomCode = '',
  theme,
  onToggleTheme,
  onRestartGame,
  onEndGame
}) {
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct = totalTicks > 0 ? Math.min(100, Math.max(0, ((totalTicks - timeLeftSec) / totalTicks) * 100)) : 0;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: connected ? 'var(--color-long)' : 'var(--color-short)'
          }} />
          <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '-0.01em' }}>
            INTRADAY<span style={{ color: 'var(--accent)' }}>.ARENA</span>
          </span>
        </div>

        {gameState === 'ROUND_ACTIVE' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 8px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>ROUND</span>
            <span style={{ fontWeight: 600 }} className="tabular-nums">{roundIndex + 1} / {totalRounds}</span>
          </div>
        )}

        {isHost && (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--accent)',
            border: '1px solid var(--border-hairline)'
          }}>
            HOST
          </span>
        )}

        {roomCode && (
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-hairline)',
            color: 'var(--text-secondary)'
          }} title={`Arena Room: ${roomCode}`}>
            {roomCode}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* Host Game Control Buttons (Restart & End Game) */}
        {isHost && gameState !== 'LOBBY' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={onRestartGame}
              className="btn-base"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 9px',
                borderRadius: 'var(--radius-sm)'
              }}
              title="Restart entire match keeping all connected players in room"
            >
              Restart Game
            </button>

            <button
              type="button"
              onClick={onEndGame}
              className="btn-base"
              style={{
                backgroundColor: 'var(--color-short-bg)',
                border: '1px solid var(--color-short-border)',
                color: 'var(--color-short)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 9px',
                borderRadius: 'var(--radius-sm)'
              }}
              title="Stop and jump immediately to final championship results"
            >
              End Game
            </button>
          </div>
        )}

        {gameState === 'ROUND_ACTIVE' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>TIME</span>
            <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '40px' }} className="tabular-nums">
              {formatTime(timeLeftSec)}
            </span>
            <div style={{
              width: '60px',
              height: '3px',
              backgroundColor: 'var(--border-hairline)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                backgroundColor: 'var(--accent)',
                transition: 'width 700ms linear'
              }} />
            </div>
          </div>
        )}

        <button
          onClick={onToggleTheme}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-hairline)',
            color: 'var(--text-secondary)',
            padding: '5px 9px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}
          title="Toggle light / dark mode"
        >
          {theme === 'dark' ? 'LIGHT' : 'DARK'}
        </button>
      </div>
    </header>
  );
}
