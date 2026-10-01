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
 * Generates ticks inside a candle using a Brownian bridge random walk.
 *
 * Rules:
 * 1. Starts at candle.open
 * 2. Ends at candle.close
 * 3. Never goes outside [candle.low, candle.high]
 * 4. Actually touches both candle.high and candle.low at random internal points
 * 5. Generates noisy Brownian bridge random walk rather than straight lines/curves.
 */
export function generateBrownianBridgeTicks(candle, N, prng) {
  const O = candle.open;
  const H = candle.high;
  const L = candle.low;
  const C = candle.close;

  if (N <= 1) return [C];
  if (N === 2) return [O, C];

  let tH = -1;
  let tL = -1;

  if (O === H) tH = 0;
  if (O === L) tL = 0;
  if (C === H && tH === -1) tH = N - 1;
  if (C === L && tL === -1) tL = N - 1;

  if (tH === -1 && tL === -1) {
    const isBull = C >= O;
    const firstLow = isBull ? (prng() < 0.7) : (prng() < 0.3);
    const mid = Math.max(1, Math.floor((N - 2) / 2));
    const t1 = 1 + Math.floor(prng() * mid);
    const t2 = Math.min(N - 2, t1 + 1 + Math.floor(prng() * Math.max(1, (N - 2 - t1))));
    if (firstLow) {
      tL = t1;
      tH = t2;
    } else {
      tH = t1;
      tL = t2;
    }
  } else if (tH === -1) {
    const candidates = [];
    for (let i = 1; i < N - 1; i++) if (i !== tL) candidates.push(i);
    tH = candidates.length > 0 ? candidates[Math.floor(prng() * candidates.length)] : 1;
  } else if (tL === -1) {
    const candidates = [];
    for (let i = 1; i < N - 1; i++) if (i !== tH) candidates.push(i);
    tL = candidates.length > 0 ? candidates[Math.floor(prng() * candidates.length)] : 1;
  }

  const anchorMap = new Map();
  anchorMap.set(0, O);
  anchorMap.set(N - 1, C);
  anchorMap.set(tH, H);
  anchorMap.set(tL, L);

  const anchors = Array.from(anchorMap.entries())
    .map(([t, p]) => ({ t, p }))
    .sort((a, b) => a.t - b.t);

  const prices = new Array(N);

  for (let a = 0; a < anchors.length - 1; a++) {
    const pA = anchors[a];
    const pB = anchors[a + 1];
    const M = pB.t - pA.t;
    prices[pA.t] = pA.p;
    prices[pB.t] = pB.p;

    if (M > 1) {
      const W = [0];
      const sigma = ((H - L) / Math.sqrt(N)) * (0.35 + prng() * 0.55);
      for (let j = 1; j <= M; j++) {
        W.push(W[j - 1] + (prng() - 0.5) * sigma);
      }
      for (let j = 1; j < M; j++) {
        const bridgeNoise = W[j] - (j / M) * W[M];
        const drift = pA.p + (j / M) * (pB.p - pA.p);
        prices[pA.t + j] = drift + bridgeNoise;
      }
    }
  }

  for (let i = 0; i < N; i++) {
    prices[i] = Math.max(L, Math.min(H, prices[i]));
    prices[i] = Math.round(prices[i] * 100) / 100;
  }

  // Enforce boundary points and extreme touches
  prices[0] = O;
  prices[N - 1] = C;
  prices[tH] = H;
  prices[tL] = L;

  return prices;
}

/**
 * Pre-schedules random market events for the round.
 * Total cumulative event magnitude is capped so it never overwhelms underlying data.
 */
