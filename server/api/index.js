import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import crypto from 'node:crypto';
import { config } from '../config/env.js';
import sessionsRouter from './routes/sessions.js';
import reportsRouter from './routes/reports.js';
import profileRouter from './routes/profile.js';
import achievementsRouter from './routes/achievements.js';
import exercisesRouter from './routes/exercises.js';
import { profileContextMiddleware } from './middleware/profileContext.js';

export function createHttpServer() {
    const app = express();

    app.use(cors({ origin: '*', exposedHeaders: ['x-trace-id'] }));
    app.use(express.json({ limit: '1mb' }));
    app.use(morgan('dev'));

    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'training-area-api', timestamp: new Date().toISOString() });
    });

    app.use('/v1', profileContextMiddleware);
    app.use('/v1/sessions', sessionsRouter);
    app.use('/v1/reports', reportsRouter);
    app.use('/v1/profile', profileRouter);
    app.use('/v1/achievements', achievementsRouter);
    app.use('/v1/exercises', exercisesRouter);

    app.use((req, res) => {
        res.status(404).json({ error: 'not_found', message: 'Endpoint not found' });
    });

    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        console.error('HTTP error:', err);
        const traceId = req.headers['x-trace-id'] || crypto.randomUUID?.() || undefined;
        if (traceId) {
            res.setHeader('x-trace-id', traceId);
        }

        res.status(err.status || 500).json({
            error: err.code || 'server_error',
            message: err.message || 'Internal server error',
            trace_id: traceId,
        });
    });

    return app;
}

export function startHttpServer() {
    const app = createHttpServer();

    return new Promise((resolve, reject) => {
        const server = app.listen(config.app.port, config.app.host || '0.0.0.0', () => {
            console.log(`🌐 HTTP API listening on port ${config.app.port}`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

export default startHttpServer;
