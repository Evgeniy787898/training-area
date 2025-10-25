import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import ExerciseCard from '../components/ExerciseCard';

const ExercisesView = () => {
    const { showToast } = useAppContext();
    const [catalogState, setCatalogState] = useState({ loading: true, error: null, items: [] });
    const [expandedKey, setExpandedKey] = useState(null);
    const [historyMap, setHistoryMap] = useState({});
    const [historyLoading, setHistoryLoading] = useState({});

    const loadCatalog = useCallback(async () => {
        setCatalogState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const { data } = await apiClient.getExerciseCatalog();
            setCatalogState({ loading: false, error: null, items: data.items || [] });
        } catch (error) {
            setCatalogState({ loading: false, error, items: [] });
        }
    }, []);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    const loadHistory = useCallback(async (exerciseKey) => {
        if (historyMap[exerciseKey] || historyLoading[exerciseKey]) {
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
    }, [historyMap, historyLoading, showToast]);

    const handleToggle = (exerciseKey) => {
        setExpandedKey(prev => (prev === exerciseKey ? null : exerciseKey));
        if (expandedKey !== exerciseKey) {
            loadHistory(exerciseKey);
        }
    };

    if (catalogState.loading) {
        return (
            <div className="view exercises-view">
                <h2>📚 Каталог прогрессий</h2>
                <SkeletonCard lines={5} />
                <SkeletonCard lines={4} />
            </div>
        );
    }

    if (catalogState.error) {
        return (
            <div className="view exercises-view">
                <h2>📚 Каталог прогрессий</h2>
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
            <h2>📚 Каталог прогрессий</h2>
            <p className="text-muted">
                Изучи путь развития по каждому направлению калистеники. Нажми на карточку, чтобы увидеть уровни и историю своих тренировок.
            </p>

            <div className="exercise-grid">
                {catalogState.items.map((exercise) => (
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
