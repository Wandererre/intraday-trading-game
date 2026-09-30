import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';

export default function Chart({
  candles = [],
  currentCandle,
  theme = 'light',
  positions = [],
  playerPosition,
  roundIndex = 0
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#12151b' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#64748b',
        fontSize: 11,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: LineStyle.Dotted
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: LineStyle.Dotted
        }
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        timeVisible: true,
        secondsVisible: true
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
      }
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });

    chartRef.current = chart;
    seriesRef.current = series;

    if (candles.length > 0) {
      try {
        const map = new Map();
        candles.forEach((c) => {
          if (!c) return;
          const t = Number(c.time || Math.floor(c.timestamp / 1000));
          if (!Number.isFinite(t)) return;
          map.set(t, {
            time: t,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          });
        });
        const uniqueData = Array.from(map.values())
          .filter(c => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
          .sort((a, b) => a.time - b.time);
        if (uniqueData.length > 0) {
          series.setData(uniqueData);
          chart.timeScale().fitContent();
        }
      } catch (err) {
        console.warn('Initial chart setData error:', err);
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: entries[0].contentRect.width
          });
        } catch (e) {}
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      try {
        resizeObserver.disconnect();
        if (chartRef.current) {
          chartRef.current.remove();
        }
      } catch (e) {}
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [theme]);

  // Round transition: reset candles cleanly without requiring page reload
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    // Clear old position price lines
    priceLinesRef.current.forEach(line => {
      try {
        if (seriesRef.current && line) {
          seriesRef.current.removePriceLine(line);
        }
      } catch (e) {}
    });
    priceLinesRef.current = [];

    try {
      const map = new Map();
      candles.forEach((c) => {
        if (!c) return;
        const t = Number(c.time || Math.floor(c.timestamp / 1000));
        if (!Number.isFinite(t)) return;
        map.set(t, {
          time: t,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close)
        });
      });
      const uniqueData = Array.from(map.values())
        .filter(c => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
        .sort((a, b) => a.time - b.time);
      if (uniqueData.length > 0) {
        seriesRef.current.setData(uniqueData);
        chartRef.current.timeScale().fitContent();
      }
    } catch (err) {
      console.warn('Round change chart setData error:', err);
    }
  }, [roundIndex]);

  // Update on new sub-tick
  useEffect(() => {
    if (!seriesRef.current || !currentCandle) return;
    const time = Number(currentCandle.time || Math.floor(currentCandle.timestamp / 1000));
    if (!Number.isFinite(time)) return;

    const candleObj = {
      time,
      open: Number(currentCandle.open),
      high: Number(currentCandle.high),
      low: Number(currentCandle.low),
      close: Number(currentCandle.close)
    };

    if (
      !Number.isFinite(candleObj.open) ||
      !Number.isFinite(candleObj.high) ||
      !Number.isFinite(candleObj.low) ||
      !Number.isFinite(candleObj.close)
    ) {
      return;
    }

    try {
      seriesRef.current.update(candleObj);
    } catch (e) {
      // Fallback recovery if timestamps shifted across rounds
      try {
        const map = new Map();
        candles.forEach((c) => {
          if (!c) return;
          const t = Number(c.time || Math.floor(c.timestamp / 1000));
          if (!Number.isFinite(t)) return;
          map.set(t, {
            time: t,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          });
        });
        map.set(time, candleObj);
        const uniqueData = Array.from(map.values())
          .filter(c => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
          .sort((a, b) => a.time - b.time);
        if (uniqueData.length > 0) {
          seriesRef.current.setData(uniqueData);
        }
      } catch (fallbackErr) {
        console.warn('Fallback chart setData error:', fallbackErr);
      }
    }
  }, [currentCandle]);

  // Dynamic horizontal lines for all open positions
  useEffect(() => {
    if (!seriesRef.current) return;

    // Clear old price lines
    priceLinesRef.current.forEach(line => {
      try {
        if (seriesRef.current && line) {
          seriesRef.current.removePriceLine(line);
        }
      } catch (e) {}
    });
    priceLinesRef.current = [];

    const activeList = Array.isArray(positions) && positions.length > 0
      ? positions
      : (playerPosition ? [playerPosition] : []);

    activeList.forEach(pos => {
      if (!pos || !seriesRef.current) return;

      const entryPrice = Number(pos.entryPrice);
      if (Number.isFinite(entryPrice) && entryPrice > 0) {
        try {
          const entryLine = seriesRef.current.createPriceLine({
            price: entryPrice,
            color: pos.side === 'LONG' ? '#10b981' : '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${pos.side || ''} ${pos.leverage || 1}x`
          });
          if (entryLine) priceLinesRef.current.push(entryLine);
        } catch (e) {}
      }

      const liqPrice = Number(pos.liquidationPrice);
      if (Number.isFinite(liqPrice) && liqPrice > 0) {
        try {
          const liqLine = seriesRef.current.createPriceLine({
            price: liqPrice,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `LIQ (${pos.side || ''})`
          });
          if (liqLine) priceLinesRef.current.push(liqLine);
        } catch (e) {}
      }
    });
  }, [positions, playerPosition]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '380px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-hairline)',
          backgroundColor: 'var(--bg-surface)'
        }}
      />
    </div>
  );
}
