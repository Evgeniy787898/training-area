import React, { useState, useEffect, useCallback } from 'react';
import Navigation from './components/Navigation';
import TodayView from './pages/TodayView';
import WeekPlanView from './pages/WeekPlanView';
import ReportView from './pages/ReportView';
import ProgressView from './pages/ProgressView';
import SettingsView from './pages/SettingsView';
import ExercisesView from './pages/ExercisesView';
import SkeletonCard from './components/SkeletonCard';
import ErrorState from './components/ErrorState';
import Toast from './components/Toast';
import { AppProvider } from './context/AppContext';
import { apiClient } from './api/client';

function App() {
    const [activeTab, setActiveTab] = useState('today');
    const [profileSummary, setProfileSummary] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState(null);
    const [toasts, setToasts] = useState([]);

    const pushToast = useCallback(({ title, message, type = 'info' }) => {
        setToasts(prev => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, title, message, type },
        ]);
    }, []);

    const closeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const loadProfile = useCallback(async () => {
        setProfileLoading(true);
        try {
            const { data } = await apiClient.getProfileSummary();
            setProfileSummary(data);
            setProfileError(null);
        } catch (error) {
            setProfileError(error);
            pushToast({
                title: 'Не удалось загрузить профиль',
                message: error.message,
                type: 'error',
            });
        } finally {
            setProfileLoading(false);
        }
    }, [pushToast]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

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
            case 'settings':
                return <SettingsView />;
            default:
                return <TodayView />;
        }
    };

    const contextValue = {
        profileSummary,
        profileLoading,
        profileError,
        refreshProfile: loadProfile,
        showToast: pushToast,
    };

    return (
        <AppProvider value={contextValue}>
            <div className="app">
                <header className="app-header">
                    <div>
                        <h1>💪 Training Planner</h1>
                        <p className="user-info">
                            Привет, {profileSummary?.profile?.name || 'атлет'}!
                        </p>
                    </div>
                    <div className="header-meta">
                        {profileSummary?.adherence && (
                            <span className="adherence-badge">
                                🔥 Регулярность {profileSummary.adherence.adherence_percent}%
                            </span>
                        )}
                    </div>
                </header>

                <main className="app-main">
                    {profileLoading && <SkeletonCard lines={4} />}
                    {!profileLoading && profileError && (
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

