import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';

const PLAYER_COLORS = [
  '#f59e0b', // Gold / Amber (Winner)
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16'  // Lime
];

export default function FinalResultsModal({
  allHistories = {},
  allStats = {},
  roundDurations = [],
  revealedDate = '',
  isHost = false,
  onRestartGame,
  onPlayAgain,
  onLeaveRoom
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [animProgress, setAnimProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hoverData, setHoverData] = useState(null);
  const [selectedTrader, setSelectedTrader] = useState('all');

  // Determine rankings by total cumulative score
  const rankings = Object.entries(allStats)
    .map(([nickname, stats]) => ({
      nickname,
      balance: stats.finalBalance || 10000,
      returnPct: stats.totalReturnPct || 0,
      roundBalances: stats.roundBalances || [],
      stats
    }))
    .sort((a, b) => b.balance - a.balance);

  const winner = rankings[0];

  const colorMap = {};
  rankings.forEach((r, idx) => {
    colorMap[r.nickname] = PLAYER_COLORS[idx % PLAYER_COLORS.length];
  });

  let rawMin = Infinity;
  let rawMax = -Infinity;
  let maxGameTime = 0;

  for (const [nickname, history] of Object.entries(allHistories)) {
    for (const pt of history) {
      if (typeof pt.equity === 'number' && !isNaN(pt.equity)) {
        if (pt.equity < rawMin) rawMin = pt.equity;
        if (pt.equity > rawMax) rawMax = pt.equity;
      }
      if (pt.gameTimeSec > maxGameTime) maxGameTime = pt.gameTimeSec;
    }
  }

  if (rawMin === Infinity) rawMin = 10000;
  if (rawMax === -Infinity) rawMax = 10000;
  if (maxGameTime === 0) maxGameTime = 300;

  // Always encompass the $10,000 baseline in chart scale
  const spreadMin = Math.min(rawMin, 10000);
  const spreadMax = Math.max(rawMax, 10000);
  const spread = spreadMax - spreadMin;

  // Dynamic vertical scaling so small profits ($1 - $10) are visually prominent and distinct
  let padding;
  if (spread <= 1) {
    padding = 2; // Flat or near-flat: $4 total span
  } else if (spread < 20) {
    padding = Math.max(1.5, spread * 0.25); // e.g. spread = 4 -> padding = 1.5 -> span = 7
  } else if (spread < 100) {
    padding = Math.max(5, spread * 0.2);
  } else if (spread < 1000) {
    padding = Math.max(20, spread * 0.15);
  } else {
    padding = Math.max(50, spread * 0.1);
  }

  const minEquity = Math.max(0, spreadMin - padding);
  const maxEquity = spreadMax + padding;
  const equitySpan = Math.max(1, maxEquity - minEquity);

  const formatDeltaVal = (val) => {
    const abs = Math.abs(val);
    if (equitySpan < 15) return abs.toFixed(2);
    if (equitySpan < 50) return abs.toFixed(1);
    return Math.round(abs).toLocaleString();
  };

  useEffect(() => {
    let startTime = null;
    const durationMs = 10000;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      setAnimProgress(progress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        setIsCompleted(true);
        triggerConfetti();
      }
    };

    animationRef.current = requestAnimationFrame(step);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  };

  const handleSkip = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setAnimProgress(1);
    setIsCompleted(true);
    triggerConfetti();
  };

  // High-DPI Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const logicalW = 700;
    const logicalH = 360;
    const dpr = window.devicePixelRatio || 2;

    if (canvas.width !== logicalW * dpr) {
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalW, logicalH);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    ctx.fillStyle = isLight ? '#ffffff' : '#090b0e';
    ctx.fillRect(0, 0, logicalW, logicalH);

    const padLeft = 70;
    const padRight = 30;
    const padTop = 35;
    const padBottom = 40;
    const plotW = logicalW - padLeft - padRight;
    const plotH = logicalH - padTop - padBottom;

    const scaleX = (timeSec) => padLeft + (timeSec / maxGameTime) * plotW;
    const scaleY = (eq) => padTop + plotH - ((eq - minEquity) / equitySpan) * plotH;

    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';

    // Draw baseline at $10,000
    if (10000 >= minEquity && 10000 <= maxEquity) {
      const y10k = scaleY(10000);
      ctx.strokeStyle = isLight ? 'rgba(13, 148, 136, 0.6)' : 'rgba(78, 201, 176, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, y10k);
      ctx.lineTo(logicalW - padRight, y10k);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isLight ? '#0d9488' : '#4EC9B0';
      ctx.fillText('Δ $0 (10k)', padLeft - 8, y10k + 3);
    }

    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const eqVal = minEquity + (i / ySteps) * equitySpan;
      const delta = eqVal - 10000;
      if (Math.abs(delta) < equitySpan / 20) continue; // skip if close to 10k line

      const y = scaleY(eqVal);
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(logicalW - padRight, y);
      ctx.stroke();

      const isPos = delta > 0;
      ctx.fillStyle = isPos
        ? (isLight ? '#059669' : 'rgba(16, 185, 129, 0.85)')
        : (isLight ? '#dc2626' : 'rgba(239, 68, 68, 0.85)');
      const sign = isPos ? '+' : '-';
      ctx.fillText(`${sign}$${formatDeltaVal(delta)}`, padLeft - 8, y + 4);
    }

    let accumulatedTime = 0;
    roundDurations.forEach((dur, rIdx) => {
      accumulatedTime += dur;
      if (accumulatedTime <= maxGameTime) {
        const x = scaleX(accumulatedTime);
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.16)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, logicalH - padBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Round ${rIdx + 1} (${dur}s)`, x, logicalH - padBottom + 18);
      }
    });

    const currentTimeLimit = maxGameTime * animProgress;

    for (const [nickname, history] of Object.entries(allHistories)) {
      if (!history || history.length === 0) continue;

      const isSelected = selectedTrader === 'all' || selectedTrader === nickname;
      const isWinner = winner && winner.nickname === nickname;
      const color = colorMap[nickname] || '#3b82f6';

      ctx.save();
      if (!isSelected) {
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#64748b';
      } else {
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = (selectedTrader === nickname) ? 4.0 : (isWinner ? 3.0 : 2.0);
        ctx.strokeStyle = color;
      }

      ctx.beginPath();

      let started = false;
      const visiblePoints = [];

      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        if (pt.gameTimeSec > currentTimeLimit) break;
        visiblePoints.push(pt);

        const x = scaleX(pt.gameTimeSec);
        const y = scaleY(pt.equity);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      if (isSelected) {
        for (const pt of visiblePoints) {
          if (pt.event === 'liquidation') {
            const lx = scaleX(pt.gameTimeSec);
            const ly = scaleY(pt.equity);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (visiblePoints.length > 0) {
          const lastPt = visiblePoints[visiblePoints.length - 1];
          const hx = scaleX(lastPt.gameTimeSec);
          const hy = scaleY(lastPt.equity);

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(hx, hy, (selectedTrader === nickname || isWinner) ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();

          if (isCompleted) {
            ctx.font = (selectedTrader === nickname || isWinner) ? 'bold 11px -apple-system, sans-serif' : '10px -apple-system, sans-serif';
            ctx.textAlign = 'left';
            const endDelta = lastPt.equity - 10000;
            const sign = endDelta >= 0 ? '+' : '-';
            ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
            ctx.fillText(`${nickname} (Δ ${sign}$${formatDeltaVal(endDelta)})`, hx + 8, hy + 3);
          }
        }
      }

      ctx.restore();
    }

    if (hoverData && hoverData.timeSec <= maxGameTime) {
      const hx = scaleX(hoverData.timeSec);
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, logicalH - padBottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [animProgress, isCompleted, hoverData, selectedTrader]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const logicalW = 700;
    const padLeft = 70;
    const padRight = 30;
    const plotW = logicalW - padLeft - padRight;
    const scaleFactor = logicalW / rect.width;
    const scaledX = x * scaleFactor;

    if (scaledX >= padLeft && scaledX <= logicalW - padRight) {
      const ratio = (scaledX - padLeft) / plotW;
      const timeSec = Math.round(ratio * maxGameTime);

      const values = {};
      for (const [nick, history] of Object.entries(allHistories)) {
        let closest = history[0];
        for (const pt of history) {
          if (pt.gameTimeSec <= timeSec) {
            closest = pt;
          } else {
            break;
          }
        }
        if (closest) {
          values[nick] = closest.equity;
        }
      }
      setHoverData({ timeSec, values });
    } else {
      setHoverData(null);
    }
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `intraday-arena-championship-${Date.now()}.png`;
    a.click();
  };

  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isLight ? 'rgba(248, 250, 252, 0.98)' : 'rgba(9, 11, 14, 0.96)',
      color: 'var(--text-primary)',
      backdropFilter: 'blur(8px)',
      overflowY: 'auto',
      zIndex: 100,
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1060px', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 700 }}>
              FINAL TOURNAMENT RESULTS
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', marginTop: '2px' }}>
              Championship Standings
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!isCompleted && (
              <button
                onClick={handleSkip}
                className="btn-base btn-outline"
                style={{ fontSize: '12px' }}
              >
                Skip Animation
              </button>
            )}

            {isHost && onRestartGame && (
              <button
                onClick={onRestartGame}
                className="btn-base"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'var(--color-long-bg)',
                  border: '1px solid var(--color-long-border)',
                  color: 'var(--color-long)',
                  fontWeight: 600
                }}
              >
                Restart Game (Keep Everyone Connected)
              </button>
            )}

            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="btn-base"
                style={{
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-page)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}
                title="Leave room and return to home screen"
              >
                ← Exit to Home
              </button>
            )}

            <button
              onClick={handleExportPNG}
              className="btn-base btn-primary"
              style={{ fontSize: '12px' }}
            >
              Export Chart PNG
            </button>
          </div>
        </div>

        {/* Main Grid: Chart on Left, Podium on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '16px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '16px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Multiplayer Equity Trajectories
              </span>
              {hoverData && (
                <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Time: {hoverData.timeSec}s
                </span>
              )}
            </div>

            {/* Individual Trader Chart Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '10px',
              padding: '6px 8px',
              backgroundColor: 'var(--bg-page)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-hairline)'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px', fontWeight: 600 }}>
                Chart View:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTrader('all')}
                className="btn-base"
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  backgroundColor: selectedTrader === 'all' ? 'var(--accent)' : 'transparent',
                  color: selectedTrader === 'all' ? '#000000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-hairline)',
                  fontWeight: selectedTrader === 'all' ? 700 : 500
                }}
              >
                All Traders
              </button>
              {rankings.map(r => (
                <button
                  key={r.nickname}
                  type="button"
                  onClick={() => setSelectedTrader(r.nickname)}
                  className="btn-base"
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    backgroundColor: selectedTrader === r.nickname ? 'rgba(255,255,255,0.14)' : 'transparent',
                    color: selectedTrader === r.nickname ? 'var(--text-primary)' : colorMap[r.nickname] || 'var(--text-secondary)',
                    border: `1px solid ${selectedTrader === r.nickname ? colorMap[r.nickname] : 'var(--border-hairline)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: selectedTrader === r.nickname ? 700 : 500
                  }}
                  title={`View ${r.nickname}'s chart in detail`}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: colorMap[r.nickname] }} />
                  <span>{r.nickname}</span>
                </button>
              ))}
            </div>

            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverData(null)}
              style={{
                width: '100%',
                height: '360px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-page)',
                cursor: 'crosshair',
                display: 'block'
              }}
            />

            {hoverData && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: '28px',
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(18, 21, 27, 0.95)',
                border: '1px solid var(--border-hairline)',
                boxShadow: isLight ? '0 4px 14px rgba(0,0,0,0.12)' : '0 4px 14px rgba(0,0,0,0.5)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: '11px',
                pointerEvents: 'none'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Equity @ {hoverData.timeSec}s (Δ vs 10k)
                </div>
                {Object.entries(hoverData.values).map(([nick, val]) => {
                  const delta = val - 10000;
                  const isProfit = delta >= 0;
                  return (
                    <div key={nick} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '1px 0' }}>
                      <span style={{ color: colorMap[nick] || 'var(--text-primary)' }}>{nick}</span>
                      <span className="tabular-nums" style={{ fontWeight: 600, color: isProfit ? 'var(--color-long)' : 'var(--color-short)' }}>
                        {isProfit ? '+' : '-'}${formatDeltaVal(delta)}
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                          (${equitySpan < 50 ? val.toFixed(2) : Math.round(val).toLocaleString()})
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Podium Card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Podium Standings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rankings.map((r, idx) => {
                const isWin = idx === 0;
                const totalRoundsPlayed = Math.max(1, roundDurations.length);
                const baseCapital = totalRoundsPlayed * 10000;
                const netDelta = r.balance - baseCapital;
                const isNetProfit = netDelta >= 0;

                return (
                  <div
                    key={r.nickname}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: isWin ? 'var(--color-long-bg)' : 'var(--bg-page)',
                      border: `1px solid ${isWin ? 'var(--color-long-border)' : 'var(--border-hairline)'}`,
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-muted)'
                      }}>
                        #{idx + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                          {r.nickname}
                        </div>
                        <span className="tabular-nums" style={{
                          fontSize: '11px',
                          color: isNetProfit ? 'var(--color-long)' : 'var(--color-short)'
                        }}>
                          {isNetProfit ? '+' : ''}{r.returnPct}%
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="tabular-nums" style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: isNetProfit ? 'var(--color-long)' : 'var(--color-short)'
                      }}>
                        {isNetProfit ? '+' : ''}${Math.abs(netDelta) < 50 && !Number.isInteger(netDelta) ? netDelta.toFixed(2) : Math.round(netDelta).toLocaleString('en-US')}
                      </div>
                      <div className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Total: ${r.balance?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Player Stats Breakdown Strip */}
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>
            Trader Performance Analytics
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {rankings.map((r) => {
              const s = r.stats;
              const totalPnL = (s.manualPnL || 0) + (s.rulePnL || 0);
              const botShare = totalPnL !== 0 ? Math.round(((s.rulePnL || 0) / Math.abs(totalPnL)) * 100) : 0;

              return (
                <div
                  key={r.nickname}
                  style={{
                    backgroundColor: 'var(--bg-page)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px', color: colorMap[r.nickname] || 'var(--text-primary)' }}>
                      {r.nickname}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {s.totalTrades || 0} trades
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Best Trade:</span>
                      <span className="tabular-nums" style={{ color: 'var(--color-long)', fontWeight: 500 }}>
                        +${s.bestTradePnL?.toFixed(0) || '0'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Worst Trade:</span>
                      <span className="tabular-nums" style={{ color: 'var(--color-short)', fontWeight: 500 }}>
                        ${s.worstTradePnL?.toFixed(0) || '0'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Max Leverage:</span>
                      <span className="tabular-nums" style={{ fontWeight: 500 }}>
                        {s.maxLeverageUsed || 1}x
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Bot Share:</span>
                      <span className="tabular-nums" style={{ fontWeight: 500 }}>
                        {botShare}% Bot
                      </span>
                    </div>

                    {(s.totalInterestPaid || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-short)' }}>Bank Interest Paid:</span>
                        <span className="tabular-nums" style={{ color: 'var(--color-short)', fontWeight: 600 }}>
                          -${Math.round(s.totalInterestPaid)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
