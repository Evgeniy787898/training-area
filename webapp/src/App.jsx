import React, { useState, useEffect, useCallback } from 'react';
import Navigation from './components/Navigation';
import TodayView from './pages/TodayView';
import AnalyticsView from './pages/AnalyticsView';
import SettingsView from './pages/SettingsView';
import ExercisesView from './pages/ExercisesView';
import SkeletonCard from './components/SkeletonCard';
import ErrorState from './components/ErrorState';
import Toast from './components/Toast';
import { AppProvider } from './context/AppContext';
import { configureClient, apiClient } from './api/client';
import { DEMO_PROFILE_SUMMARY } from './services/demoData';
import StatusBadge from './components/StatusBadge';

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || null;
const STANDALONE_MODE = import.meta.env.VITE_STANDALONE_MODE === '1';
const STANDALONE_USER = {
    id: import.meta.env.VITE_STANDALONE_TELEGRAM_ID
        ? Number(import.meta.env.VITE_STANDALONE_TELEGRAM_ID)
        : null,
    first_name: import.meta.env.VITE_STANDALONE_FIRST_NAME || 'Guest',
    last_name: import.meta.env.VITE_STANDALONE_LAST_NAME || '',
    username: import.meta.env.VITE_STANDALONE_USERNAME || undefined,
};
const STANDALONE_INIT_DATA = import.meta.env.VITE_STANDALONE_INIT_DATA || '';

