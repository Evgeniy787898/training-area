import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import DaySwitcher from '../components/DaySwitcher';
import StatusBadge from '../components/StatusBadge';
import SessionNotebook from '../components/SessionNotebook';
import TabataTimer from '../components/TabataTimer';
import { getStaticSessionForDate } from '../services/staticPlan';

const REST_MESSAGES = [
    '🧘 Сегодня перезаряжаемся: прогулка 30 минут и растяжка спины.',
    '💤 Сон + вода + 10 минут мобилизации — лучший вклад в прогресс.',
    '🧊 Добавь контрастный душ или лёгкую баню, чтобы восстановиться быстрее.',
    '🍽️ Сфокусируйся на питании: белок в каждом приёме пищи и вода 2л.',
    '🧠 Разбор техники: пересмотри видео прошлой тренировки и отметь нюансы.',
];

const formatSourceLabel = (state) => {
    if (state.fallback) {
        return 'локальный офлайн-план';
    }
    if (state.source === 'database') {
        return 'актуальные данные из Supabase';
    }
    if (state.source === 'fallback') {
        return 'базовый шаблон прогрессии';
    }
    return 'источник неизвестен';
};

const TodayView = () => {
    const { showToast, refreshProfile, demoMode } = useAppContext();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [state, setState] = useState({ loading: true, session: null, source: null, error: null, fallback: false });
    const [exerciseResults, setExerciseResults] = useState({});
    const [saving, setSaving] = useState(false);
    const [timerVisible, setTimerVisible] = useState(false);

    const loadSession = useCallback(async (date) => {
        setState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        setTimerVisible(false);
        setExerciseResults({});

        try {
            const isoDate = format(date, 'yyyy-MM-dd');
            const { data } = await apiClient.getTodaySession(isoDate);
            setState({
                loading: false,
                session: data.session,
                source: data.source,
                error: null,
                fallback: data.source !== 'database',
            });
        } catch (error) {
            const fallbackSession = getStaticSessionForDate(date);
            if (fallbackSession) {
                setState({
                    loading: false,
                    session: fallbackSession,
                    source: 'static_plan',
                    error: null,
                    fallback: true,
                });
                showToast?.({
                    title: 'Режим предпросмотра',
                    message: 'Показываю офлайн-план. Подключи Telegram WebApp, чтобы получить точные данные.',
                    type: 'warning',
                    traceId: error.traceId,
                });
            } else {
                setState({ loading: false, session: null, source: null, error, fallback: false });
            }
        }
    }, [showToast]);

    useEffect(() => {
        loadSession(selectedDate);
    }, [selectedDate, loadSession]);

    const restMessage = useMemo(() => {
        const index = selectedDate.getDate() % REST_MESSAGES.length;
        return REST_MESSAGES[index];
    }, [selectedDate]);

    const handleExerciseChange = (exerciseKey, value) => {
        setExerciseResults(prev => ({
            ...prev,
            [exerciseKey]: Number.isFinite(value) ? value : 0,
        }));
    };

    const handleSaveSession = async () => {
        if (!state.session?.id) {
            showToast?.({
                title: demoMode ? 'Демо режим' : 'Нет связанной тренировки',
                message: demoMode
                    ? 'Сохраняю заметки только локально. Подключи Telegram, чтобы отправлять данные в Supabase.'
                    : 'Не удалось определить тренировку. Открой панель из Telegram и попробуй ещё раз.',
                type: demoMode ? 'info' : 'error',
            });
            return;
        }

        setSaving(true);
        try {
            const exercisesPayload = (state.session.exercises || []).map((exercise, index) => {
                const key = exercise.exercise_key || `exercise_${index}`;
                const actual = exerciseResults[key];
                const payload = {
                    exercise_key: exercise.exercise_key || exercise.name || key,
                    target: exercise.target || {},
                    state: 'done',
                };

                if (Number.isFinite(actual)) {
                    payload.actual = { reps: actual };
                }

                return payload;
            });

            const payload = {
                status: 'done',
                completed_at: new Date().toISOString(),
                rpe: state.session.rpe || 7,
                exercises: exercisesPayload,
            };

            const { data } = await apiClient.updateSession(state.session.id, payload);
            showToast?.({
                title: 'Тренировка зафиксирована',
                message: data.next_steps || 'Данные сохранены. Переходим к восстановлению!',
                type: 'success',
            });

            await Promise.all([loadSession(selectedDate), refreshProfile?.()]);
        } catch (error) {
            showToast?.({
                title: 'Не получилось сохранить прогресс',
                message: error.message,
                type: 'error',
                traceId: error.traceId,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleStartTimer = () => {
        setTimerVisible(true);
    };

    const handleTimerComplete = () => {
        showToast?.({
            title: 'Цикл завершён',
            message: 'Отметь объём и нажми «Сохранить результат», чтобы зафиксировать тренировку.',
            type: 'success',
        });
    };

    const isRestDay = !state.session;
    const isFuture = selectedDate > new Date() && !isToday(selectedDate);

    if (state.loading) {
        return (
            <div className="view today-view">
                <div className="today-top">
                    <DaySwitcher date={selectedDate} onChange={setSelectedDate} />
                    <StatusBadge status="training" compact />
                </div>
                <SkeletonCard lines={5} />
            </div>
        );
    }

    if (state.error && !state.session) {
        return (
            <div className="view today-view">
                <div className="today-top">
                    <DaySwitcher date={selectedDate} onChange={setSelectedDate} />
                    <StatusBadge status="training" compact />
                </div>
                <ErrorState
                    message={state.error.message}
                    actionLabel="Попробовать ещё раз"
                    onRetry={() => loadSession(selectedDate)}
                />
            </div>
        );
    }

    return (
        <div className="view today-view">
            <div className="today-top">
                <DaySwitcher date={selectedDate} onChange={setSelectedDate} />
                <StatusBadge status={isRestDay ? 'rest' : 'training'} />
            </div>

            {isRestDay ? (
                <div className="card rest-card">
                    <h3>Сегодня фокус на восстановлении</h3>
                    <p>{restMessage}</p>
                    {isFuture && (
                        <p className="text-muted">Эта дата ещё впереди. План появится автоматически, когда приблизится день.</p>
                    )}
                    <div className="rest-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={() => showToast?.({
                                title: 'Хочешь потренироваться?',
                                message: 'В разделе «Упражнения» собраны уровни и вариации на любой случай.',
                                type: 'info',
                            })}
                        >
                            Посмотреть прогрессии
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => showToast?.({
                                title: 'Контроль восстановления',
                                message: 'Запланируй лёгкую прогулку, дыхательную практику или контрастный душ.',
                                type: 'info',
                            })}
                        >
                            Идеи для активности
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="card session-wrapper">
                        <div className="session-meta">
                            <span className="source-chip">Источник: {formatSourceLabel(state)}</span>
                            <span className="date-chip">
                                {format(selectedDate, 'd MMMM, EEEE', { locale: ru }).replace(/^./, char => char.toUpperCase())}
                            </span>
                        </div>
                        <SessionNotebook
                            session={state.session}
                            history={{}}
                            onExerciseChange={handleExerciseChange}
                        />

                        <div className="session-actions">
                            <button className="btn btn-primary" onClick={handleStartTimer}>
                                🚀 Приступить к тренировке
                            </button>
                            <button className="btn btn-success" onClick={handleSaveSession} disabled={saving}>
                                {saving ? 'Сохраняю…' : '✅ Сохранить результат'}
                            </button>
                        </div>
                    </div>

                    {timerVisible && (
                        <div className="card timer-card">
                            <TabataTimer onSessionComplete={handleTimerComplete} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TodayView;
