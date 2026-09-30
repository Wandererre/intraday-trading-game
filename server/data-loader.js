import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../data/btc_1m_sample.csv');

// Seedable PRNG (Mulberry32)
export function createPRNG(seedStr = 'default_seed') {
  let h = 0;
  const str = String(seedStr);
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  let s = h >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cachedCandles = null;

export function loadAllCandles() {
  if (cachedCandles) return cachedCandles;
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  try {
    const content = fs.readFileSync(DATA_PATH, 'utf-8');
    const lines = content.trim().split('\n');
    const candles = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 6) {
        candles.push({
          timestamp: parseInt(parts[0], 10),
          open: parseFloat(parts[1]),
          high: parseFloat(parts[2]),
          low: parseFloat(parts[3]),
          close: parseFloat(parts[4]),
          volume: parseFloat(parts[5]),
          datetime: parts[6] ? parts[6].trim() : new Date(parseInt(parts[0], 10)).toISOString(),
          regime: parts[7] ? parts[7].trim() : 'High Volatility Crypto Episode'
        });
      }
    }
    cachedCandles = candles;
    return candles;
  } catch (e) {
    return [];
  }
}

/**
 * High-volatility, unpredictable intraday crypto market regimes.
 * Engineered specifically for dynamic intraday trading:
 * fakeouts, liquidity sweeps, sharp V-reversals, Bart Simpson patterns, and intense chop.
 */
