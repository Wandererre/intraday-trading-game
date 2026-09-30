import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const OUT_FILE = path.join(DATA_DIR, 'btc_1m_sample.csv');

async function fetchFromBinance(symbol = 'BTCUSDT', interval = '1m', limit = 1000, startTime = null) {
  let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (startTime) {
    url += `&startTime=${startTime}`;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`Binance HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

// Generate realistic synthetic high-volatility historical crypto segments if offline/blocked
function generateSyntheticCandles(count = 4000) {
  const candles = [];
  let basePrice = 64250.0;
  const startTime = Date.now() - count * 60 * 1000;
  let regime = 0; // 0 = chop, 1 = pump, 2 = crash

  for (let i = 0; i < count; i++) {
    if (i % 250 === 0) {
      regime = (regime + 1) % 3;
    }
    const drift = regime === 1 ? 0.0006 : regime === 2 ? -0.0008 : 0.00002;
    const vol = regime === 2 ? 0.0035 : 0.0018;
    const shock = (Math.random() - 0.495) * 2 * vol + drift;

    const open = basePrice;
    const close = Math.round((open * (1 + shock)) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * open * vol * 0.8) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * open * vol * 0.8) * 100) / 100;
    const volume = Math.round((20 + Math.random() * 80 + Math.abs(shock) * 1000) * 10) / 10;
    const ts = startTime + i * 60 * 1000;
    const dateStr = new Date(ts).toISOString();

    candles.push({ timestamp: ts, open, high, low, close, volume, datetime: dateStr });
    basePrice = close;
  }
  return candles;
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('[download-candles] Attempting to download historical BTC 1m candles from Binance...');
  let candles = [];

  try {
    // Attempt 3 batches of 1000 candles from Binance (total 3000 1m candles = 50 hours of trading)
    let currentStartTime = Date.now() - (3000 * 60 * 1000);
    for (let b = 0; b < 3; b++) {
      console.log(`[download-candles] Fetching batch ${b + 1}/3...`);
      const klines = await fetchFromBinance('BTCUSDT', '1m', 1000, currentStartTime);
      if (!Array.isArray(klines) || klines.length === 0) break;
      for (const k of klines) {
        candles.push({
          timestamp: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          datetime: new Date(k[0]).toISOString()
        });
      }
      currentStartTime = klines[klines.length - 1][0] + 60000;
    }
    console.log(`[download-candles] Successfully downloaded ${candles.length} candles from Binance.`);
  } catch (err) {
    console.warn(`[download-candles] Binance API fetch failed (${err.message}). Using high-fidelity synthetic crypto segments.`);
    candles = generateSyntheticCandles(4000);
  }

  // Write to CSV
  const header = 'timestamp,open,high,low,close,volume,datetime\n';
  const rows = candles.map(c => `${c.timestamp},${c.open},${c.high},${c.low},${c.close},${c.volume},${c.datetime}`).join('\n');
  fs.writeFileSync(OUT_FILE, header + rows, 'utf-8');
  console.log(`[download-candles] Wrote ${candles.length} candles to ${OUT_FILE}`);
}

main();
