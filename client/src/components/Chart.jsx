import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';

export default function Chart({
  candles = [],
  currentCandle,
  theme = 'dark',
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
      const map = new Map();
      candles.forEach((c) => {
        const t = c.time || Math.floor(c.timestamp / 1000);
        map.set(t, {
          time: t,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
        });
      });
      const uniqueData = Array.from(map.values()).sort((a, b) => a.time - b.time);
      series.setData(uniqueData);
      chart.timeScale().fitContent();
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && chartRef.current) {
        chartRef.current.applyOptions({
          width: entries[0].contentRect.width
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
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
        seriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    const map = new Map();
    candles.forEach((c) => {
      const t = c.time || Math.floor(c.timestamp / 1000);
      map.set(t, {
        time: t,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      });
    });
    const uniqueData = Array.from(map.values()).sort((a, b) => a.time - b.time);
    seriesRef.current.setData(uniqueData);
    chartRef.current.timeScale().fitContent();
  }, [roundIndex]);

  // Update on new sub-tick
  useEffect(() => {
    if (!seriesRef.current || !currentCandle) return;
    const time = currentCandle.time || Math.floor(currentCandle.timestamp / 1000);

    try {
      seriesRef.current.update({
        time,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close
      });
    } catch (e) {
      // Fallback recovery if timestamps shifted across rounds
      const map = new Map();
      candles.forEach((c) => {
        const t = c.time || Math.floor(c.timestamp / 1000);
        map.set(t, { time: t, open: c.open, high: c.high, low: c.low, close: c.close });
      });
      map.set(time, {
        time,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close
      });
      const uniqueData = Array.from(map.values()).sort((a, b) => a.time - b.time);
      seriesRef.current.setData(uniqueData);
    }
  }, [currentCandle]);

  // Dynamic horizontal lines for all open positions
  useEffect(() => {
    if (!seriesRef.current) return;

    // Clear old price lines
    priceLinesRef.current.forEach(line => {
      try {
        seriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    const activeList = Array.isArray(positions) && positions.length > 0
      ? positions
      : (playerPosition ? [playerPosition] : []);

    activeList.forEach(pos => {
      if (pos && pos.entryPrice) {
        const entryLine = seriesRef.current.createPriceLine({
          price: pos.entryPrice,
          color: pos.side === 'LONG' ? '#10b981' : '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `${pos.side} ${pos.leverage}x`
        });
        priceLinesRef.current.push(entryLine);

        if (pos.liquidationPrice > 0) {
          const liqLine = seriesRef.current.createPriceLine({
            price: pos.liquidationPrice,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `LIQ (${pos.side})`
          });
          priceLinesRef.current.push(liqLine);
        }
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
