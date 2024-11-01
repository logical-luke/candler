import fastify, { FastifyInstance, RouteHandlerMethod } from 'fastify';
import cors from '@fastify/cors';
import { fillMissingData, isDataFillingInProgress, getLatestCandlestick, getImportStatus } from './service/binanceDataService';
import { initDatabase } from './utils/dbInit';

const server: FastifyInstance = fastify({ logger: true });

// Register the CORS plugin with a more permissive configuration
server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// Keep track of routes
const routes: Array<{method: string, url: string}> = [];

// Helper function to add routes
function addRoute(method: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options', url: string, handler: RouteHandlerMethod) {
  routes.push({method, url});
  server[method](url, handler);
}

// Add routes
addRoute('get', '/status', async (request, reply) => {
  try {
    return {
      isDataFilling: isDataFillingInProgress(),
      importStatus: getImportStatus()
    };
  } catch (error) {
    console.error('Error in /status endpoint:', error);
    reply.status(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

addRoute('get', '/latest-candlestick', async (request, reply) => {
  const { symbol, timeframe } = request.query as { symbol: string; timeframe: string };
  const latestCandlestick = await getLatestCandlestick(symbol, timeframe);
  if (latestCandlestick) {
    return latestCandlestick;
  } else {
    reply.status(404).send({ error: 'Latest candlestick not found' });
  }
});

server.addHook('onRequest', async (request, reply) => {
  if (isDataFillingInProgress() && request.url !== '/status') {
    reply.status(503).send({ error: 'Data is being filled. Please try again later.' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized. Starting to fill missing data...');
    await fillMissingData();
    console.log('Data filled. Starting server...');


    console.log('Server started successfully');
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