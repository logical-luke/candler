import fastify, { FastifyInstance, RouteHandlerMethod } from 'fastify';
import cors from '@fastify/cors';
import {
  fillMissingData,
  isDataFillingInProgress,
  getLatestCandlestick,
  getImportStatus,
  fillMissingIndicators,
  getLatestCandlestickWithIndicators,
  getCandlesticks,
  updateLatestCandlesticks
} from './service/binanceDataService';
import { initDatabase } from './utils/dbInit';

const server: FastifyInstance = fastify({
  logger: true,
  ajv: {
    customOptions: {
      removeAdditional: "all",
      coerceTypes: true,
      useDefaults: true,
    }
  }
});

server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// Force JSON content type for all responses
server.addHook('onSend', (request, reply, payload, done) => {
  reply.header('Content-Type', 'application/json');
  done();
});

// Error handler to ensure JSON responses even for errors
server.setErrorHandler((error, request, reply) => {
  reply.status(error.statusCode || 500).send({
    error: error.name,
    message: error.message,
    statusCode: error.statusCode || 500
  });
});

const routes: Array<{method: string, url: string}> = [];

function addRoute(method: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options', url: string, handler: RouteHandlerMethod) {
  routes.push({method, url});
  server[method](url, handler);
}

addRoute('get', '/status', async (request, reply) => {
  try {
    return {
      isDataFilling: isDataFillingInProgress(),
      importStatus: getImportStatus()
    };
  } catch (error) {
    console.error('Error in /status endpoint:', error);
    throw error;
  }
});

addRoute('get', '/latest-candlestick', async (request, reply) => {
  const { symbol, timeframe } = request.query as { symbol: string; timeframe: string };
  const latestCandlestick = await getLatestCandlestickWithIndicators(symbol, timeframe);
  if (latestCandlestick) {
    return { data: latestCandlestick };
  } else {
    reply.status(404);
    return { error: 'Latest candlestick not found', data: null };
  }
});

addRoute('get', '/candlesticks', async (request, reply) => {
  const { symbol, timeframe, limit, startTime, endTime } = request.query as { symbol: string; timeframe: string; limit?: string; startTime?: string; endTime?: string };
  const candlesticks = await getCandlesticks(symbol, timeframe, parseInt(limit || '1000'), startTime ? parseInt(startTime) : undefined, endTime ? parseInt(endTime) : undefined);

  if (candlesticks.length === 0) {
    return { message: 'No candlesticks found for the given parameters', data: [] };
  }

  return { data: candlesticks };
});

const UPDATE_INTERVAL = 60000; // 1 minute

async function continuousUpdate() {
  while (true) {
    try {
      await updateLatestCandlesticks();
      await fillMissingData();
      await fillMissingIndicators();
    } catch (error) {
      console.error('Error in continuous update:', error);
    }
    await new Promise(resolve => setTimeout(resolve, UPDATE_INTERVAL));
  }
}

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized. Starting continuous updates...');
    await continuousUpdate();
    console.log('Server is ready.');

    console.log('Routes:');
    routes.forEach(route => {
      console.log(`${route.method.toUpperCase()} ${route.url}`);
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

start();