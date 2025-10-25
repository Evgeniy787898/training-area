import { trainingService } from '../services/trainingService';

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const PROFILE_ID_STORAGE_KEY = 'training_profile_id';
const FALLBACK_STATUSES = new Set([0, 401, 403, 404, 408, 500, 502, 503, 504]);
const fallbackWarnings = new Set();

function isBrowser() {
    return typeof window !== 'undefined';
}

function readStoredProfileId() {
    if (!isBrowser()) {
        return null;
    }

    try {
        return window.localStorage.getItem(PROFILE_ID_STORAGE_KEY);
    } catch (error) {
        console.warn('[apiClient] Unable to read cached profile id:', error);
        return null;
    }
}

function storeProfileId(profileId) {
    if (!isBrowser() || !profileId) {
        return;
    }

    try {
        window.localStorage.setItem(PROFILE_ID_STORAGE_KEY, String(profileId));
    } catch (error) {
        console.warn('[apiClient] Unable to persist profile id:', error);
    }
}

function clearProfileId() {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.removeItem(PROFILE_ID_STORAGE_KEY);
    } catch (error) {
        console.warn('[apiClient] Unable to clear cached profile id:', error);
    }
}

function rememberProfileIdFromResponse(payload) {
    const profileId = payload?.profile?.id
        || payload?.session?.profile_id
        || payload?.profile_id;

    if (profileId) {
        storeProfileId(profileId);
    }
}

function buildRuntimeHeaders() {
    if (!isBrowser()) {
        return {};
    }

    const headers = {};
    const telegramApp = window.Telegram?.WebApp;

    if (telegramApp?.initDataUnsafe?.user?.id) {
        headers['x-telegram-id'] = telegramApp.initDataUnsafe.user.id;
    }

    if (telegramApp?.initData) {
        headers['x-auth-token'] = telegramApp.initData;
    }

    const cachedProfileId = readStoredProfileId();
    if (cachedProfileId) {
        headers['x-profile-id'] = cachedProfileId;
    }

    return headers;
}

async function requestFromApi(path, { method = 'GET', body, headers: extraHeaders } = {}) {
    if (!API_BASE_URL) {
        throw new Error('API base URL is not configured');
    }

    const headers = new Headers({ Accept: 'application/json', ...buildRuntimeHeaders(), ...extraHeaders });

    const hasBody = body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD';
    const requestInit = { method, headers, credentials: 'omit' };

    if (hasBody) {
        headers.set('Content-Type', 'application/json');
        requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, requestInit);

    if (!response.ok) {
        let message = `Request to ${path} failed with status ${response.status}`;
        let details = null;

        try {
            details = await response.json();
            if (details?.message) {
                message = details.message;
            }
        } catch (error) {
            // ignore json parse errors
        }

        const error = new Error(message);
        error.status = response.status;
        error.details = details;
        throw error;
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    rememberProfileIdFromResponse(payload);
    return payload;
}

async function withFallback(path, options, fallback) {
    const useApi = Boolean(API_BASE_URL);

    if (!useApi) {
        return fallback();
    }

    try {
        const data = await requestFromApi(path, options);
        return { data };
    } catch (error) {
        const status = error.status ?? 0;
        if (status === 401 || status === 403) {
            clearProfileId();
        }

        const shouldFallback = !options?.disableFallback && (!status || FALLBACK_STATUSES.has(status));
        if (!fallback || !shouldFallback) {
            throw error;
        }

        const warningKey = `${options?.method || 'GET'} ${path}`;
        if (!fallbackWarnings.has(warningKey)) {
            console.warn(`[apiClient] Falling back to local training data for ${warningKey}. Reason: ${error.message}`);
            fallbackWarnings.add(warningKey);
        }

        return fallback(error);
    }
}

export const apiClient = {
    getProfileSummary: () => withFallback('/v1/profile/summary', {}, () => trainingService.getProfileSummary()),
    updatePreferences: (payload) => withFallback(
        '/v1/profile/preferences',
        { method: 'PATCH', body: payload },
        () => trainingService.updatePreferences(payload),
    ),
    getTodaySession: () => withFallback('/v1/sessions/today', {}, () => trainingService.getTodaySession()),
    getWeekPlan: (date) => withFallback(
        `/v1/sessions/week${date ? `?date=${encodeURIComponent(date)}` : ''}`,
        {},
        () => trainingService.getWeekPlan(date),
    ),
    getSession: (id) => withFallback(`/v1/sessions/${id}`, {}, () => trainingService.getSession(id)),
    getRecentSessions: () => withFallback('/v1/sessions/recent', {}, () => trainingService.getRecentSessions()),
    updateSession: (id, payload) => withFallback(
        `/v1/sessions/${id}`,
        { method: 'PUT', body: payload },
        () => trainingService.updateSession(id, payload),
    ),
    rescheduleSession: (id, targetDate) => withFallback(
        `/v1/sessions/${id}/reschedule`,
        { method: 'POST', body: { target_date: targetDate } },
        () => trainingService.rescheduleSession(id, targetDate),
    ),
    getReport: (slug, params) => {
        const searchParams = new URLSearchParams();
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.set(key, value);
                }
            });
        }

        const query = searchParams.toString();
        const path = `/v1/reports/${slug}${query ? `?${query}` : ''}`;

        return withFallback(path, {}, () => trainingService.getReport(slug, params));
    },
    getAchievements: () => withFallback('/v1/achievements', {}, () => trainingService.getAchievements()),
    getExerciseCatalog: () => withFallback('/v1/exercises/catalog', {}, () => trainingService.getExerciseCatalog()),
    getExerciseHistory: (exerciseKey) => withFallback(
        `/v1/exercises/${encodeURIComponent(exerciseKey)}/history`,
        {},
        () => trainingService.getExerciseHistory(exerciseKey),
    ),
};

export default apiClient;
