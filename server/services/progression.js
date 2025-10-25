import { db } from '../infrastructure/supabase.js';

/**
 * Сервис для расчёта прогрессий упражнений
 */
export class ProgressionService {
    /**
     * Анализирует выполнение упражнения и принимает решение о прогрессии
     */
    async analyzeExercise(exerciseData) {
        const {
            targetSets,
            targetReps,
            actualSets,
            actualReps,
            rpe,
            notes,
        } = exerciseData;

        // Рассчитываем объём
        const targetVolume = targetSets * targetReps;
        const actualVolume = actualSets * actualReps;
        const completionRate = targetVolume > 0 ? actualVolume / targetVolume : 0;

        let decision = 'hold'; // По умолчанию - закрепление
        let reasoning = '';

        // Применяем правила прогрессии
        if (completionRate >= 1.05 && rpe <= 7) {
            decision = 'advance';
            reasoning = 'Перевыполнение объёма при низком RPE - готов к повышению уровня';
        } else if (completionRate >= 0.9 && rpe <= 9) {
            decision = 'hold';
            reasoning = 'Хорошее выполнение - закрепляем уровень';
        } else if (completionRate < 0.9 || rpe >= 10 || notes?.includes('боль')) {
            decision = 'regress';
            reasoning = 'Недовыполнение или высокая нагрузка - снижаем уровень';
        }

        // Проверяем на признаки боли или травмы
        if (notes) {
            const painKeywords = ['боль', 'болит', 'травма', 'тянет', 'дискомфорт'];
            const hasPain = painKeywords.some(keyword =>
                notes.toLowerCase().includes(keyword)
            );

            if (hasPain) {
                decision = 'regress';
                reasoning = 'Признаки боли - переходим на облегчённый вариант';
            }
        }

        return {
            decision,
            reasoning,
            metrics: {
                targetVolume,
                actualVolume,
                completionRate: Math.round(completionRate * 100),
                rpe,
            },
        };
    }

    /**
     * Рассчитывает следующий уровень упражнения
     */
    calculateNextLevel(currentLevel, decision) {
        // Парсим уровень (формат: "5.2" -> уровень 5, подуровень 2)
        const [level, sublevel] = currentLevel.split('.').map(Number);

        let nextLevel = currentLevel;

        if (decision === 'advance') {
            // Переход на следующий подуровень или уровень
            if (sublevel >= 3) {
                // Переход на следующий уровень
                nextLevel = `${level + 1}.1`;
            } else {
                // Переход на следующий подуровень
                nextLevel = `${level}.${sublevel + 1}`;
            }
        } else if (decision === 'regress') {
            // Возврат на предыдущий подуровень или уровень
            if (sublevel <= 1) {
                // Возврат на предыдущий уровень (если не первый)
                if (level > 1) {
                    nextLevel = `${level - 1}.3`;
                }
            } else {
                // Возврат на предыдущий подуровень
                nextLevel = `${level}.${sublevel - 1}`;
            }
        }
        // Для 'hold' - уровень остаётся тем же

        return nextLevel;
    }

    /**
     * Сохраняет результаты анализа прогрессии
     */
    async saveProgressionDecision(sessionId, exerciseKey, analysis, currentLevel, nextLevel) {
        try {
            await db.createExerciseProgress({
                session_id: sessionId,
                exercise_key: exerciseKey,
                level_target: currentLevel,
                level_result: nextLevel,
                volume_target: analysis.metrics.targetVolume,
                volume_actual: analysis.metrics.actualVolume,
                rpe: analysis.metrics.rpe,
                decision: analysis.decision,
                notes: analysis.reasoning,
                streak_success: analysis.decision === 'advance' ? 1 : 0,
            });

            return true;
        } catch (error) {
            console.error('Error saving progression decision:', error);
            return false;
        }
    }

    /**
     * Получает историю прогрессии по упражнению
     */
    async getExerciseHistory(profileId, exerciseKey, limit = 10) {
        try {
            const history = await db.getExerciseProgressHistory(profileId, exerciseKey, limit);
            return history || [];
        } catch (error) {
            console.error('Error fetching exercise history:', error);
            return [];
        }
    }

    /**
     * Рассчитывает тренд прогресса
     */
    calculateProgressTrend(history) {
        if (!history || history.length < 2) {
            return { trend: 'neutral', percentage: 0 };
        }

        const recent = history.slice(0, 3);
        const advances = recent.filter(h => h.decision === 'advance').length;
        const regresses = recent.filter(h => h.decision === 'regress').length;

        if (advances > regresses) {
            return { trend: 'up', percentage: Math.round((advances / recent.length) * 100) };
        } else if (regresses > advances) {
            return { trend: 'down', percentage: Math.round((regresses / recent.length) * 100) };
        } else {
            return { trend: 'neutral', percentage: 50 };
        }
    }
}

export default new ProgressionService();

