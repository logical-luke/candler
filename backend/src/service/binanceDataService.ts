import * as ccxt from "ccxt";
import {Pool} from 'pg';
import {computeIndicators, Indicator, INDICATOR_KEYS} from './indicatorService';

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
let isCandlestickFilling = false;
let isIndicatorFilling = false;
let currentlyFillingTimeframe: string | null = null;
let currentlyFillingIndicator: string | null = null;

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
    candlestickFilling: boolean;
    indicatorFilling: boolean;
    currentlyFillingTimeframe: string | null;
    currentlyFillingIndicator: string | null;
}

let importStatus: ImportStatus = {
    symbol: 'BTC/USDT',
    timeframes: {},
    candlestickFilling: false,
    indicatorFilling: false,
    currentlyFillingTimeframe: null,
    currentlyFillingIndicator: null
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

function cleanNumericValue(value: any): number | null {
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
    isCandlestickFilling = true;
    const symbol = 'BTC/USDT';
    const timeframes = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

    for (const timeframe of timeframes) {
        console.log(`Starting to fill missing data for ${symbol} ${timeframe}`);
        currentlyFillingTimeframe = timeframe;
        importStatus.currentlyFillingTimeframe = timeframe;
        await fillMissingDataForSymbolAndTimeframe(symbol, timeframe);
        console.log(`Finished filling missing data for ${symbol} ${timeframe}`);
    }

    isCandlestickFilling = false;
    currentlyFillingTimeframe = null;
    importStatus.currentlyFillingTimeframe = null;
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING
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
        isIndicatorFilling = true;
        currentlyFillingIndicator = `${symbol} ${timeframe}`;
        importStatus.indicatorFilling = true;
        importStatus.currentlyFillingIndicator = currentlyFillingIndicator;

        const result = await pool.query(`
            SELECT c.*
            FROM candlesticks c
                     LEFT JOIN indicators i
                               ON c.symbol = i.symbol AND c.timeframe = i.timeframe AND c.timestamp = i.timestamp
            WHERE c.symbol = $1
              AND c.timeframe = $2
              AND (i.id IS NULL OR i.computed_indicators::jsonb != $3::jsonb)
            ORDER BY c.timestamp ASC LIMIT 1000
        `, [symbol, timeframe, JSON.stringify(INDICATOR_KEYS.reduce((acc, key) => ({...acc, [key]: true}), {}))]);

        const candles = result.rows;
        if (candles.length === 0) {
            console.log(`No new candles to compute indicators for ${symbol} ${timeframe}`);
            return;
        }

        const indicators = computeIndicators(candles);

        const query = `
            INSERT INTO indicators (symbol, timeframe, timestamp, sma, ema, rsi, computed_indicators)
            VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (symbol, timeframe, timestamp) 
      DO
            UPDATE SET
                sma = EXCLUDED.sma,
                ema = EXCLUDED.ema,
                rsi = EXCLUDED.rsi,
                computed_indicators = indicators.computed_indicators || EXCLUDED.computed_indicators
        `;

        for (const indicator of indicators) {
            const computedIndicators = INDICATOR_KEYS.reduce((acc, key) => ({
                ...acc,
                [key]: indicator[key as keyof Indicator] !== null
            }), {} as Record<string, boolean>);

            await pool.query(query, [
                symbol,
                timeframe,
                new Date(indicator.timestamp),
                cleanNumericValue(indicator.sma),
                cleanNumericValue(indicator.ema),
                cleanNumericValue(indicator.rsi),
                JSON.stringify(computedIndicators)
            ]);
        }

        console.log(`Computed and stored indicators for ${candles.length} candles of ${symbol} ${timeframe}`);
    } catch (error) {
        console.error(`Error computing and storing indicators for ${symbol} ${timeframe}:`, error);
    } finally {
        isIndicatorFilling = false;
        currentlyFillingIndicator = null;
        importStatus.indicatorFilling = false;
        importStatus.currentlyFillingIndicator = null;
    }
}

export async function fillMissingIndicators() {
    const symbol = 'BTC/USDT';
    const timeframes = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

    for (const timeframe of timeframes) {
        await computeAndStoreIndicators(symbol, timeframe);
    }
}

export function getImportStatus(): ImportStatus {
    return importStatus;
}

export function isDataFillingInProgress() {
    return isDataFilling;
}

export async function getLatestCandlestickWithIndicators(symbol: string, timeframe: string): Promise<OHLCVData & Indicator | null> {
    try {
        const latestCandlestick = await getLatestCandlestick(symbol, timeframe);
        if (latestCandlestick) {
            const indicators = computeIndicators([latestCandlestick]);
            return {...latestCandlestick, ...indicators[0]};
        }
        return null;
    } catch (error) {
        console.error(`Error fetching latest candlestick with indicators for ${symbol} ${timeframe}:`, error);
        return null;
    }
}

export async function getCandlesticks(symbol: string, timeframe: string, limit: number = 1000, startTime?: number, endTime?: number): Promise<OHLCVData[]> {
    try {
        let query = 'SELECT * FROM candlesticks WHERE symbol = $1 AND timeframe = $2';
        const params: any[] = [symbol, timeframe];

        if (startTime) {
            query += ' AND timestamp >= $' + (params.length + 1);
            params.push(new Date(startTime));
        }

        if (endTime) {
            query += ' AND timestamp <= $' + (params.length + 1);
            params.push(new Date(endTime));
        }

        query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            timestamp: row.timestamp.getTime(),
            open: parseFloat(row.open),
            high: parseFloat(row.high),
            low: parseFloat(row.low),
            close: parseFloat(row.close),
            volume: parseFloat(row.volume)
        }));
    } catch (error) {
        console.error(`Error fetching candlesticks for ${symbol} ${timeframe}:`, error);
        return [];
    }
}

export async function updateLatestCandlesticks() {
    const symbol = 'BTC/USDT';
    const timeframes = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

    for (const timeframe of timeframes) {
        try {
            const latestCandlestick = await getLatestCandlestick(symbol, timeframe);
            if (latestCandlestick) {
                const ohlcv: ccxt.OHLCV = [
                    latestCandlestick.timestamp,
                    latestCandlestick.open,
                    latestCandlestick.high,
                    latestCandlestick.low,
                    latestCandlestick.close,
                    latestCandlestick.volume
                ];
                await storeCandlesticks(symbol, timeframe, [ohlcv]);
                await computeAndStoreIndicators(symbol, timeframe);
            }
        } catch (error) {
            console.error(`Error updating latest candlestick for ${symbol} ${timeframe}:`, error);
        }
    }
}