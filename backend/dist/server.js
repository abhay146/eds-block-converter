import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { converterRoutes, } from './routes/converter.js';
const app = Fastify({
    logger: true,
});
/**
 * CORS plugin.
 *
 * origin: true allows requests from the
 * frontend during local development and
 * production testing.
 */
await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
});
/**
 * Multipart plugin.
 *
 * Used for DOCX file uploads.
 */
await app.register(multipart, {
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB
    },
});
/**
 * Health check.
 */
app.get('/api/health', async () => {
    return {
        status: 'ok',
        message: 'EDS Block Converter API is running',
    };
});
/**
 * Converter routes.
 */
await app.register(converterRoutes, {
    prefix: '/api',
});
/**
 * Start server.
 */
const start = async () => {
    try {
        const port = Number(process.env.PORT) || 3002;
        await app.listen({
            port,
            host: '0.0.0.0',
        });
        console.log(`EDS Block Converter API running on port ${port}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
