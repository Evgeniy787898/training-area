import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import ExerciseCard from '../components/ExerciseCard';
import { STATIC_EXERCISE_CATALOG } from '../services/staticCatalog';

const STANDALONE_MODE = import.meta.env.VITE_STANDALONE_MODE === '1';

const PROGRAMS = [
    { id: 'calisthenics', title: 'Калистеника', subtitle: 'Турник, собственный вес, мобильность' },
    { id: 'functional', title: 'Функциональный тренинг', subtitle: 'Скоро', locked: true },
    { id: 'weights', title: 'Силовые тренировки', subtitle: 'В разработке', locked: true },
];

const ExercisesView = () => {
    const { showToast } = useAppContext();
    const [catalogState, setCatalogState] = useState({ loading: true, error: null, items: [], fallback: false });
    const [expandedKey, setExpandedKey] = useState(null);
    const [historyMap, setHistoryMap] = useState({});
    const [historyLoading, setHistoryLoading] = useState({});
    const [activeProgram, setActiveProgram] = useState('calisthenics');

    const loadCatalog = useCallback(async () => {
        setCatalogState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        try {
            const { data } = await apiClient.getExerciseCatalog();
            setCatalogState({ loading: false, error: null, items: data.items || [], fallback: false });
        } catch (error) {
            setCatalogState({ loading: false, error: null, items: STATIC_EXERCISE_CATALOG, fallback: true });
            showToast({
                title: 'Каталог офлайн',
                message: 'Показываю встроенные прогрессии, пока нет соединения с сервером.',
                type: 'warning',
                traceId: error.traceId,
            });
        }
    }, [showToast]);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    const loadHistory = useCallback(async (exerciseKey) => {
        if (historyMap[exerciseKey] || historyLoading[exerciseKey]) {
            return;
        }

        if (catalogState.fallback) {
            setHistoryMap(prev => ({ ...prev, [exerciseKey]: [] }));
            return;
        }

        setHistoryLoading(prev => ({ ...prev, [exerciseKey]: true }));
        try {
            const { data } = await apiClient.getExerciseHistory(exerciseKey);
            setHistoryMap(prev => ({ ...prev, [exerciseKey]: data.items || [] }));
        } catch (error) {
            showToast({
                title: 'Не удалось загрузить историю',
                message: error.message,
                type: 'error',
            });
        } finally {
            setHistoryLoading(prev => ({ ...prev, [exerciseKey]: false }));
        }
    }, [historyMap, historyLoading, showToast, catalogState.fallback]);

    const handleToggle = (exerciseKey) => {
        setExpandedKey(prev => (prev === exerciseKey ? null : exerciseKey));
        if (expandedKey !== exerciseKey) {
            loadHistory(exerciseKey);
        }
    };

    const handleProgramChange = (programId, locked) => {
        if (locked) {
            showToast({
                title: 'Скоро',
                message: 'Дополнительные программы появятся после запуска основного релиза.',
                type: 'info',
            });
            return;
        }
        setActiveProgram(programId);
        setExpandedKey(null);
    };

    const filteredExercises = useMemo(() => {
        return (catalogState.items || []).filter(item => (item.program || 'calisthenics') === activeProgram);
    }, [catalogState.items, activeProgram]);

    if (catalogState.loading) {
        return (
            <div className="view exercises-view">
                <h2>🧱 Прогрессии упражнений</h2>
                <SkeletonCard lines={5} />
                <SkeletonCard lines={4} />
            </div>
        );
    }

    if (catalogState.error && !catalogState.items.length) {
        return (
            <div className="view exercises-view">
                <h2>🧱 Прогрессии упражнений</h2>
                <ErrorState
                    title="Не удалось загрузить упражнения"
                    message={catalogState.error.message}
                    actionLabel="Попробовать ещё раз"
                    onRetry={loadCatalog}
                />
            </div>
        );
    }

    return (
        <div className="view exercises-view">
            <h2>🧱 Прогрессии упражнений</h2>
            <p className="text-muted">
                Здесь живут уровни и подсказки по технике. Открывай карточки, смотри уровни, отмечай прогресс. Видео и фото подтягиваем из Supabase — в офлайн-режиме показываю шаблон.
            </p>

            <div className="program-switcher">
                {PROGRAMS.map(program => (
                    <button
                        key={program.id}
                        className={`program-chip ${activeProgram === program.id ? 'active' : ''} ${program.locked ? 'locked' : ''}`}
                        onClick={() => handleProgramChange(program.id, program.locked)}
                    >
                        <span className="program-title">{program.title}</span>
                        <span className="program-subtitle">{program.subtitle}</span>
                    </button>
                ))}
            </div>

            <div className="card program-info">
                <h3>🎯 Текущий фокус — {PROGRAMS.find(program => program.id === activeProgram)?.title}</h3>
                <p>
                    Один клик по программе делает её основной. План тренировок, прогрессии и рекомендации будут учитывать выбранный фокус. Остальные программы появятся после релиза — мы уже готовим библиотеку с видео и чек-листами.
                </p>
                <div className="info-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => showToast({
                            title: 'Добавить своё видео',
                            message: 'Загрузка собственных медиа появится в одном из ближайших обновлений.',
                            type: 'info',
                        })}
                    >
                        Добавить своё видео (скоро)
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => showToast({
                            title: 'Новый план',
                            message: 'Конструктор новых планов пока в разработке — скоро можно будет собирать свои циклы.',
                            type: 'info',
                        })}
                    >
                        Создать план (в разработке)
                    </button>
                </div>
                {catalogState.fallback && (
                    <p className="text-muted">
                        {STANDALONE_MODE
                            ? 'Каталог загружен из локальной копии. Проверь настройки доступа к Supabase, чтобы показать актуальные данные.'
                            : 'Пока показываю демонстрационный каталог. Для синхронизации с Supabase открой WebApp из Telegram.'}
                    </p>
                )}
            </div>

            <div className="exercise-grid">
                {filteredExercises.map(exercise => (
                    <ExerciseCard
                        key={exercise.key}
                        exercise={exercise}
                        expanded={expandedKey === exercise.key}
                        onToggle={handleToggle}
                        history={historyMap[exercise.key] || []}
                        loadingHistory={!!historyLoading[exercise.key]}
                    />
                ))}
            </div>
        </div>
    );
};

export default ExercisesView;
