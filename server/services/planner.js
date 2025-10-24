import OpenAI from 'openai';
import config from '../config/env.js';

const openai = new OpenAI({
    apiKey: config.openai.apiKey,
});

// Системный промпт тренера
const SYSTEM_PROMPT = `Ты — виртуальный тренер по функциональному тренингу и калистенике. 

Твои принципы:
1. Следуй структуре ответов: резюме → блоки (Цель, Разминка, Основная часть, Заминка, Следующий шаг)
2. Используй метрику RPE (Rate of Perceived Exertion) по шкале 1-10
3. Говори дружелюбно, мотивируй, но без излишней фамильярности
4. Все ответы на русском языке
5. Используй эмодзи умеренно: ✅ выполнено, 🔁 корректировка, 🔥 интенсивная работа, 💤 восстановление
6. Адаптируй нагрузку на основе RPE и обратной связи

Формат тренировок:
- Темп упражнений (TUT): указывай в формате "3-1-1-0" (вниз-пауза-вверх-пауза)
- Интервалы отдыха: 90-120 сек для силовых, 60-90 сек для выносливости
- Всегда включай разминку (5 мин) и заминку (5 мин)

Правила безопасности:
- При RPE ≥ 8 снижай объём на 10-15%
- При словах "боль", "травма", "тянет" — переходи в режим восстановления
- При двух пропусках подряд предлагай облегчённый план

Следи за прогрессией:
- Успех (выполнено ≥105% целевого объёма, RPE ≤7) → повышай уровень
- Закрепление (90-105% объёма, RPE 8-9) → повторяй уровень
- Откат (< 90% объёма, RPE ≥10 или боль) → снижай уровень

Помни: ты помогаешь пользователю тренироваться последовательно, безопасно и с прогрессом.`;

