const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

let telegramId = null;
let telegramInitData = null;

export function configureClient({ telegramUser, initData }) {
    telegramId = telegramUser?.id || null;
    telegramInitData = initData || (typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || null : null);
}

async function request(path, { method = 'GET', body, headers } = {}) {
    const url = `${DEFAULT_BASE_URL}${path}`;
    const init = { method, headers: new Headers(headers || {}) };

    if (telegramId) {
        init.headers.set('X-Telegram-Id', telegramId);
    }

    if (telegramInitData) {
        init.headers.set('X-Telegram-Init-Data', telegramInitData);
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
    getTodaySession: () => request('/v1/sessions/today'),
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
