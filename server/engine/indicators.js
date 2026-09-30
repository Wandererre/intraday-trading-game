/**
 * Financial technical indicators computed incrementally or over rolling arrays.
 */

export function calculateSMA(prices, period = 14) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(prices.length - period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

export function calculateEMA(prices, period = 14) {
  if (!prices || prices.length === 0) return null;
  if (prices.length < period) {
    return calculateSMA(prices, prices.length);
  }
  const k = 2 / (period + 1);
  let ema = calculateSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] * k) + (ema * (1 - k));
  }
  return ema;
}

export function calculateRSI(prices, period = 14) {
  if (!prices || prices.length <= period) return 50; // default neutral if not enough data
  const slice = prices.slice(prices.length - (period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses += Math.abs(diff);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculatePctChange(prices, lookback = 10) {
  if (!prices || prices.length <= lookback) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - lookback];
  if (!past || past === 0) return 0;
  return ((current - past) / past) * 100;
}

export function calculateHighest(prices, lookback = 10) {
  if (!prices || prices.length === 0) return null;
  const slice = prices.slice(Math.max(0, prices.length - lookback));
  return Math.max(...slice);
}

export function calculateLowest(prices, lookback = 10) {
  if (!prices || prices.length === 0) return null;
  const slice = prices.slice(Math.max(0, prices.length - lookback));
  return Math.min(...slice);
}
