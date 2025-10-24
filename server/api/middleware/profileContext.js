import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { db } from '../../infrastructure/supabase.js';

function unauthorized(res, message = 'Authentication required') {
    return res.status(401).json({ error: 'auth_required', message });
}

function forbidden(res, message = 'Access denied') {
    return res.status(403).json({ error: 'forbidden', message });
}

async function resolveProfile(req) {
    const profileIdHeader = req.header('x-profile-id');
    if (profileIdHeader) {
        return db.getProfileById(profileIdHeader.trim());
    }

    const telegramIdHeader = req.header('x-telegram-id');
    if (telegramIdHeader) {
        return db.getProfileByTelegramId(Number(telegramIdHeader));
    }

    return null;
}

function verifyAuthToken(token) {
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, config.security.jwtSecret, { algorithms: ['HS256'] });
    } catch (error) {
        console.warn('Failed to verify auth token:', error.message);
        return null;
    }
}

export async function profileContextMiddleware(req, res, next) {
    if (req.path === '/public/status') {
        return next();
    }

    const traceId = req.header('x-trace-id') || crypto.randomUUID();
    res.setHeader('x-trace-id', traceId);
    req.traceId = traceId;

    const authToken = req.header('authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    const tokenPayload = verifyAuthToken(authToken);

    let profile = null;

    try {
        profile = await resolveProfile(req);
    } catch (error) {
        console.error('Failed to resolve profile:', error);
        return res.status(500).json({ error: 'profile_lookup_failed', message: 'Не удалось найти профиль пользователя', trace_id: traceId });
    }

    if (!profile) {
        return unauthorized(res, 'Профиль не найден. Откройте WebApp из чата бота.');
    }

    if (tokenPayload && tokenPayload.profile_id && tokenPayload.profile_id !== profile.id) {
        return forbidden(res, 'Маркер доступа не соответствует профилю.');
    }

    req.profile = profile;
    req.profileId = profile.id;
    req.authTokenPayload = tokenPayload;

    return next();
}

export default profileContextMiddleware;
