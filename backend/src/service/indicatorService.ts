interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Indicator {
  timestamp: number;
  sma: number;
  ema: number;
  rsi: number;
}

export function computeIndicators(candles: Candle[]): Indicator[] {
  const sma = computeSMA(candles, 14);
  const ema = computeEMA(candles, 14);
  const rsi = computeRSI(candles, 14);

  return candles.map((candle, index) => ({
    timestamp: candle.timestamp,
    sma: sma[index] || 0,
    ema: ema[index] || 0,
    rsi: rsi[index] || 0,
  }));
}

function computeSMA(candles: Candle[], period: number): number[] {
  const sma = [];
  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
    sma.push(sum / period);
  }
  return sma;
}

function computeEMA(candles: Candle[], period: number): number[] {
  const ema = [];
  const multiplier = 2 / (period + 1);
  ema.push(candles[0].close);
  for (let i = 1; i < candles.length; i++) {
    ema.push((candles[i].close - ema[i - 1]) * multiplier + ema[i - 1]);
  }
  return ema;
}

function computeRSI(candles: Candle[], period: number): number[] {
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < candles.length; i++) {
    const difference = candles[i].close - candles[i - 1].close;
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }

    if (i >= period) {
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));

      const oldDifference = candles[i - period + 1].close - candles[i - period].close;
      if (oldDifference >= 0) {
        gains -= oldDifference;
      } else {
        losses += oldDifference;
      }
    }
  }

  return rsi;
}