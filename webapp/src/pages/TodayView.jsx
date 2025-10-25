import React, { useEffect, useState, useCallback } from 'react';
import { addDays, format, formatISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';

const TodayView = () => {
    const { showToast, refreshProfile } = useAppContext();
    const [state, setState] = useState({ loading: true, session: null, source: null, error: null });

    const loadSession = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const { data } = await apiClient.getTodaySession();
            setState({ loading: false, session: data.session, source: data.source, error: null });
        } catch (error) {
            setState({ loading: false, session: null, source: null, error });
        }
    }, []);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    const handleMarkDone = async () => {
        if (!state.session?.id) {
            showToast({ title: 'Нет активной тренировки', type: 'error' });
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
            });
        }
    };

    const handleReschedule = async () => {
        if (!state.session?.id) {
            showToast({ title: 'Нет активной тренировки', type: 'error' });
            return;
        }

        try {
            const nextDate = formatISO(addDays(new Date(state.session.date), 1), { representation: 'date' });
            await apiClient.rescheduleSession(state.session.id, nextDate);
            showToast({
                title: 'Тренировка перенесена',
                message: 'План обновлён — проверь расписание на завтра.',
                type: 'info',
            });
            await Promise.all([loadSession(), refreshProfile?.()]);
        } catch (error) {
            showToast({
                title: 'Не удалось перенести тренировку',
                message: error.message,
                type: 'error',
            });
        }
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
                    <button className="btn btn-secondary" onClick={refreshProfile}>
                        Обновить план
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
                    Источник данных: личный тренировочный план
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
                </div>
            </div>

            <div className="tips-card">
                <h4>💡 Совет дня</h4>
                <p>
                    Отмечай заметки после тренировки — это поможет видеть тенденции и вовремя корректировать нагрузку.
                </p>
            </div>
        </div>
    );
};

export default TodayView;

