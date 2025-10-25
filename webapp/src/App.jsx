import React, { useState, useEffect, useCallback } from 'react';
import Navigation from './components/Navigation';
import TodayView from './pages/TodayView';
import WeekPlanView from './pages/WeekPlanView';
import ReportView from './pages/ReportView';
import ProgressView from './pages/ProgressView';
import SettingsView from './pages/SettingsView';
import ExercisesView from './pages/ExercisesView';
import LibraryView from './pages/LibraryView';
import SkeletonCard from './components/SkeletonCard';
import ErrorState from './components/ErrorState';
import Toast from './components/Toast';
import { AppProvider } from './context/AppContext';
import { configureClient, apiClient } from './api/client';
import { DEMO_PROFILE_SUMMARY } from './services/demoData';

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || null;

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
            setProfileError({
                code: 'telegram_webapp_required',
                message: 'Запустите WebApp внутри Telegram',
            });
            setProfileLoading(false);
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
            setProfileError(error);
            setProfileSummary(DEMO_PROFILE_SUMMARY);
            setLastTraceId(error.traceId || null);
            setDemoMode(true);
            pushToast({
                title: 'Демо режим',
                message: 'Не удалось связаться с сервером. Показаны примерочные данные.',
                type: 'warning',
                traceId: error.traceId,
            });
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
            case 'week':
                return <WeekPlanView />;
            case 'report':
                return <ReportView />;
            case 'progress':
                return <ProgressView />;
            case 'exercises':
                return <ExercisesView />;
            case 'library':
                return <LibraryView />;
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
    const frequencyLabel = frequencyValue ? `${frequencyValue} трен/нед` : 'частота по умолчанию';
    const goalText =
        profileSummary?.profile?.preferences?.training_goal ||
        profileSummary?.profile?.goals?.description ||
        profileSummary?.highlights?.focus ||
        'Функциональный тренинг';
    const equipment =
        profileSummary?.profile?.equipment ||
        profileSummary?.equipment ||
        profileSummary?.profile?.preferences?.equipment ||
        [];
    const equipmentLabel = Array.isArray(equipment) && equipment.length
        ? equipment.join(', ')
        : 'только вес тела';
    const upcomingSession = profileSummary?.upcoming_session;
    const upcomingDate = upcomingSession?.date ? new Date(upcomingSession.date) : null;
    const upcomingLabel = upcomingDate
        ? upcomingDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        : 'По плану';
    const nextFocus = upcomingSession?.focus || profileSummary?.highlights?.next_goal || 'Прогрессия подстраивается автоматически';

    return (
        <AppProvider value={contextValue}>
            <div className="app">
                <header className="app-header">
                    <div className="header-top">
                        <div className="brand">
                            <div className="brand-icon">💪</div>
                            <div>
                                <h1>Training Bot</h1>
                                <p className="brand-subtitle">персональный тренер в стиле Gemini</p>
                            </div>
                        </div>
                        <div className="user-chip">
                            {telegramUser ? `Привет, ${telegramUser.first_name}!` : 'Гость'}
                            {demoMode && <span className="demo-chip">демо режим</span>}
                        </div>
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
                            <span className="demo-badge">Режим предпросмотра — подключите WebApp из Telegram</span>
                        )}
                    </div>

                    <div className="hero-grid">
                        <div className="hero-card">
                            <span className="hero-label">Фокус</span>
                            <span className="hero-value">{profileSummary?.highlights?.focus || goalText}</span>
                            <span className="hero-meta">Цель — {profileSummary?.highlights?.next_goal || goalText}</span>
                        </div>
                        <div className="hero-card">
                            <span className="hero-label">Следующая сессия</span>
                            <span className="hero-value">{upcomingLabel}</span>
                            <span className="hero-meta">{nextFocus}</span>
                        </div>
                        <div className="hero-card">
                            <span className="hero-label">Регулярность</span>
                            <span className="hero-value">{adherenceLabel}</span>
                            <span className="hero-meta">{frequencyLabel}</span>
                        </div>
                        <div className="hero-card">
                            <span className="hero-label">Оборудование</span>
                            <span className="hero-value">{equipmentLabel}</span>
                            <span className="hero-meta">Настроим план под текущие условия</span>
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