const REGIMES = [
  {
    name: 'Chopocalypse Range Trap & Liquidity Sweeps',
    description: 'Violent range-bound ping-pong with false breakout sweeps and bear traps',
    generatePath: (count, prng, basePrice) => {
      const path = [];
      let p = basePrice;
      const rangeLow = basePrice * 0.975;
      const rangeHigh = basePrice * 1.025;

      for (let i = 0; i < count; i++) {
        // High frequency mean reversion + liquidity sweep spikes
        const isSweepHigh = prng() < 0.18;
        const isSweepLow = prng() < 0.18;

        let delta;
        if (isSweepHigh) {
          // Fake breakout above resistance
          delta = (rangeHigh * 1.015 - p) * (0.8 + prng() * 0.4);
        } else if (isSweepLow) {
          // Fake breakdown below support
          delta = (rangeLow * 0.985 - p) * (0.8 + prng() * 0.4);
        } else {
          // Oscillate between support and resistance
          const center = (rangeLow + rangeHigh) / 2;
          const pull = (center - p) * 0.25;
          const noise = (prng() - 0.5) * (basePrice * 0.018);
          delta = pull + noise;
        }

        const nextP = Math.max(basePrice * 0.85, Math.round((p + delta) * 100) / 100);
        path.push({ open: p, close: nextP, isSweep: isSweepHigh || isSweepLow });
        p = nextP;
      }
      return path;
    }
  },
  {
    name: 'Bart Simpson Liquidity Sweep & Flash Dump',
    description: 'Tight coil -> violent vertical breakout -> flat top chop -> brutal liquidation flush',
    generatePath: (count, prng, basePrice) => {
      const path = [];
      let p = basePrice;
      const pumpStart = Math.max(1, Math.floor(count * 0.2));
      const pumpEnd = Math.max(pumpStart + 1, Math.floor(count * 0.35));
      const dumpStart = Math.max(pumpEnd + 1, Math.floor(count * 0.65));
      const dumpEnd = Math.max(dumpStart + 1, Math.floor(count * 0.75));

      const pumpedPrice = basePrice * 1.05;

      for (let i = 0; i < count; i++) {
        let nextP;
        if (i < pumpStart) {
          // Tight accumulation chop
          nextP = p + (prng() - 0.5) * (basePrice * 0.005);
        } else if (i <= pumpEnd) {
          // Explosive god candle pump
          const progress = (i - pumpStart + 1) / (pumpEnd - pumpStart + 1);
          nextP = basePrice + (pumpedPrice - basePrice) * progress + (prng() - 0.5) * (basePrice * 0.008);
        } else if (i < dumpStart) {
          // Erratic oscillating "Bart scalp" at highs
          nextP = pumpedPrice + (prng() - 0.5) * (basePrice * 0.015);
        } else if (i <= dumpEnd) {
          // Brutal vertical liquidation flush back to base
          const progress = (i - dumpStart + 1) / (dumpEnd - dumpStart + 1);
          nextP = pumpedPrice - (pumpedPrice - basePrice * 0.985) * progress + (prng() - 0.5) * (basePrice * 0.008);
        } else {
          // Post-flush volatility recovery bounce
          nextP = basePrice * 0.985 + (i - dumpEnd) * (basePrice * 0.003) + (prng() - 0.5) * (basePrice * 0.01);
        }
        nextP = Math.max(basePrice * 0.8, Math.round(nextP * 100) / 100);
        path.push({ open: p, close: nextP });
        p = nextP;
      }
      return path;
    }
  },
  {
    name: 'Dual Liquidation Cascade & Short Squeeze',
    description: 'Cascading knife drop triggers stop runs, followed by a violent short squeeze',
    generatePath: (count, prng, basePrice) => {
      const path = [];
      let p = basePrice;
      const bottomIdx = Math.max(2, Math.floor(count * 0.45));
      const bottomPrice = basePrice * 0.93;
      const peakPrice = basePrice * 1.04;

      for (let i = 0; i < count; i++) {
        let nextP;
        if (i <= bottomIdx) {
          // Waterfall liquidation drop
          const progress = (i + 1) / (bottomIdx + 1);
          nextP = basePrice - (basePrice - bottomPrice) * Math.pow(progress, 1.2) + (prng() - 0.5) * (basePrice * 0.012);
        } else {
          // Explosive short squeeze rally
          const progress = (i - bottomIdx) / (count - bottomIdx);
          nextP = bottomPrice + (peakPrice - bottomPrice) * Math.pow(progress, 0.85) + (prng() - 0.5) * (basePrice * 0.015);
        }
        nextP = Math.max(basePrice * 0.8, Math.round(nextP * 100) / 100);
        path.push({ open: p, close: nextP });
        p = nextP;
      }
      return path;
    }
  },
  {
    name: 'Violent Stop-Hunt Rollercoaster',
    description: 'Aggressive multi-swing oscillation with deep pullbacks and sudden rips',
    generatePath: (count, prng, basePrice) => {
      const path = [];
      let p = basePrice;
      let trendDir = prng() > 0.5 ? 1 : -1;
      let trendLen = 0;

      for (let i = 0; i < count; i++) {
        trendLen++;
        // Reversal happens unpredictably every 2 to 4 candles
        if (trendLen >= 2 && (trendLen >= 4 || prng() < 0.45)) {
          trendDir = -trendDir;
          trendLen = 0;
        }

        const swingMagnitude = (0.012 + prng() * 0.025) * basePrice;
        const delta = (trendDir * swingMagnitude) + (prng() - 0.5) * (basePrice * 0.01);
        const nextP = Math.max(basePrice * 0.8, Math.round((p + delta) * 100) / 100);
        path.push({ open: p, close: nextP });
        p = nextP;
      }
      return path;
    }
  },
  {
    name: 'Flash Crash & Fierce V-Bottom Recovery',
    description: 'Sudden -7% capitulation flush followed by instant V-bottom rally',
    generatePath: (count, prng, basePrice) => {
      const path = [];
      let p = basePrice;
      const crashIdx = Math.max(1, Math.floor(count * 0.3));

      for (let i = 0; i < count; i++) {
        let nextP;
        if (i < crashIdx) {
          nextP = p + (prng() - 0.45) * (basePrice * 0.008);
        } else if (i === crashIdx) {
          // Single giant capitulation knife
          nextP = p * 0.94;
        } else if (i === crashIdx + 1) {
          // Retest bottom with wicked bounce
          nextP = p * 1.025;
        } else {
          // Multi-candle V-recovery
          const progress = (i - crashIdx) / (count - crashIdx);
          nextP = basePrice * 0.95 + (basePrice * 0.08) * Math.min(1, progress * 1.2) + (prng() - 0.5) * (basePrice * 0.01);
        }
        nextP = Math.max(basePrice * 0.8, Math.round(nextP * 100) / 100);
        path.push({ open: p, close: nextP });
        p = nextP;
      }
      return path;
    }
  }
];

/**
 * Returns a high-volatility, unpredictable crypto market segment.
 *
 * @param {number} roundIndex - Current round index
 * @param {number} durationSeconds - Total duration of the round (e.g. 60 to 900)
 * @param {string|null} seed - Deterministic PRNG seed
 * @param {number} candleDurationSec - Duration of each candle in seconds (e.g. 10, 15, or 30)
 */
