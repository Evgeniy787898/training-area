const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const DEV_PROFILE_ID = import.meta.env.VITE_DEV_PROFILE_ID?.trim() || null;
const DEV_TELEGRAM_ID = import.meta.env.VITE_DEV_TELEGRAM_ID?.trim() || null;
const DEV_AUTH_TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN?.trim() || null;
const DEV_INIT_DATA = import.meta.env.VITE_DEV_INIT_DATA?.trim() || null;

function buildUrl(path) {
    if (!path) {
        return path;
    }

    if (!RAW_BASE_URL) {
        return path;
    }

    try {
        const base = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL : `${RAW_BASE_URL}/`;
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return new URL(cleanPath, base).toString();
    } catch (error) {
        return `${RAW_BASE_URL}${path}`;
    }
}

let telegramId = null;
let telegramInitData = null;

export function configureClient({ telegramUser, initData }) {
    telegramId = telegramUser?.id || null;
    telegramInitData = initData || (typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || null : null);
}

async function request(path, { method = 'GET', body, headers } = {}) {
    const url = buildUrl(path) || path;
    const init = { method, headers: new Headers(headers || {}) };

    if (telegramId) {
        init.headers.set('X-Telegram-Id', telegramId);
    }

    if (telegramInitData) {
        init.headers.set('X-Telegram-Init-Data', telegramInitData);
    }

    if (import.meta.env.DEV) {
        if (DEV_PROFILE_ID) {
            init.headers.set('X-Profile-Id', DEV_PROFILE_ID);
        }
        if (!telegramId && DEV_TELEGRAM_ID) {
            init.headers.set('X-Telegram-Id', DEV_TELEGRAM_ID);
        }
        if (!telegramInitData && DEV_INIT_DATA) {
            init.headers.set('X-Telegram-Init-Data', DEV_INIT_DATA);
        }
        if (DEV_AUTH_TOKEN) {
            init.headers.set('X-Auth-Token', DEV_AUTH_TOKEN);
        }
    }

    if (body !== undefined) {
        init.headers.set('Content-Type', 'application/json');
        init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const traceId = response.headers.get('x-trace-id');
    let payload = null;

    try {
        payload = await response.json();
    } catch (error) {
        payload = null;
    }

    if (!response.ok) {
        const error = new Error(payload?.message || 'Произошла ошибка запроса');
        error.code = payload?.error || 'server_error';
        error.status = response.status;
        error.traceId = traceId;
        error.details = payload?.issues;
        throw error;
    }

    return { data: payload, traceId };
}

export const apiClient = {
    getProfileSummary: () => request('/v1/profile/summary'),
    updatePreferences: payload => request('/v1/profile/preferences', { method: 'PATCH', body: payload }),
    getTodaySession: (date) => {
        const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
        return request(`/v1/sessions/today${suffix}`);
    },
    getWeekPlan: date => request(`/v1/sessions/week${date ? `?date=${encodeURIComponent(date)}` : ''}`),
    getSession: id => request(`/v1/sessions/${id}`),
    updateSession: (id, payload) => request(`/v1/sessions/${id}`, { method: 'PUT', body: payload }),
    getReport: (slug, params = {}) => {
        const search = new URLSearchParams(params);
        const suffix = search.toString() ? `?${search.toString()}` : '';
        return request(`/v1/reports/${slug}${suffix}`);
    },
    getAchievements: () => request('/v1/achievements'),
    getExerciseCatalog: () => request('/v1/exercises/catalog'),
    getExerciseHistory: exerciseKey => request(`/v1/exercises/${encodeURIComponent(exerciseKey)}/history`),
};

export default apiClient;
