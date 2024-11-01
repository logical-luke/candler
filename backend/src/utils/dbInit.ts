import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create initial tables',
    sql: `
      CREATE TABLE IF NOT EXISTS candlesticks (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        open DECIMAL NOT NULL,
        high DECIMAL NOT NULL,
        low DECIMAL NOT NULL,
        close DECIMAL NOT NULL,
        volume DECIMAL NOT NULL,
        UNIQUE (symbol, timeframe, timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_candlesticks_symbol_timeframe_timestamp ON candlesticks (symbol, timeframe, timestamp);

      CREATE TABLE IF NOT EXISTS indicators (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        sma DECIMAL,
        ema DECIMAL,
        rsi DECIMAL,
        UNIQUE (symbol, timeframe, timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_indicators_symbol_timeframe_timestamp ON indicators (symbol, timeframe, timestamp);

      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    version: 2,
    description: 'Add computed_indicators column to indicators table',
    sql: `
      ALTER TABLE indicators ADD COLUMN IF NOT EXISTS computed_indicators TEXT[];
    `
  },
  // Add more migrations here as needed
];

async function waitForDatabase(maxAttempts = 30, delay = 1000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('Successfully connected to the database');
      return;
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxAttempts} to connect to the database failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to connect to the database after multiple attempts');
}

async function getCurrentVersion(): Promise<number> {
  try {
    const result = await pool.query('SELECT MAX(version) as version FROM migrations');
    return result.rows[0].version || 0;
  } catch (error) {
    // @ts-ignore
    if (error.code && error.code === '42P01') {  // Table does not exist
      return 0;
    }
    throw error;
  }
}

async function applyMigration(migration: Migration): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration.sql);
    await client.query('INSERT INTO migrations (version) VALUES ($1)', [migration.version]);
    await client.query('COMMIT');
    console.log(`Applied migration ${migration.version}: ${migration.description}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  try {
    await waitForDatabase();
    const currentVersion = await getCurrentVersion();
    console.log(`Current database version: ${currentVersion}`);

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        await applyMigration(migration);
      }
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}