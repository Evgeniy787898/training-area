import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAppContext } from '../context/AppContext';
import SkeletonCard from '../components/SkeletonCard';
import ErrorState from '../components/ErrorState';
import ExerciseCard from '../components/ExerciseCard';
import { STATIC_EXERCISE_CATALOG } from '../services/staticCatalog';

const ExercisesView = () => {
    const { showToast } = useAppContext();
    const [catalogState, setCatalogState] = useState({ loading: true, error: null, items: [], fallback: false });
    const [expandedKey, setExpandedKey] = useState(null);
    const [historyMap, setHistoryMap] = useState({});
    const [historyLoading, setHistoryLoading] = useState({});

    const loadCatalog = useCallback(async () => {
        setCatalogState(prev => ({ ...prev, loading: true, error: null, fallback: false }));
        try {
            const { data } = await apiClient.getExerciseCatalog();
            setCatalogState({ loading: false, error: null, items: data.items || [], fallback: false });
        } catch (error) {
            setCatalogState({ loading: false, error: null, items: STATIC_EXERCISE_CATALOG, fallback: true });
            showToast({
                title: 'Показан каталог по умолчанию',
                message: error.message,
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

    if (catalogState.loading) {
        return (
            <div className="view exercises-view">
                <h2>📚 Каталог прогрессий</h2>
                <SkeletonCard lines={5} />
                <SkeletonCard lines={4} />
            </div>
        );
    }

    if (catalogState.error && !catalogState.items.length) {
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

            <div className="card">
                <h3>🧭 Как пользоваться прогрессиями</h3>
                <p>
                    Каждое упражнение состоит из последовательности уровней. Выполняй целевой объём легко — переходи к следующему.
                    Если тяжело, повтори уровень или откати на шаг назад.
                </p>
                <ul className="text-muted">
                    <li>🔥 Уровни с высоким RPE держим дважды подряд, прежде чем усложнять.</li>
                    <li>🛠️ Появилась боль — переходи на более простой вариант и добавляй технику.</li>
                    <li>📈 История подтягивается из отчётов /report и отметок в WebApp.</li>
                </ul>
                {catalogState.fallback && (
                    <p className="text-muted">
                        Показаны справочные данные. Для актуальных прогрессий открой WebApp из чата после тренировок.
                    </p>
                )}
            </div>

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
