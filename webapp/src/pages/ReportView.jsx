import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';

const INITIAL_FORM = {
    sessionId: '',
    status: 'done',
    rpe: 7,
    notes: '',
};

const ReportView = () => {
    const { showToast, refreshProfile } = useAppContext();
    const [state, setState] = useState({
        loading: true,
        error: null,
        sessions: [],
        submitting: false,
        form: INITIAL_FORM,
    });

    const loadSessions = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const { data } = await apiClient.getRecentSessions();
            const defaultSession = data.sessions.find(session => session.status !== 'done') || data.sessions[0];
            const preservedId = prev.form.sessionId && data.sessions.some(session => session.id === prev.form.sessionId)
                ? prev.form.sessionId
                : null;
            setState(prev => ({
                ...prev,
                loading: false,
                error: null,
                sessions: data.sessions,
                form: {
                    ...prev.form,
                    sessionId: preservedId || defaultSession?.id || '',
                },
            }));
        } catch (error) {
            setState(prev => ({ ...prev, loading: false, error }));
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setState(prev => ({
            ...prev,
            form: {
                ...prev.form,
                [name]: name === 'rpe' ? Number(value) : value,
            },
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!state.form.sessionId) {
            showToast({ title: 'Нет выбранной тренировки', type: 'error' });
            return;
        }

        setState(prev => ({ ...prev, submitting: true }));
        try {
            await apiClient.updateSession(state.form.sessionId, {
                status: state.form.status,
                completed_at: new Date().toISOString(),
                rpe: state.form.rpe,
                notes: state.form.notes,
            });
            showToast({ title: 'Отчёт сохранён', message: 'Данные обновлены, продолжай тренироваться!', type: 'success' });
            await Promise.all([loadSessions(), refreshProfile?.()]);
            setState(prev => ({
                ...prev,
                form: {
                    ...INITIAL_FORM,
                    sessionId: prev.form.sessionId,
                },
            }));
        } catch (error) {
            showToast({ title: 'Не удалось сохранить', message: error.message, type: 'error' });
        } finally {
            setState(prev => ({ ...prev, submitting: false }));
        }
    };

    const renderForm = () => {
        if (state.loading) {
            return <SkeletonCard lines={4} />;
        }

        if (state.error) {
            return (
                <ErrorState
                    message={state.error.message}
                    actionLabel="Обновить"
                    onRetry={loadSessions}
                />
            );
        }

        if (!state.sessions.length) {
            return <p className="text-muted">Пока нет тренировок для отчёта. Добавь занятия в расписание.</p>;
        }

        const selectedSession = state.sessions.find(session => session.id === state.form.sessionId);

        return (
            <form className="report-form" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="sessionId">Тренировка</label>
                    <select
                        id="sessionId"
                        name="sessionId"
                        value={state.form.sessionId}
                        onChange={handleChange}
                    >
                        {state.sessions.map(session => (
                            <option key={session.id} value={session.id}>
                                {format(parseISO(session.date), 'd MMMM', { locale: ru })} — {session.session_type}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-field">
                    <label htmlFor="status">Статус</label>
                    <select id="status" name="status" value={state.form.status} onChange={handleChange}>
                        <option value="done">Выполнено</option>
                        <option value="skipped">Пропущено</option>
                    </select>
                </div>

                <div className="form-field">
                    <label htmlFor="rpe">Субъективная нагрузка (RPE)</label>
                    <input
                        id="rpe"
                        name="rpe"
                        type="number"
                        min="4"
                        max="10"
                        value={state.form.rpe}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-field">
                    <label htmlFor="notes">Заметки</label>
                    <textarea
                        id="notes"
                        name="notes"
                        rows="3"
                        value={state.form.notes}
                        onChange={handleChange}
                        placeholder="Что получилось хорошо? Что стоит поправить?"
                    />
                </div>

                {selectedSession && (
                    <p className="text-muted">
                        По плану: {selectedSession.focus}. Отмечай ощущения, чтобы видеть прогресс на графиках.
                    </p>
                )}

                <button className="btn btn-primary" type="submit" disabled={state.submitting}>
                    {state.submitting ? 'Сохраняю…' : 'Сохранить отчёт'}
                </button>
            </form>
        );
    };

    const renderRecent = () => {
        if (!state.sessions.length) {
            return null;
        }

        const completed = state.sessions
            .filter(session => session.status === 'done')
            .slice(0, 5);

        if (!completed.length) {
            return <p className="text-muted">Пока нет завершённых тренировок. Отмечай занятия, чтобы отслеживать динамику.</p>;
        }

        return (
            <ul className="history-list">
                {completed.map(session => (
                    <li key={session.id}>
                        <div className="history-row">
                            <span className="history-date">{format(parseISO(session.date), 'd MMM', { locale: ru })}</span>
                            <span className="history-level">{session.session_type}</span>
                            <span className="history-rpe">RPE {session.rpe || 7}</span>
                        </div>
                        <div className="history-notes text-muted">{session.focus}</div>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="view report-view">
            <h2>📝 Отчёт о тренировке</h2>

            <div className="card">
                <h3>Заполни отчёт</h3>
                <p className="text-muted">Выбери тренировку, оцени нагрузку и добавь заметки. Это поможет корректировать прогрессию.</p>
                {renderForm()}
            </div>

            <div className="card">
                <h3>Последние результаты</h3>
                {renderRecent()}
            </div>
        </div>
    );
};

export default ReportView;
