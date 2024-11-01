import * as ccxt from "ccxt";
import { Pool } from 'pg';
import { computeIndicators } from './indicatorService';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const exchange = new ccxt.binance({
  enableRateLimit: true,
  options: {
    defaultType: 'future',
  },
});

let isDataFilling = false;

interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ImportStatus {
  symbol: string;
  timeframes: {
    [key: string]: {
      latestTimestamp: number;
      count: number;
    }
  };
}

let importStatus: ImportStatus = {
  symbol: 'BTC/USDT',
  timeframes: {}
};

function mapToOHLCVData(data: ccxt.OHLCV): OHLCVData {
  const [timestamp, open, high, low, close, volume] = data;
  return {
    timestamp: timestamp ?? 0,
    open: open ?? 0,
    high: high ?? 0,
    low: low ?? 0,
    close: close ?? 0,
    volume: volume ?? 0
  };
}

function cleanNumericValue(value: number | string | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export async function fillMissingData() {
  isDataFilling = true;
  const symbol = 'BTC/USDT';
  const timeframes = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

  for (const timeframe of timeframes) {
    console.log(`Starting to fill missing data for ${symbol} ${timeframe}`);
    await fillMissingDataForSymbolAndTimeframe(symbol, timeframe);
    console.log(`Finished filling missing data for ${symbol} ${timeframe}`);
  }
  isDataFilling = false;
  console.log('Finished filling all missing data');
}

async function fillMissingDataForSymbolAndTimeframe(symbol: string, timeframe: string) {
  const latestCandlestick = await getLatestCandlestickFromDB(symbol, timeframe);
  let since = latestCandlestick ? latestCandlestick.timestamp.getTime() : exchange.parse8601('2020-01-01T00:00:00Z');
  let count = 0;

  while (true) {
    console.log(`Fetching candles for ${symbol} ${timeframe} since ${new Date(since)}`);
    const candles = await exchange.fetchOHLCV(symbol, timeframe, since, 1000);
    if (candles.length === 0) break;

    await storeCandlesticks(symbol, timeframe, candles);
    count += candles.length;
    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      const mappedLastCandle = mapToOHLCVData(lastCandle);
      since = mappedLastCandle.timestamp + 1;
      importStatus.timeframes[timeframe] = {
        latestTimestamp: mappedLastCandle.timestamp,
        count: count
      };
    } else {
      break;
    }
    console.log(`Stored ${candles.length} candles for ${symbol} ${timeframe}. Total: ${count}`);
  }

  await computeAndStoreIndicators(symbol, timeframe);
}
async function getLatestCandlestickFromDB(symbol: string, timeframe: string) {
  const result = await pool.query(
    'SELECT * FROM candlesticks WHERE symbol = $1 AND timeframe = $2 ORDER BY timestamp DESC LIMIT 1',
    [symbol, timeframe]
  );
  return result.rows[0];
}

async function storeCandlesticks(symbol: string, timeframe: string, candles: ccxt.OHLCV[]) {
  const query = `
    INSERT INTO candlesticks (symbol, timeframe, timestamp, open, high, low, close, volume)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING
  `;

  for (const candle of candles) {
    const mappedCandle = mapToOHLCVData(candle);
    const cleanedOpen = cleanNumericValue(mappedCandle.open);
    const cleanedHigh = cleanNumericValue(mappedCandle.high);
    const cleanedLow = cleanNumericValue(mappedCandle.low);
    const cleanedClose = cleanNumericValue(mappedCandle.close);
    const cleanedVolume = cleanNumericValue(mappedCandle.volume);

    if (cleanedOpen !== null && cleanedHigh !== null && cleanedLow !== null &&
        cleanedClose !== null && cleanedVolume !== null) {
      await pool.query(query, [
        symbol,
        timeframe,
        new Date(mappedCandle.timestamp),
        cleanedOpen,
        cleanedHigh,
        cleanedLow,
        cleanedClose,
        cleanedVolume
      ]);
    } else {
      console.warn(`Skipping invalid candle data for ${symbol} ${timeframe} at ${new Date(mappedCandle.timestamp)}`);
    }
  }
}

export async function getLatestCandlestick(symbol: string, timeframe: string): Promise<OHLCVData | null> {
  try {
    const candles = await exchange.fetchOHLCV(symbol, timeframe, undefined, 1);
    return candles.length > 0 ? mapToOHLCVData(candles[0]) : null;
  } catch (error) {
    console.error(`Error fetching latest candlestick for ${symbol} ${timeframe}:`, error);
    return null;
  }
}

async function computeAndStoreIndicators(symbol: string, timeframe: string) {
  try {
    console.log(`Computing indicators for ${symbol} ${timeframe}`);
    const result = await pool.query(`
      SELECT c.* FROM candlesticks c
      LEFT JOIN indicators i ON c.symbol = i.symbol AND c.timeframe = i.timeframe AND c.timestamp = i.timestamp
      WHERE c.symbol = $1 AND c.timeframe = $2 AND i.id IS NULL
      ORDER BY c.timestamp ASC
      LIMIT 1000
    `, [symbol, timeframe]);

    const candles = result.rows;
    if (candles.length === 0) {
      console.log(`No new candles to compute indicators for ${symbol} ${timeframe}`);
      return;
    }

    const indicators = computeIndicators(candles);

    const query = `
      INSERT INTO indicators (symbol, timeframe, timestamp, sma, ema, rsi, computed_indicators)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (symbol, timeframe, timestamp) DO UPDATE
      SET sma = EXCLUDED.sma, ema = EXCLUDED.ema, rsi = EXCLUDED.rsi, computed_indicators = EXCLUDED.computed_indicators
    `;

    for (const indicator of indicators) {
      await pool.query(query, [
        symbol,
        timeframe,
        indicator.timestamp,
        indicator.sma,
        indicator.ema,
        indicator.rsi,
        JSON.stringify(['sma', 'ema', 'rsi'])
      ]);
    }

    console.log(`Computed and stored indicators for ${candles.length} candles of ${symbol} ${timeframe}`);
  } catch (error) {
    console.error(`Error computing and storing indicators for ${symbol} ${timeframe}:`, error);
  }
}

export function getImportStatus(): ImportStatus {
  return importStatus;
}

export function isDataFillingInProgress() {
  return isDataFilling;
}