function App() {
    const [activeTab, setActiveTab] = useState('today');
    const [telegramUser, setTelegramUser] = useState(null);
    const [profileSummary, setProfileSummary] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState(null);
    const [lastTraceId, setLastTraceId] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [demoMode, setDemoMode] = useState(false);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        if (!tg) {
            if (STANDALONE_MODE) {
                const fallbackUser = {
                    ...STANDALONE_USER,
                    id: Number.isFinite(STANDALONE_USER.id) ? STANDALONE_USER.id : null,
                };
                setTelegramUser(fallbackUser);
                configureClient({ telegramUser: fallbackUser, initData: STANDALONE_INIT_DATA });
                setProfileError(null);
            } else {
                setProfileError({
                    code: 'telegram_webapp_required',
                    message: 'Запустите WebApp внутри Telegram',
                });
                setProfileLoading(false);
            }
            return;
        }

        tg.ready();
        tg.expand();

        const user = tg.initDataUnsafe?.user || null;
        setTelegramUser(user);
        configureClient({ telegramUser: user, initData: tg.initData || '' });
    }, []);

    const pushToast = useCallback(({ title, message, type = 'info', traceId }) => {
        setToasts(prev => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, title, message, type, traceId },
        ]);
    }, []);

    const closeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const loadProfile = useCallback(async () => {
        if (!telegramUser) {
            return;
        }

        setProfileLoading(true);
        try {
            const { data, traceId } = await apiClient.getProfileSummary();
            setProfileSummary(data);
            setProfileError(null);
            setLastTraceId(traceId);
            setDemoMode(false);
        } catch (error) {
            setLastTraceId(error.traceId || null);

            const authError = error.status === 401 || error.status === 403
                || error.code === 'auth_required'
                || error.code === 'invalid_signature';

            if (authError) {
                setProfileError(error);
                setProfileSummary(null);
                setDemoMode(false);
                pushToast({
                    title: 'Нет доступа к API',
                    message: STANDALONE_MODE
                        ? 'Проверь токен доступа и идентификатор профиля для режима предпросмотра.'
                        : 'Открой WebApp из Telegram, чтобы подтвердить подпись.',
                    type: 'error',
                    traceId: error.traceId,
                });
            } else {
                setProfileError(error);
                setProfileSummary(DEMO_PROFILE_SUMMARY);
                setDemoMode(true);
                pushToast({
                    title: 'Демо режим',
                    message: 'Не удалось связаться с сервером. Показаны примерочные данные.',
                    type: 'warning',
                    traceId: error.traceId,
                });
            }
        } finally {
            setProfileLoading(false);
        }
    }, [telegramUser, pushToast]);

    useEffect(() => {
        if (telegramUser) {
            loadProfile();
        }
    }, [telegramUser, loadProfile]);

    if (!profileLoading && profileError?.code === 'telegram_webapp_required') {
        return (
            <div className="standalone-app">
                <div className="standalone-card">
                    <h1>🏋️ Training Bot</h1>
                    <p>
                        Telegram WebApp работает только внутри клиента Telegram. Открой чат с ботом и нажми кнопку «Открыть панель».
                    </p>
                    <ol>
                        <li>Найди бота в Telegram и отправь команду <code>/menu</code>.</li>
                        <li>Нажми кнопку «Открыть панель» в появившемся меню.</li>
                        <li>Внутри WebApp доступны план, отчёты и прогресс.</li>
                    </ol>
                    {TELEGRAM_BOT_USERNAME && (
                        <a
                            className="btn btn-primary"
                            href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=webapp`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Открыть @{TELEGRAM_BOT_USERNAME}
                        </a>
                    )}
                    <p className="text-muted">
                        Если кнопка не появилась, обнови чат или напиши боту «Открыть WebApp».
                    </p>
                </div>
            </div>
        );
    }

    const renderView = () => {
        switch (activeTab) {
            case 'today':
                return <TodayView />;
            case 'analytics':
                return <AnalyticsView />;
            case 'exercises':
                return <ExercisesView />;
            case 'settings':
                return <SettingsView />;
            default:
                return <TodayView />;
        }
    };

    const contextValue = {
        telegramUser,
        profileSummary,
        profileLoading,
        profileError,
        refreshProfile: loadProfile,
        showToast: pushToast,
        lastTraceId,
        setActiveTab,
        demoMode,
    };

    const adherenceValue = profileSummary?.adherence?.adherence_percent;
    const adherenceLabel = typeof adherenceValue === 'number' ? `${adherenceValue}%` : '—';
    const frequencyValue =
        profileSummary?.profile?.preferences?.training_frequency ??
        profileSummary?.profile?.training_frequency ??
        profileSummary?.preferences?.training_frequency ??
        null;
    const frequencyLabel = frequencyValue ? `${frequencyValue} трен/нед` : '3 тренировки в неделю';
    const goalText =
        profileSummary?.profile?.preferences?.training_goal ||
        profileSummary?.profile?.goals?.description ||
        profileSummary?.highlights?.focus ||
        'Калистеника';
    const upcomingSession = profileSummary?.upcoming_session;
    const upcomingDate = upcomingSession?.date ? new Date(upcomingSession.date) : null;
    const upcomingLabel = upcomingDate
        ? upcomingDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Подстрою расписание под тебя';
    const upcomingTime = upcomingDate
        ? upcomingDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : '— —';
    const nextFocus = upcomingSession?.focus || profileSummary?.highlights?.next_goal || 'Прогрессия адаптируется автоматически';
    const todayStatus = (() => {
        if (!upcomingDate) {
            return 'training';
        }
        const today = new Date();
        const sameDay = upcomingDate.toDateString() === today.toDateString();
        return sameDay ? 'training' : 'rest';
    })();

    return (
        <AppProvider value={contextValue}>
            <div className="app">
                <header className="app-header">
                    <div className="header-top">
                        <div className="brand">
                            <div className="brand-icon">TZ</div>
                            <div>
                                <h1>Tzona</h1>
                            </div>
                        </div>
                        <StatusBadge status={todayStatus} compact />
                    </div>

                    <div className="header-status">
                        {lastTraceId && (
                            <span className="trace-id" title="Последний trace id">trace: {lastTraceId}</span>
                        )}
                        {!demoMode && profileSummary?.adherence && (
                            <span className="adherence-badge">
                                🔥 Регулярность {profileSummary.adherence.adherence_percent}%
                            </span>
                        )}
                        {demoMode && (
                            <span className="demo-badge">
                                {STANDALONE_MODE
                                    ? 'Нет соединения с API — проверь переменные окружения.'
                                    : 'Режим предпросмотра — подключите WebApp из Telegram'}
                            </span>
                        )}
                    </div>

                    <div className="hero-grid">
                        <div className="hero-card">
                            <span className="hero-label">Программа в фокусе</span>
                            <span className="hero-value">{goalText}</span>
                            <span className="hero-meta">Следим за техникой и прогрессией</span>
                        </div>
                        <div className="hero-card">
                            <span className="hero-label">Следующая тренировка</span>
                            <span className="hero-value">{upcomingLabel}</span>
                            <span className="hero-meta">{upcomingTime} · {nextFocus}</span>
                        </div>
                        <div className="hero-card">
                            <span className="hero-label">Ритм недели</span>
                            <span className="hero-value">{frequencyLabel}</span>
                            <span className="hero-meta">Регулярность {adherenceLabel}</span>
                        </div>
                    </div>
                </header>

                <main className="app-main">
                    {profileLoading && <SkeletonCard lines={4} />}
                    {!profileLoading && profileError && !demoMode && (
                        <ErrorState
                            title="Не удалось загрузить профиль"
                            message={profileError.message}
                            actionLabel="Повторить"
                            onRetry={loadProfile}
                        />
                    )}
                    {!profileLoading && !profileError && renderView()}
                </main>

                <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

                <div className="toast-container" role="region" aria-live="polite">
                    {toasts.map(toast => (
                        <Toast key={toast.id} toast={toast} onClose={closeToast} />
                    ))}
                </div>
            </div>
        </AppProvider>
    );
}

export default App;