export function generateRandomEvents(totalTicks, prng) {
  const eventTypes = [
    {
      type: 'FLASH_CRASH',
      name: 'Flash crash',
      message: 'Sudden cascade of market selling',
      direction: -1,
      minMag: 0.015,
      maxMag: 0.035,
      minDur: 3,
      maxDur: 6
    },
    {
      type: 'WHALE_ALERT',
      name: 'Whale alert',
      message: 'Massive market buy order detected',
      direction: 1,
      minMag: 0.015,
      maxMag: 0.035,
      minDur: 3,
      maxDur: 6
    },
    {
      type: 'SHORT_SQUEEZE',
      name: 'Short squeeze',
      message: 'Liquidation squeeze triggering stop runs',
      direction: 1,
      minMag: 0.02,
      maxMag: 0.04,
      minDur: 4,
      maxDur: 7
    },
    {
      type: 'VOLATILITY_STORM',
      name: 'Volatility storm',
      message: 'High-frequency whipsaw turbulence',
      direction: 0,
      minMag: 0.015,
      maxMag: 0.03,
      minDur: 5,
      maxDur: 8
    }
  ];

  const count = 2 + Math.floor(prng() * 2); // 2 or 3 events
  const events = [];
  const MAX_ROUND_EVENT_MAGNITUDE = 0.06; // 6% cap
  let totalMag = 0;

  const minTick = 15;
  const maxTick = Math.max(minTick + 20, totalTicks - 20);
  const step = Math.floor((maxTick - minTick) / count);

  for (let i = 0; i < count; i++) {
    const et = eventTypes[Math.floor(prng() * eventTypes.length)];
    const duration = et.minDur + Math.floor(prng() * (et.maxDur - et.minDur + 1));
    let magnitude = Math.round((et.minMag + prng() * (et.maxMag - et.minMag)) * 1000) / 1000;

    if (totalMag >= MAX_ROUND_EVENT_MAGNITUDE) break;
    if (totalMag + magnitude > MAX_ROUND_EVENT_MAGNITUDE) {
      magnitude = Math.round((MAX_ROUND_EVENT_MAGNITUDE - totalMag) * 1000) / 1000;
    }
    if (magnitude < 0.008) break; // Don't add tiny sub-threshold residual events

    totalMag = Math.round((totalMag + magnitude) * 1000) / 1000;

    const windowStart = minTick + i * step;
    const windowEnd = Math.min(maxTick - duration, windowStart + step - duration);
    const startTick = windowStart <= windowEnd
      ? windowStart + Math.floor(prng() * (windowEnd - windowStart + 1))
      : windowStart;

    events.push({
      id: `ev_${i}_${startTick}`,
      type: et.type,
      name: et.name,
      message: et.message,
      direction: et.direction,
      duration,
      magnitude: Math.round(magnitude * 1000) / 1000,
      startTick
    });
  }

  return { events, totalMagnitude: Math.round(totalMag * 1000) / 1000 };
}

/**
 * Returns a market unpredictability round segment from historical candles.
 *
 * @param {number} roundIndex - Current round index
 * @param {number} durationSeconds - Round duration in seconds (e.g. 60 to 900)
 * @param {string|null} seed - Deterministic PRNG seed
 * @param {number} candleDurationSec - Seconds per candle (e.g. 10, 15, or 30)
 */