export class PlannerService {
    /**
     * Генерирует тренировочный план на основе целей и истории пользователя
     */
    async generateTrainingPlan(userContext) {
        const { goals, equipment, recentSessions, constraints } = userContext;

        const userPrompt = this._buildUserPrompt({
            goals,
            equipment,
            recentSessions,
            constraints,
        });

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 2000,
            });

            const response = completion.choices[0].message.content;
            return this._parseTrainingPlanResponse(response);
        } catch (error) {
            console.error('Error generating training plan:', error);
            throw new Error('Не удалось сгенерировать план тренировки');
        }
    }

    /**
     * Анализирует отчёт о тренировке и даёт рекомендации
     */
    async analyzeTrainingReport(reportContext) {
        const { session, exercises, rpe, notes, history } = reportContext;

        const analysisPrompt = this._buildAnalysisPrompt({
            session,
            exercises,
            rpe,
            notes,
            history,
        });

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: analysisPrompt },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            });

            const response = completion.choices[0].message.content;
            return {
                feedback: response,
                suggestions: this._extractSuggestions(response),
            };
        } catch (error) {
            console.error('Error analyzing training report:', error);
            throw new Error('Не удалось проанализировать отчёт');
        }
    }

    /**
     * Генерирует мотивационное сообщение
     */
    async generateMotivationalMessage(context) {
        const { adherence, progressData, currentStreak } = context;

        const prompt = `На основе данных пользователя создай короткое мотивационное сообщение (2-3 предложения):
- Выполнено тренировок за 4 недели: ${adherence}%
- Текущая серия: ${currentStreak} тренировок подряд
- Прогресс: ${progressData}

Сообщение должно быть конкретным, опираться на факты и мотивировать продолжать.`;

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.8,
                max_tokens: 300,
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error generating motivational message:', error);
            return 'Отличная работа! Продолжай в том же духе 💪';
        }
    }

    /**
     * Формирует промпт для генерации плана
     */
    _buildUserPrompt({ goals, equipment, recentSessions, constraints }) {
        let prompt = `Составь персональный тренировочный план на неделю.\n\n`;

        // Цели
        prompt += `**Цели:**\n`;
        if (goals.primary) {
            prompt += `- Основная: ${goals.primary}\n`;
        }
        if (goals.secondary) {
            prompt += `- Дополнительная: ${goals.secondary}\n`;
        }

        // Доступное оборудование
        prompt += `\n**Доступное оборудование:**\n`;
        if (equipment && equipment.length > 0) {
            equipment.forEach(item => {
                prompt += `- ${item}\n`;
            });
        } else {
            prompt += `- Только вес тела\n`;
        }

        // Ограничения
        if (constraints) {
            prompt += `\n**Ограничения:**\n`;
            if (constraints.maxDuration) {
                prompt += `- Максимальная длительность тренировки: ${constraints.maxDuration} минут\n`;
            }
            if (constraints.daysPerWeek) {
                prompt += `- Количество тренировок в неделю: ${constraints.daysPerWeek}\n`;
            }
            if (constraints.injuries) {
                prompt += `- Травмы/ограничения: ${constraints.injuries}\n`;
            }
        }

        // Недавние тренировки
        if (recentSessions && recentSessions.length > 0) {
            prompt += `\n**Последние тренировки:**\n`;
            recentSessions.slice(0, 3).forEach((session, index) => {
                prompt += `${index + 1}. ${session.date}: ${session.summary} (RPE: ${session.rpe || 'н/д'})\n`;
            });
        }

        prompt += `\n**Требования:**\n`;
        prompt += `1. Составь план на 4-6 тренировок с учётом прогрессии\n`;
        prompt += `2. Для каждой тренировки укажи: цель, разминку, основную часть (упражнения, подходы, повторы, темп, отдых), заминку\n`;
        prompt += `3. Укажи целевое RPE для каждой тренировки\n`;
        prompt += `4. Добавь конкретные технические подсказки (cues)\n`;

        return prompt;
    }

    /**
     * Формирует промпт для анализа отчёта
     */
    _buildAnalysisPrompt({ session, exercises, rpe, notes, history }) {
        let prompt = `Проанализируй выполненную тренировку и дай обратную связь.\n\n`;

        prompt += `**Плановая тренировка:**\n${session.description}\n\n`;

        prompt += `**Фактическое выполнение:**\n`;
        if (exercises && exercises.length > 0) {
            exercises.forEach(ex => {
                prompt += `- ${ex.name}: ${ex.sets}×${ex.reps} (план: ${ex.targetSets}×${ex.targetReps})\n`;
            });
        }
        prompt += `\n**RPE:** ${rpe}\n`;

        if (notes) {
            prompt += `**Заметки:** ${notes}\n`;
        }

        if (history && history.length > 0) {
            prompt += `\n**История (последние 3 тренировки):**\n`;
            history.slice(0, 3).forEach((h, i) => {
                prompt += `${i + 1}. ${h.date}: RPE ${h.rpe}, выполнено ${h.completionRate}%\n`;
            });
        }

        prompt += `\n**Дай:**\n`;
        prompt += `1. Краткую оценку выполнения (1-2 предложения)\n`;
        prompt += `2. Рекомендацию на следующую тренировку (продвинуть/повторить/облегчить)\n`;
        prompt += `3. Один совет по технике или восстановлению\n`;

        return prompt;
    }

    /**
     * Парсит ответ с планом тренировки
     */
    _parseTrainingPlanResponse(response) {
        // Простой парсер - можно расширить для более структурированного извлечения
        return {
            rawText: response,
            structured: {
                // Здесь можно добавить логику для извлечения структурированных данных
                // Пока возвращаем текст как есть
            },
        };
    }

    /**
     * Извлекает рекомендации из ответа
     */
    _extractSuggestions(response) {
        const suggestions = [];

        // Простая эвристика для извлечения рекомендаций
        if (response.toLowerCase().includes('продвинуть') || response.toLowerCase().includes('повысить')) {
            suggestions.push({ type: 'advance', confidence: 0.8 });
        }
        if (response.toLowerCase().includes('повторить') || response.toLowerCase().includes('закрепить')) {
            suggestions.push({ type: 'hold', confidence: 0.8 });
        }
        if (response.toLowerCase().includes('облегчить') || response.toLowerCase().includes('снизить')) {
            suggestions.push({ type: 'regress', confidence: 0.8 });
        }

        return suggestions;
    }
}

export default new PlannerService();

