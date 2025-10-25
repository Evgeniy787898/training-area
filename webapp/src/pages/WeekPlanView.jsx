import React, { useEffect, useState, useCallback } from 'react';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import { buildStaticPlan } from '../services/staticPlan';

const WeekPlanView = () => {
    const { showToast, setActiveTab } = useAppContext();
    const [referenceDate, setReferenceDate] = useState(new Date());
    const [state, setState] = useState({ loading: true, sessions: [], source: null, week: null, error: null, fallback: false });

    const loadWeek = useCallback(async (date) => {
        setState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        try {
            const { data } = await apiClient.getWeekPlan(format(date, 'yyyy-MM-dd'));
            setState({
                loading: false,
                sessions: data.sessions || [],
                source: data.source,
                week: { start: data.week_start, end: data.week_end },
                error: null,
                fallback: false,
            });
        } catch (error) {
            const plan = buildStaticPlan(date);
            if (plan.sessions?.length) {
                setState({
                    loading: false,
                    sessions: plan.sessions,
                    source: 'static_plan',
                    week: { start: plan.week_start, end: plan.week_end },
                    error: null,
                    fallback: true,
                });
                showToast({
                    title: 'Показан пример недели',
                    message: error.message,
                    type: 'warning',
                    traceId: error.traceId,
                });
            } else {
                setState({ loading: false, sessions: [], source: null, week: null, error, fallback: false });
            }
        }
    }, [showToast]);

    useEffect(() => {
        loadWeek(referenceDate);
    }, [referenceDate, loadWeek]);

    const handleChangeWeek = (direction) => {
        const nextDate = addDays(referenceDate, direction * 7);
        setReferenceDate(nextDate);
    };

    const sessionsByDate = new Map((state.sessions || []).map(session => [session.date, session]));
    const weekStartDate = state.week?.start ? parseISO(state.week.start) : referenceDate;

    const renderContent = () => {
        if (state.loading) {
            return <SkeletonCard lines={5} />;
        }

        if (state.error) {
            return (
                <ErrorState
                    message={state.error.message}
                    actionLabel="Обновить"
                    onRetry={() => loadWeek(referenceDate)}
                />
            );
        }

        const days = [...Array(7)].map((_, index) => {
            const dayDate = addDays(weekStartDate, index);
            const dateKey = format(dayDate, 'yyyy-MM-dd');
            const session = sessionsByDate.get(dateKey);
            const status = session?.status || 'rest';

            return {
                day: format(dayDate, 'EE', { locale: ru }),
                date: format(dayDate, 'd MMM', { locale: ru }),
                isToday: isToday(dayDate),
                status,
                session,
            };
        });

        const planned = days.filter(day => day.session).length;
        const completed = days.filter(day => day.session?.status === 'done').length;

        const onOpenInChat = () => {
            showToast({
                title: 'Открыть в чате',
                message: 'Нажми кнопку «План» в чате, чтобы получить полную версию.',
                type: 'info',
            });
            window.Telegram?.WebApp?.close();
        };

        const handleGoToday = () => {
            setActiveTab?.('today');
            showToast({
                title: 'План на сегодня',
                message: 'Открыл детальную карточку дня.',
                type: 'info',
            });
        };

        return (
            <>
                <div className="week-calendar">
                    {days.map((day, index) => (
                        <div
                            key={index}
                            className={`day-card ${day.status} ${day.isToday ? 'today' : ''}`}
                        >
                            <div className="day-header">
                                <span className="day-name">{day.day}</span>
                                <span className="day-date">{day.date}</span>
                            </div>
                            <div className="day-status">
                                {day.status === 'done' && '✅'}
                                {day.status === 'planned' && '📋'}
                                {day.status === 'skipped' && '⏭️'}
                                {day.status === 'rest' && '💤'}
                                {day.isToday && '👉'}
                            </div>
                            <div className="day-type">{day.session?.session_type || 'Отдых'}</div>
                            {day.session?.focus && <div className="day-focus">🎯 {day.session.focus}</div>}
                        </div>
                    ))}
                </div>

                <div className="week-stats">
                    <div className="stat-item">
                        <span className="stat-label">Выполнено</span>
                        <span className="stat-value">{completed}/{planned}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Источник</span>
                        <span className="stat-value">{state.fallback ? 'локальный пример' : state.source === 'fallback' ? 'базовый план' : 'Supabase'}</span>
                    </div>
                    <div className="week-actions">
                        <button className="btn btn-primary" onClick={handleGoToday}>
                            Перейти к «Сегодня»
                        </button>
                        <button className="btn btn-secondary" onClick={onOpenInChat}>
                            Открыть в чате
                        </button>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="view week-view">
            <h2>📆 План на неделю</h2>

            <div className="week-toolbar">
                <button className="btn btn-secondary" onClick={() => handleChangeWeek(-1)} aria-label="Предыдущая неделя">
                    ←
                </button>
            <div className="week-range">
                {state.week
                    ? `${format(parseISO(state.week.start), 'd MMM', { locale: ru })} — ${format(parseISO(state.week.end), 'd MMM', { locale: ru })}`
                    : format(referenceDate, 'd MMM', { locale: ru })}
            </div>
            <button className="btn btn-secondary" onClick={() => handleChangeWeek(1)} aria-label="Следующая неделя">
                    →
                </button>
            </div>

            {state.fallback && (
                <p className="text-muted" style={{ marginBottom: '12px' }}>
                    Показана офлайн-версия плана. Для актуальных данных перезапусти WebApp из чата.
                </p>
            )}

            {renderContent()}
        </div>
    );
};

export default WeekPlanView;
