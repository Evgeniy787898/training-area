import crypto from 'node:crypto';

/**
 * Parses raw init data string received from Telegram WebApp.
 * @param {string} rawInitData
 * @returns {{params: URLSearchParams, hash: string | null}}
 */
function parseInitData(rawInitData) {
    if (!rawInitData || typeof rawInitData !== 'string') {
        return { params: null, hash: null };
    }

    const params = new URLSearchParams(rawInitData);
    return {
        params,
        hash: params.get('hash'),
    };
}

function buildDataCheckString(params) {
    const pairs = [];

    for (const [key, value] of params.entries()) {
        if (key === 'hash') {
            continue;
        }
        pairs.push(`${key}=${value}`);
    }

    pairs.sort();
    return pairs.join('\n');
}

function computeSignature(dataCheckString, botToken) {
    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    return crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
}

/**
 * Verifies Telegram WebApp init data signature.
 * @param {string} rawInitData
 * @param {string} botToken
 * @param {{maxAgeSeconds?: number}} options
 * @returns {{valid: boolean, reason?: string, user?: any, authDate?: number}}
 */
export function verifyTelegramInitData(rawInitData, botToken, { maxAgeSeconds = 3600 } = {}) {
    const { params, hash } = parseInitData(rawInitData);

    if (!params || !hash) {
        return { valid: false, reason: 'missing_payload' };
    }

    const expectedHash = computeSignature(buildDataCheckString(params), botToken);
    if (expectedHash !== hash) {
        return { valid: false, reason: 'hash_mismatch' };
    }

    const authDate = Number(params.get('auth_date') || 0);
    if (!Number.isFinite(authDate) || authDate <= 0) {
        return { valid: false, reason: 'invalid_auth_date' };
    }

    if (maxAgeSeconds > 0) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds - authDate > maxAgeSeconds) {
            return { valid: false, reason: 'auth_expired' };
        }
    }

    let user = null;
    const userPayload = params.get('user');
    if (userPayload) {
        try {
            user = JSON.parse(userPayload);
        } catch (error) {
            return { valid: false, reason: 'invalid_user_payload' };
        }
    }

    return {
        valid: true,
        user,
        authDate,
    };
}

export default {
    verifyTelegramInitData,
};
