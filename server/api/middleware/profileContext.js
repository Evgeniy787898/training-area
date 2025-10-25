import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { db } from '../../infrastructure/supabase.js';
import { verifyTelegramInitData } from '../../utils/telegram.js';

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

    const overrideTelegramId = req.telegramId;
    if (overrideTelegramId) {
        const numericId = Number(overrideTelegramId);
        if (!Number.isNaN(numericId)) {
            return db.getProfileByTelegramId(numericId);
        }
    }

    const telegramIdHeader = req.header('x-telegram-id');
    if (telegramIdHeader) {
        const numericId = Number(telegramIdHeader);
        if (!Number.isNaN(numericId)) {
            return db.getProfileByTelegramId(numericId);
        }
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

    const initDataRaw = req.header('x-telegram-init-data');
    if (initDataRaw) {
        const verification = verifyTelegramInitData(initDataRaw, config.telegram.botToken, { maxAgeSeconds: 3600 });

        if (!verification.valid) {
            return res.status(401).json({
                error: 'invalid_signature',
                message: 'Не удалось подтвердить подпись Telegram WebApp.',
                reason: verification.reason,
                trace_id: traceId,
            });
        }

        if (verification.user?.id) {
            req.telegramId = verification.user.id;
            req.telegramUser = verification.user;
        }

        const headerTelegramId = req.header('x-telegram-id');
        if (headerTelegramId) {
            const headerId = Number(headerTelegramId);
            const verifiedId = Number(req.telegramId);
            if (!Number.isNaN(headerId) && !Number.isNaN(verifiedId) && headerId !== verifiedId) {
                return res.status(403).json({
                    error: 'forbidden',
                    message: 'Идентификатор Telegram не совпадает с подписью.',
                    trace_id: traceId,
                });
            }
        }

        req.telegramAuthDate = verification.authDate;
    }

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

    if (config.telegram.allowedUserIds?.length) {
        const candidateId = req.telegramId ?? profile.telegram_id;
        if (!candidateId || !config.telegram.allowedUserIds.includes(String(candidateId))) {
            return forbidden(res, 'Доступ к этому окружению ограничен.');
        }
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