export function getRoundCandleSegment(roundIndex, durationSeconds, seed = null, candleDurationSec = 15) {
  const seedString = seed ? `${seed}_round_${roundIndex}` : `rnd_${Date.now()}_round_${roundIndex}`;
  const prng = createPRNG(seedString);

  // 1. Determine candle parameters & playback speed
  let cDuration = candleDurationSec || 15;
  if (durationSeconds <= 10) {
    cDuration = Math.max(1, Math.floor(durationSeconds / 2));
  }
  const totalCandles = Math.max(2, Math.ceil(durationSeconds / cDuration));

  // Random playback speed variation (0.85x to 1.30x)
  const speedFactor = Math.round((0.85 + prng() * 0.45) * 100) / 100;
  const tickIntervalMs = Math.round(1000 / speedFactor);
  const playbackSpeed = `${speedFactor.toFixed(2)}x`;

  // 2. Load historical candles and splice 2 or 3 segments from different dates
  const allCandles = loadAllCandles();
  const numSegments = totalCandles >= 4 ? (prng() < 0.5 ? 2 : 3) : 1;

  // Allocate candles per segment
  const segLengths = [];
  const baseCount = Math.floor(totalCandles / numSegments);
  let rem = totalCandles % numSegments;
  for (let s = 0; s < numSegments; s++) {
    segLengths.push(baseCount + (rem > 0 ? 1 : 0));
    if (rem > 0) rem--;
  }

  const splicedCandles = [];
  const splicedMeta = [];

  for (let s = 0; s < numSegments; s++) {
    const sLen = segLengths[s];
    let startIdx = 0;
    if (allCandles.length > sLen + 30) {
      // Pick random slice from distinct date regions across the dataset
      const regionSize = Math.floor((allCandles.length - sLen - 20) / numSegments);
      startIdx = s * regionSize + Math.floor(prng() * (regionSize - 5));
    }

    const rawSlice = allCandles.length >= sLen
      ? allCandles.slice(startIdx, startIdx + sLen)
      : Array(sLen).fill(0).map((_, i) => ({
          open: 40000 + i * 20,
          high: 40000 + i * 20 + 50,
          low: 40000 + i * 20 - 50,
          close: 40000 + i * 20 + 10,
          datetime: new Date().toISOString(),
          regime: 'Synthetic Fallback'
        }));

    splicedMeta.push({
      date: rawSlice[0].datetime ? rawSlice[0].datetime.split('T')[0] : 'Historical Period',
      regime: rawSlice[0].regime || 'Crypto Regime',
      count: sLen
    });

    if (splicedCandles.length === 0) {
      rawSlice.forEach(c => splicedCandles.push({ ...c }));
    } else {
      // Chaining / Splicing: rescale segment so its first open equals previous segment's last close
      const prevClose = splicedCandles[splicedCandles.length - 1].close;
      const curOpen = rawSlice[0].open;
      const ratio = prevClose / curOpen;

      rawSlice.forEach(c => {
        splicedCandles.push({
          ...c,
          open: c.open * ratio,
          high: c.high * ratio,
          low: c.low * ratio,
          close: c.close * ratio
        });
      });
    }
  }

  // 3. Randomly flip upside down (~50% chance): invert returns
  const isFlipped = prng() < 0.5;
  if (isFlipped && splicedCandles.length > 0) {
    const P0 = splicedCandles[0].open;
    for (let i = 0; i < splicedCandles.length; i++) {
      const c = splicedCandles[i];
      const newOpen = (P0 * P0) / c.open;
      const newClose = (P0 * P0) / c.close;
      const newHigh = (P0 * P0) / c.low;
      const newLow = (P0 * P0) / c.high;
      c.open = newOpen;
      c.close = newClose;
      c.high = newHigh;
      c.low = newLow;
    }
  }

  // 4. Volatility Control: Hidden multiplier between 0.7x and 2.0x with Volatility Clustering
  const baseVolMultiplier = Math.round((0.7 + prng() * 1.3) * 100) / 100;

  // 2-state Markov chain for volatility clustering (Quiet stretches vs Bursts)
  let volState = prng() < 0.6 ? 0 : 1; // 0 = quiet, 1 = burst
  let currentChainOpen = splicedCandles[0].open;

  for (let i = 0; i < splicedCandles.length; i++) {
    // Transition probabilities
    if (volState === 0) {
      if (prng() < 0.25) volState = 1; // 25% chance to transition to burst
    } else {
      if (prng() < 0.40) volState = 0; // 40% chance to transition to quiet
    }

    const clusterFactor = volState === 0
      ? (0.70 + prng() * 0.20)  // Quiet stretch
      : (1.40 + prng() * 0.45); // Burst of big moves

    const effectiveVol = baseVolMultiplier * clusterFactor;

    const c = splicedCandles[i];
    const rClose = (c.close - c.open) / c.open;
    const rHigh = (c.high - c.open) / c.open;
    const rLow = (c.low - c.open) / c.open;

    const scaledRClose = rClose * effectiveVol;
    const scaledRHigh = rHigh * effectiveVol;
    const scaledRLow = rLow * effectiveVol;

    const o = currentChainOpen;
    const cl = o * (1 + scaledRClose);
    const hi = o * (1 + Math.max(scaledRHigh, scaledRClose, 0));
    const lo = Math.max(10, o * (1 + Math.min(scaledRLow, scaledRClose, 0)));

    c.open = o;
    c.close = cl;
    c.high = Math.max(hi, o, cl);
    c.low = Math.min(lo, o, cl);

    currentChainOpen = cl;
  }

  // 5. Rescale all prices so the round always starts at 30,000 regardless of real price
  const TARGET_START_PRICE = 30000;
  const rescaleFactor = TARGET_START_PRICE / splicedCandles[0].open;

  splicedCandles.forEach(c => {
    c.open = Math.round(c.open * rescaleFactor * 100) / 100;
    c.high = Math.round(c.high * rescaleFactor * 100) / 100;
    c.low = Math.round(c.low * rescaleFactor * 100) / 100;
    c.close = Math.round(c.close * rescaleFactor * 100) / 100;
  });

  // Guarantee chain open is exactly 30000.00
  splicedCandles[0].open = TARGET_START_PRICE;

  // 6. Generate ticks as Brownian bridge random walk inside each candle
  const baseTime = Math.floor(Date.now() / 1000) + (roundIndex * 100000);
  const baseCandles = [];
  const ticks = [];

  splicedCandles.forEach((c, cIdx) => {
    const candleTime = baseTime + (cIdx * cDuration);
    const candleObj = {
      timestamp: candleTime * 1000,
      time: candleTime,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || Math.round((300 + prng() * 600) * 10) / 10,
      datetime: new Date(candleTime * 1000).toISOString(),
      regime: 'Classified Market Session'
    };
    baseCandles.push(candleObj);

    // Brownian bridge random walk sub-ticks for this candle
    const bridgePrices = generateBrownianBridgeTicks(candleObj, cDuration, prng);

    let runningHigh = candleObj.open;
    let runningLow = candleObj.open;

    for (let t = 0; t < cDuration; t++) {
      const isCandleClose = (t === cDuration - 1);
      const tickPrice = bridgePrices[t];

      runningHigh = Math.max(runningHigh, tickPrice);
      runningLow = Math.min(runningLow, tickPrice);

      ticks.push({
        time: candleTime,
        open: candleObj.open,
        high: runningHigh,
        low: runningLow,
        close: tickPrice,
        isCandleClose,
        regime: 'Classified Market Session'
      });
    }
  });

  // 7. Pre-schedule random market events
  const { events: randomEvents, totalMagnitude } = generateRandomEvents(ticks.length, prng);

  // 8. Formulate market reveal details
  const uniqueDates = Array.from(new Set(splicedMeta.map(m => m.date)));
  const uniqueRegimes = Array.from(new Set(splicedMeta.map(m => m.regime)));

  const dateLabel = `Spliced (${uniqueDates.join(' & ')}) | Vol: ${baseVolMultiplier.toFixed(2)}x | Inverted: ${isFlipped ? 'Yes' : 'No'} | Speed: ${playbackSpeed}`;

  const marketReveal = {
    volatilityMultiplier: baseVolMultiplier,
    isFlipped,
    playbackSpeed,
    tickIntervalMs,
    splicedSegments: splicedMeta,
    events: randomEvents.map(e => e.name),
    totalEventMagnitude: totalMagnitude
  };

  return {
    ticks,
    baseCandles,
    regimeName: 'Classified Market Session', // Hidden during active round
    startDate: baseCandles[0].datetime,
    endDate: baseCandles[baseCandles.length - 1].datetime,
    dateLabel,
    volatilityMultiplier: baseVolMultiplier,
    isFlipped,
    playbackSpeed,
    tickIntervalMs,
    splicedSegments: splicedMeta,
    randomEvents,
    marketReveal
  };
}
