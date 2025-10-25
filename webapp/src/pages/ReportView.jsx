import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { apiClient } from '../api/client';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import { getStaticSessionForDate } from '../services/staticPlan';
import { DEMO_REPORT_HINT } from '../services/demoData';

const STANDALONE_MODE = import.meta.env.VITE_STANDALONE_MODE === '1';

const initialFormState = {
    status: 'done',
    rpe: '7',
    notes: '',
    exercises: {},
};

function buildFormFromSession(session) {
    if (!session) {
        return initialFormState;
    }

    const exercises = {};
    (session.exercises || []).forEach((exercise, index) => {
        const key = exercise.exercise_key || `exercise_${index}`;
        exercises[key] = {
            sets: exercise.actual?.sets ?? exercise.target?.sets ?? '',
            reps: exercise.actual?.reps ?? exercise.target?.reps ?? '',
            rpe: exercise.rpe ?? session.rpe ?? 7,
            notes: exercise.notes || '',
        };
    });

    return {
        status: session.status === 'skipped' ? 'skipped' : 'done',
        rpe: String(session.rpe || 7),
        notes: session.notes || '',
        exercises,
    };
}

const ReportView = () => {
    const { showToast, refreshProfile, demoMode } = useAppContext();
    const [state, setState] = useState({ loading: true, error: null, session: null, source: null, fallback: false });
    const [form, setForm] = useState(initialFormState);
    const [saving, setSaving] = useState(false);

    const loadSession = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        try {
            const { data } = await apiClient.getTodaySession();
            setState({
                loading: false,
                error: null,
                session: data.session,
                source: data.source,
                fallback: data.source !== 'database',
            });
        } catch (error) {
            const fallbackSession = getStaticSessionForDate(new Date());
            if (fallbackSession) {
                setState({
                    loading: false,
                    error: null,
                    session: fallbackSession,
                    source: 'static_plan',
                    fallback: true,
                });
                showToast?.({
                    title: STANDALONE_MODE ? 'Нет соединения с API' : 'Демо режим',
                    message: STANDALONE_MODE
                        ? 'Проверь авторизацию: без доступа к серверу показан пример для заполнения.'
                        : 'Не получилось получить актуальную тренировку. Показан пример для заполнения.',
                    type: 'warning',
                    traceId: error.traceId,
                });
            } else {
                setState({ loading: false, error, session: null, source: null, fallback: false });
            }
        }
    }, [showToast]);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    useEffect(() => {
        if (state.session) {
            setForm(buildFormFromSession(state.session));
        }
    }, [state.session]);

    const exercises = useMemo(() => {
        return (state.session?.exercises || []).map((exercise, index) => ({
            key: exercise.exercise_key || `exercise_${index}`,
            name: exercise.name || exercise.exercise_key || `Упражнение ${index + 1}`,
            target: exercise.target,
        }));
    }, [state.session]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleExerciseChange = (exerciseKey, field, value) => {
        setForm(prev => ({
            ...prev,
            exercises: {
                ...prev.exercises,
                [exerciseKey]: {
                    ...prev.exercises[exerciseKey],
                    [field]: value,
                },
            },
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!state.session?.id) {
            showToast?.({
                title: STANDALONE_MODE ? 'Нет соединения с API' : 'Демо режим',
                message: STANDALONE_MODE
                    ? 'Сейчас нет соединения с сервером. Исправь токен доступа и повтори попытку.'
                    : 'В режиме предпросмотра отчёт не отправляется на сервер. Открой приложение из Telegram для реального отчёта.',
                type: 'warning',
            });
            return;
        }

        setSaving(true);
        try {
            const exercisesPayload = (state.session.exercises || []).map((exercise, index) => {
                const key = exercise.exercise_key || `exercise_${index}`;
                const formEntry = form.exercises[key] || {};
                const actualSets = formEntry.sets !== '' ? Number(formEntry.sets) : undefined;
                const actualReps = formEntry.reps !== '' ? Number(formEntry.reps) : undefined;
                const payload = {
                    exercise_key: exercise.exercise_key || exercise.name || key,
                    target: exercise.target || {},
                    state: form.status === 'skipped' ? 'skipped' : 'done',
                };

                if (actualSets !== undefined && !Number.isNaN(actualSets)) {
                    payload.actual = { ...(payload.actual || {}), sets: actualSets };
                }
                if (actualReps !== undefined && !Number.isNaN(actualReps)) {
                    payload.actual = { ...(payload.actual || {}), reps: actualReps };
                }
                if (formEntry.notes) {
                    payload.notes = formEntry.notes;
                }
                if (formEntry.rpe) {
                    const value = Number(formEntry.rpe);
                    if (!Number.isNaN(value)) {
                        payload.rpe = value;
                    }
                }

                return payload;
            });

            const payload = {
                status: form.status,
                completed_at: new Date().toISOString(),
                rpe: Number(form.rpe),
                notes: form.notes || undefined,
            };

            if (form.status === 'skipped' || exercisesPayload.some(item => item.actual || item.notes || item.rpe)) {
                payload.exercises = exercisesPayload;
            }

            const { data } = await apiClient.updateSession(state.session.id, payload);

            showToast?.({
                title: 'Отчёт сохранён',
                message: data.next_steps || 'Тренировка обновлена. Продолжай в том же духе!',
                type: 'success',
            });

            await Promise.all([loadSession(), refreshProfile?.()]);
        } catch (error) {
            showToast?.({
                title: 'Не удалось сохранить отчёт',
                message: error.message,
                type: 'error',
                traceId: error.traceId,
            });
        } finally {
            setSaving(false);
        }
    };

    if (state.loading) {
        return (
            <div className="view report-view">
                <h2>📝 Отчёт о тренировке</h2>
                <SkeletonCard lines={4} />
            </div>
        );
    }

    if (state.error && !state.session) {
        return (
            <div className="view report-view">
                <h2>📝 Отчёт о тренировке</h2>
                <ErrorState
                    title="Не удалось загрузить тренировку"
                    message={state.error.message}
                    actionLabel="Попробовать ещё раз"
                    onRetry={loadSession}
                />
            </div>
        );
    }

    return (
        <div className="view report-view">
            <h2>📝 Отчёт о тренировке</h2>

            {(state.fallback || demoMode) && (
                <div className="card demo-hint">
                    <h3>Предпросмотр отчёта</h3>
                    <p className="text-muted">
                        Сейчас показан примерный план, чтобы показать как работает форма. После подключения WebApp данные будут сохраняться в профиль.
                    </p>
                    <pre className="demo-snippet">{DEMO_REPORT_HINT.trim()}</pre>
                </div>
            )}

            {state.session ? (
                <form className="card report-form" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-field">
                            <label htmlFor="status">Статус тренировки</label>
                            <select id="status" name="status" value={form.status} onChange={handleFormChange}>
                                <option value="done">Выполнена</option>
                                <option value="skipped">Пропущена</option>
                            </select>
                        </div>
                        <div className="form-field">
                            <label htmlFor="rpe">RPE</label>
                            <select id="rpe" name="rpe" value={form.rpe} onChange={handleFormChange}>
                                {Array.from({ length: 10 }, (_, index) => String(index + 1)).map(value => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-field">
                            <label htmlFor="notes">Общие заметки</label>
                            <textarea
                                id="notes"
                                name="notes"
                                value={form.notes}
                                onChange={handleFormChange}
                                placeholder="Самочувствие, сложности, что улучшить"
                            />
                        </div>
                    </div>

                    <div className="exercise-report-grid">
                        {exercises.map((exercise, index) => {
                            const formEntry = form.exercises[exercise.key] || { sets: '', reps: '', notes: '', rpe: form.rpe };
                            return (
                                <div key={exercise.key} className="exercise-report-card">
                                    <div className="exercise-report-header">
                                        <span className="exercise-report-name">{index + 1}. {exercise.name}</span>
                                        {exercise.target?.sets && (
                                            <span className="exercise-report-target">
                                                План: {exercise.target.sets} × {exercise.target.reps || '—'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="exercise-report-fields">
                                        <label>
                                            Подходы
                                            <input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                value={formEntry.sets}
                                                onChange={(event) => handleExerciseChange(exercise.key, 'sets', event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            Повторы
                                            <input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                value={formEntry.reps}
                                                onChange={(event) => handleExerciseChange(exercise.key, 'reps', event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            RPE упражнения
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                inputMode="numeric"
                                                value={formEntry.rpe}
                                                onChange={(event) => handleExerciseChange(exercise.key, 'rpe', event.target.value)}
                                            />
                                        </label>
                                        <label>
                                            Заметки
                                            <textarea
                                                value={formEntry.notes}
                                                onChange={(event) => handleExerciseChange(exercise.key, 'notes', event.target.value)}
                                                placeholder="Техника, ощущения, прогресс"
                                            />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="report-footer">
                        <span className="source-label">Источник данных: {state.fallback ? 'примерный план' : state.source || 'Supabase'}</span>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? 'Сохраняю…' : 'Сохранить отчёт'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="card">
                    <h3>Сегодня день восстановления</h3>
                    <p className="text-muted">
                        В плане нет тренировки — можешь записать заметку вручную или попросить бота перенести занятие.
                    </p>
                    <button className="btn btn-secondary" type="button" onClick={loadSession}>
                        Обновить план
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReportView;
