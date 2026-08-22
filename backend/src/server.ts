import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { converterRoutes } from './routes/converter.js';

const app = Fastify({
  logger: true,
});

// Register multipart plugin
await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
});

// Health check
app.get('/api/health', async () => {
  return {
    status: 'ok',
    message: 'EDS Block Converter API is running',
  };
});

// Register converter routes
await app.register(converterRoutes, {
  prefix: '/api',
});

const start = async () => {
  try {
    await app.listen({
      port: 3002,
      host: '0.0.0.0',
    });

    console.log('EDS Block Converter API running on port 3002');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();