import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import { getStaticSessionForDate } from '../services/staticPlan';

const TodayView = () => {
    const { showToast, refreshProfile, setActiveTab, demoMode } = useAppContext();
    const [state, setState] = useState({ loading: true, session: null, source: null, error: null, fallback: false });

    const loadSession = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        try {
            const { data, traceId } = await apiClient.getTodaySession();
            setState({ loading: false, session: data.session, source: data.source, error: null, traceId, fallback: false });
        } catch (error) {
            const fallbackSession = getStaticSessionForDate(new Date());
            if (fallbackSession) {
                setState({
                    loading: false,
                    session: fallbackSession,
                    source: 'static_plan',
                    error: null,
                    traceId: null,
                    fallback: true,
                });
                showToast({
                    title: 'Показан пример тренировки',
                    message: error.message,
                    type: 'warning',
                    traceId: error.traceId,
                });
            } else {
                setState({ loading: false, session: null, source: null, error, fallback: false });
            }
        }
    }, [showToast]);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    const handleMarkDone = async () => {
        if (!state.session?.id) {
            showToast({
                title: demoMode ? 'Демо режим' : 'Нет активной тренировки',
                message: demoMode
                    ? 'В режиме предпросмотра отметки не отправляются на сервер.'
                    : 'Сессия не найдена — обнови план в приложении.',
                type: demoMode ? 'info' : 'error',
            });
            return;
        }

        try {
            const payload = {
                status: 'done',
                completed_at: new Date().toISOString(),
                rpe: state.session.rpe || 7,
            };
            const { data } = await apiClient.updateSession(state.session.id, payload);
            showToast({
                title: 'Тренировка отмечена',
                message: data.next_steps,
                type: 'success',
            });
            await Promise.all([loadSession(), refreshProfile?.()]);
        } catch (error) {
            showToast({
                title: 'Не удалось обновить тренировку',
                message: error.message,
                type: 'error',
                traceId: error.traceId,
            });
        }
    };

    const handleReschedule = () => {
        showToast({
            title: 'Перенос тренировки',
            message: 'Для переноса напиши в чат «Перенеси тренировку на завтра».',
            type: 'info',
        });
    };

    const handleOpenExercises = () => {
        setActiveTab?.('exercises');
        showToast({
            title: 'Прогрессии упражнений',
            message: 'Открыл раздел с уровнями и подсказками по технике.',
            type: 'info',
        });
    };

    const handleOpenLibrary = () => {
        setActiveTab?.('library');
        showToast({
            title: 'Информационный стенд',
            message: 'Открыл подборку советов по тренировкам и восстановлению.',
            type: 'info',
        });
    };

    if (state.loading) {
        return (
            <div className="view today-view">
                <h2>📅 План на сегодня</h2>
                <SkeletonCard lines={4} />
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="view today-view">
                <h2>📅 План на сегодня</h2>
                <ErrorState
                    message={state.error.message}
                    actionLabel="Попробовать ещё раз"
                    onRetry={loadSession}
                />
            </div>
        );
    }

    if (!state.session) {
        return (
            <div className="view today-view">
                <h2>📅 План на сегодня</h2>
                <div className="card">
                    <h3>Сегодня день восстановления</h3>
                    <p className="text-muted">
                        План на сегодня пуст — используй время для лёгкой мобилизации или прогулки.
                    </p>
                    <button className="btn btn-primary" onClick={() => window.Telegram?.WebApp?.close()}>
                        Вернуться в чат
                    </button>
                </div>
            </div>
        );
    }

    const { session } = state;
    const sessionDate = session.date ? format(new Date(session.date), 'd MMMM', { locale: ru }) : 'Сегодня';
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];

    return (
        <div className="view today-view">
            <h2>📅 План на сегодня</h2>

            <div className={`card session-card session-${session.status}`}>
                <div className="card-header">
                    <h3>{session.session_type || 'Тренировка'}</h3>
                    <span className="badge">{session.focus || sessionDate}</span>
                </div>

                <p className="text-muted source-label">
                    Источник: {state.fallback ? 'локальный пример' : state.source === 'fallback' ? 'базовый план' : 'Supabase'}
                </p>

                <div className="exercises-list">
                    {exercises.map((exercise, index) => (
                        <div key={exercise.exercise_key || index} className="exercise-item">
                            <div className="exercise-name">
                                {index + 1}. {exercise.name || exercise.exercise_key}
                            </div>
                            <div className="exercise-details">
                                {exercise.target?.sets ? `${exercise.target.sets} × ${exercise.target.reps || '-'} повторов` : 'Свободный формат'}
                            </div>
                            <div className="exercise-meta">
                                {exercise.rest ? `Отдых: ${exercise.rest} сек` : ''}
                                {exercise.rpe ? ` | RPE: ${exercise.rpe}` : ''}
                            </div>
                            {exercise.notes && <div className="exercise-notes">💡 {exercise.notes}</div>}
                        </div>
                    ))}
                </div>

                <div className="card-actions">
                    <button className="btn btn-primary" onClick={handleMarkDone}>
                        ✅ Отметить выполненной
                    </button>
                    <button className="btn btn-secondary" onClick={handleReschedule}>
                        🔄 Перенести
                    </button>
                    <button className="btn btn-secondary" onClick={handleOpenExercises}>
                        📚 Прогрессии
                    </button>
                    <button className="btn btn-secondary" onClick={handleOpenLibrary}>
                        🧠 Советы
                    </button>
                </div>
            </div>

            <div className="tips-card">
                <h4>💡 Совет дня</h4>
                <p>
                    Отмечай заметки после тренировки — это помогает боту адаптировать план и держать прогрессию под контролем.
                </p>
                {state.fallback && (
                    <p className="text-muted">
                        Показана офлайн-версии плана. Для точных данных перезапусти WebApp из чата.
                    </p>
                )}
            </div>
        </div>
    );
};

export default TodayView;