export function getRoundCandleSegment(roundIndex, durationSeconds, seed = null, candleDurationSec = 15) {
  const seedString = seed ? `${seed}_round_${roundIndex}` : `rnd_${Date.now()}_round_${roundIndex}`;
  const prng = createPRNG(seedString);

  // Determine candle duration (10s, 15s, 30s)
  // For small test durations (e.g. durationSeconds = 4), adapt gracefully
  let cDuration = candleDurationSec || 15;
  if (durationSeconds <= 10) {
    cDuration = Math.max(1, Math.floor(durationSeconds / 2));
  }
  const candleCount = Math.max(2, Math.ceil(durationSeconds / cDuration));

  // Select regime
  const regimeIdx = (roundIndex + Math.floor(prng() * REGIMES.length)) % REGIMES.length;
  const regime = REGIMES[regimeIdx];

  // Base starting price: realistic BTC prices ~42,000 to ~46,000
  const initialBasePrice = 42500 + Math.floor(prng() * 3000);

  // Generate candle path
  const candlePath = regime.generatePath(candleCount, prng, initialBasePrice);

  const baseTime = Math.floor(Date.now() / 1000) + (roundIndex * 100000);
  const baseCandles = [];
  const ticks = [];

  let currentOpen = initialBasePrice;

  candlePath.forEach((cp, cIdx) => {
    const candleTime = baseTime + (cIdx * cDuration);
    const cOpen = currentOpen;
    const cClose = cp.close;

    // Generate realistic wicks (stop hunts)
    const bodyMax = Math.max(cOpen, cClose);
    const bodyMin = Math.min(cOpen, cClose);
    const bodySize = Math.max(10, bodyMax - bodyMin);

    // Wick volatility: 40% to 120% of body size, plus noise
    const upperWick = bodySize * (0.4 + prng() * 0.9) + (prng() * 15);
    const lowerWick = bodySize * (0.4 + prng() * 0.9) + (prng() * 15);

    const cHigh = Math.round((bodyMax + upperWick) * 100) / 100;
    const cLow = Math.round(Math.max(100, bodyMin - lowerWick) * 100) / 100;
    const volume = Math.round((200 + prng() * 800 + bodySize * 2) * 10) / 10;

    const candleObj = {
      timestamp: candleTime * 1000,
      time: candleTime,
      open: cOpen,
      high: cHigh,
      low: cLow,
      close: cClose,
      volume,
      datetime: new Date(candleTime * 1000).toISOString(),
      regime: regime.name
    };
    baseCandles.push(candleObj);

    // Now generate intra-candle sub-ticks: 1 tick per second over cDuration seconds
    // All sub-ticks of this candle share candleTime so LightweightCharts updates smoothly in place
    let runningHigh = cOpen;
    let runningLow = cOpen;

    const isBull = cClose >= cOpen;
    // Wick probe target in first phase: typically probes the opposite wick first (bear trap / bull trap)
    const firstProbePrice = isBull ? cLow : cHigh;
    const secondProbePrice = isBull ? cHigh : cLow;

    for (let t = 0; t < cDuration; t++) {
      const isCandleClose = (t === cDuration - 1);
      let tickPrice;

      if (t === 0) {
        tickPrice = cOpen;
      } else if (isCandleClose) {
        tickPrice = cClose;
      } else {
        // Multi-phase intra-candle movement
        const progress = t / (cDuration - 1);
        if (progress < 0.35) {
          // Phase 1: probe opposite wick / fakeout
          const pProg = progress / 0.35;
          tickPrice = cOpen + (firstProbePrice - cOpen) * pProg + (prng() - 0.5) * 6;
        } else if (progress < 0.75) {
          // Phase 2: momentum surge toward main extreme
          const mProg = (progress - 0.35) / 0.4;
          tickPrice = firstProbePrice + (secondProbePrice - firstProbePrice) * mProg + (prng() - 0.5) * 8;
        } else {
          // Phase 3: settle toward final close with tick oscillations
          const sProg = (progress - 0.75) / 0.25;
          tickPrice = secondProbePrice + (cClose - secondProbePrice) * sProg + (prng() - 0.5) * 6;
        }
      }

      tickPrice = Math.round(tickPrice * 100) / 100;
      runningHigh = Math.max(runningHigh, tickPrice);
      runningLow = Math.min(runningLow, tickPrice);

      // On final tick, ensure high and low match exact target extremes
      if (isCandleClose) {
        runningHigh = Math.max(runningHigh, cHigh);
        runningLow = Math.min(runningLow, cLow);
      }

      ticks.push({
        time: candleTime,
        open: cOpen,
        high: runningHigh,
        low: runningLow,
        close: tickPrice,
        isCandleClose,
        regime: regime.name
      });
    }

    currentOpen = cClose;
  });

  return {
    ticks,
    baseCandles,
    regimeName: regime.name,
    startDate: baseCandles[0].datetime,
    endDate: baseCandles[baseCandles.length - 1].datetime,
    dateLabel: `${regime.name} (${new Date(baseCandles[0].datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
  };
}
