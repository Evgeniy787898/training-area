import { Markup } from 'telegraf';
import { format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { db } from '../../infrastructure/supabase.js';
import plannerService from '../../services/planner.js';
import progressionService from '../../services/progression.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { buildMainMenuKeyboard, withMainMenuButton } from '../utils/menu.js';

const REPORT_STATE_KEY = 'report';
const REPORT_STATE_TTL_MS = 2 * 60 * 60 * 1000; // 2 часа
const PERFORMANCE_SKIP_ACTION = 'report_performance_skip';

const EXERCISE_SYNONYMS = {
    pullups: ['подтяг', 'тяг', 'pull'],
    pushups: ['отжим', 'жим', 'push'],
    squats: ['присед', 'squat'],
    legRaises: ['пресс', 'кор', 'уголок', 'подъём', 'подъем', 'raises'],
    handstand: ['стойк', 'handstand'],
    bridge: ['мост', 'bridge'],
};

const COMPLETION_LABELS = {
    full: { rate: 100, label: 'Полностью' },
    partial: { rate: 70, label: 'Частично' },
    none: { rate: 0, label: 'Не получилось' },
};

/**
 * Команда /report - отчёт о тренировке
 */
export async function reportCommand(ctx) {
    const profileId = ctx.state.profileId;

    try {
        await beginChatResponse(ctx);

        const sessions = await db.getTrainingSessions(profileId, {
            status: 'planned',
        });

        if (!sessions || sessions.length === 0) {
            await replyWithTracking(ctx,
                '📋 Нет запланированных тренировок для отчёта.\n\n' +
                'Сначала создай план командой /plan',
                buildMainMenuKeyboard()
            );
            return;
        }

        const buttons = sessions.slice(0, 5).map(session => {
            const dateStr = format(new Date(session.date), 'd MMMM', { locale: ru });
            return [Markup.button.callback(
                `${dateStr} — ${session.session_type || 'Тренировка'}`,
                `report_session_${session.id}`
            )];
        });

        const keyboard = withMainMenuButton(buttons);

        await replyWithTracking(ctx,
            '📝 **Отчёт о тренировке**\n\n' +
            'Выбери тренировку, о которой хочешь отчитаться:',
            { parse_mode: 'Markdown', ...keyboard }
        );

    } catch (error) {
        console.error('Error in report command:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось загрузить список тренировок.');
    }
}

/**
 * Обработчик выбора тренировки для отчёта
 */
export async function reportSessionCallback(ctx) {
    await ctx.answerCbQuery();

    const sessionId = ctx.callbackQuery.data.replace('report_session_', '');

    try {
        const session = await db.getTrainingSession(sessionId);

        if (!session) {
            await ctx.reply('😔 Тренировка не найдена.');
            return;
        }

        await db.saveDialogState(
            ctx.state.profileId,
            REPORT_STATE_KEY,
            {
                sessionId: session.id,
                step: 'performance',
                performance: null,
            },
            stateExpiry()
        );

        await ctx.deleteMessage().catch(() => {});
        await beginChatResponse(ctx);

        const dateLabel = format(new Date(session.date), 'd MMMM', { locale: ru });
        const message =
            `📝 **Отчёт о тренировке**\n\n` +
            `Тренировка: ${dateLabel}\n\n` +
            `**Шаг 1/3: Как прошла тренировка?**\n` +
            `Напиши по одной строке на упражнение:\n` +
            `• «Подтягивания 3x8»\n` +
            `• «Отжимания 4 подхода по 12»\n` +
            `• «Пресс 3×20»\n\n` +
            `Если пропустил упражнение — просто не указывай его.\n`;

        const keyboard = withMainMenuButton([
            [Markup.button.callback('⏭️ Пропустить и перейти к RPE', PERFORMANCE_SKIP_ACTION)],
        ]);

        await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
        console.error('Error in report session callback:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Произошла ошибка при создании отчёта.');
    }
}

export async function performanceSkipCallback(ctx) {
    await ctx.answerCbQuery();

    const state = await db.getDialogState(ctx.state.profileId, REPORT_STATE_KEY);
    if (!state?.state_payload) {
        return;
    }

    const payload = {
        ...state.state_payload,
        step: 'rpe',
        performance: {
            entries: [],
            completionRate: 100,
            summary: 'Данные о подходах пропущены. Можно отметить только субъективную нагрузку.',
        },
    };

    await db.saveDialogState(
        ctx.state.profileId,
        REPORT_STATE_KEY,
        payload,
        stateExpiry()
    );

    await promptForRpe(ctx, payload.performance.summary);
}

/**
 * Обработчик текстовых заметок на этапе фиксации подходов
 */
export async function handlePerformanceText(ctx) {
    const state = await db.getDialogState(ctx.state.profileId, REPORT_STATE_KEY);
    if (!state?.state_payload || state.state_payload.step !== 'performance') {
        return false;
    }

    const session = await db.getTrainingSession(state.state_payload.sessionId);
    if (!session) {
        await replyWithTracking(ctx, 'Не удалось найти тренировку. Попробуй снова через /report.');
        return true;
    }

    const parsed = parsePerformanceInput(ctx.message.text, session);

    if (!parsed.entries.length) {
        await replyWithTracking(ctx,
            'Не удалось распознать подходы. Укажи, например, «Подтягивания 3x8» или «Отжимания 4 подхода по 12».');
        return true;
    }

    const payload = {
        ...state.state_payload,
        performance: parsed,
        completionRate: parsed.completionRate,
        step: 'rpe',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        REPORT_STATE_KEY,
        payload,
        stateExpiry()
    );

    await promptForRpe(ctx, parsed.summary);
    return true;
}

/**
 * Обработчик выбора RPE
 */
export async function rpeCallback(ctx) {
    await ctx.answerCbQuery();

    const state = await db.getDialogState(ctx.state.profileId, REPORT_STATE_KEY);
    if (!state?.state_payload || state.state_payload.step !== 'rpe') {
        return;
    }

    const rpeMap = {
        'rpe_2': 2,
        'rpe_5': 5,
        'rpe_7': 7.5,
        'rpe_9': 9,
    };

    const rpe = rpeMap[ctx.callbackQuery.data];

    const newPayload = {
        ...state.state_payload,
        rpe,
        step: 'completion',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        REPORT_STATE_KEY,
        newPayload,
        stateExpiry()
    );

    await ctx.deleteMessage().catch(() => {});
    await beginChatResponse(ctx);

    const estimatedCompletion = newPayload.completionRate ?? newPayload.performance?.completionRate;
    const suggestion = estimatedCompletion != null
        ? `По записям вижу выполнение примерно на ${estimatedCompletion}%.\n`
        : '';

    const message =
        `📝 **Отчёт о тренировке**\n\n` +
        `✅ RPE: ${rpe}/10\n\n` +
        `${suggestion}` +
        `**Шаг 3/3: Подтверди выполнение плана**`;

    const keyboard = withMainMenuButton([
        [Markup.button.callback('✅ Да, полностью', 'completion_full')],
        [Markup.button.callback('🔸 Частично', 'completion_partial')],
        [Markup.button.callback('❌ Не получилось', 'completion_none')],
    ]);

    await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

/**
 * Обработчик степени выполнения
 */
export async function completionCallback(ctx) {
    await ctx.answerCbQuery();

    const completionMap = {
        'completion_full': COMPLETION_LABELS.full,
        'completion_partial': COMPLETION_LABELS.partial,
        'completion_none': COMPLETION_LABELS.none,
    };

    const selection = completionMap[ctx.callbackQuery.data];
    if (!selection) {
        await ctx.answerCbQuery('Не удалось определить выбор');
        return;
    }

    const currentState = await db.getDialogState(ctx.state.profileId, REPORT_STATE_KEY);
    if (!currentState?.state_payload) {
        return;
    }

    const newPayload = {
        ...currentState.state_payload,
        completionRate: selection.rate,
        completionLabel: selection.label,
        step: 'notes',
    };

    await db.saveDialogState(
        ctx.state.profileId,
        REPORT_STATE_KEY,
        newPayload,
        stateExpiry()
    );

    await ctx.deleteMessage().catch(() => {});
    await beginChatResponse(ctx);

    const message =
        `📝 **Отчёт о тренировке**\n\n` +
        `✅ Выполнение: ${selection.label}\n\n` +
        `**Финальный шаг:** есть ли заметки по самочувствию или технике?\n` +
        `Напиши текстом или нажми «Пропустить».`;

    const keyboard = withMainMenuButton([
        [Markup.button.callback('⏭️ Пропустить', 'notes_skip')],
    ]);

    await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

export async function notesSkipCallback(ctx) {
    await ctx.answerCbQuery();
    await finalizeReport(ctx, null);
}

export async function notesTextHandler(ctx) {
    const state = await db.getDialogState(ctx.state.profileId, REPORT_STATE_KEY);

    if (!state || state.state_payload.step !== 'notes') {
        return false;
    }

    const notes = ctx.message.text;
    await finalizeReport(ctx, notes);
    return true;
}

async function finalizeReport(ctx, notes) {
    const state = await db.getDialogState(ctx.state.profileId, REPORT_STATE_KEY);
    if (!state?.state_payload) {
        await replyWithTracking(ctx, 'Похоже, отчёт уже завершён или истёк срок ожидания.');
        return;
    }

    const { sessionId, rpe, completionRate, performance } = state.state_payload;

    try {
        const session = await db.getTrainingSession(sessionId);

        if (!session) {
            await replyWithTracking(ctx, 'Тренировка не найдена. Попробуй снова через /report.');
            return;
        }

        const completionValue = typeof completionRate === 'number'
            ? completionRate
            : performance?.completionRate ?? COMPLETION_LABELS.partial.rate;

        const updatedExercises = mergePerformanceIntoSession(performance, session);

        const updatedSession = await db.updateTrainingSession(sessionId, {
            status: completionValue > 50 ? 'done' : 'skipped',
            rpe,
            notes: notes || '',
            exercises: updatedExercises,
            updated_at: new Date().toISOString(),
        });

        await db.clearDialogState(ctx.state.profileId, REPORT_STATE_KEY);

        const refreshedSession = await db.getTrainingSession(sessionId);

        if (performance?.entries?.length) {
            await persistProgressionDecisions(ctx.state.profileId, refreshedSession, performance, rpe, notes);
        }

        const feedbackMessage = buildFeedbackMessage(refreshedSession, performance, rpe, completionValue, notes);

        await beginChatResponse(ctx);
        const placeholder = `${feedbackMessage}\n\n⏳ Готовлю рекомендации...`;
        const summaryMessage = await replyWithTracking(ctx, placeholder, { parse_mode: 'Markdown' });

        setTimeout(async () => {
            try {
                const analysis = await plannerService.analyzeTrainingReport({
                    session: refreshedSession,
                    exercises: refreshedSession.exercises || [],
                    rpe,
                    notes,
                    history: await db.getTrainingSessions(ctx.state.profileId, {
                        endDate: refreshedSession.date,
                    }),
                });

                const analysisText = analysis?.feedback
                    ? `${feedbackMessage}\n\n💭 **Мой анализ:**\n\n${analysis.feedback}`
                    : feedbackMessage;

                try {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        summaryMessage.message_id,
                        undefined,
                        analysisText,
                        { parse_mode: 'Markdown' }
                    );
                } catch (editError) {
                    console.error('Failed to edit summary message:', editError);
                    await replyWithTracking(ctx, analysisText, { parse_mode: 'Markdown' });
                }
            } catch (error) {
                console.error('Error getting AI analysis:', error);
                try {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        summaryMessage.message_id,
                        undefined,
                        `${feedbackMessage}\n\n⚠️ Не удалось получить рекомендации — повторю анализ позже.`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (editError) {
                    console.error('Failed to update summary after analysis error:', editError);
                }
            }
        }, 1000);

        await db.recordMetric(
            ctx.state.profileId,
            'training_completed',
            1,
            'count'
        );

        await db.logEvent(
            ctx.state.profileId,
            'training_report_submitted',
            'info',
            {
                session_id: sessionId,
                rpe,
                completion_rate: completionValue,
            }
        );

        await db.logDialogEvent(
            ctx.state.profileId,
            'report_submitted',
            {
                session_id: sessionId,
                rpe,
                completion_rate: completionValue,
                exercises: performance?.entries || [],
            }
        );

    } catch (error) {
        console.error('Error finalizing report:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось сохранить отчёт. Попробуй позже.');
    }
}

function stateExpiry() {
    return new Date(Date.now() + REPORT_STATE_TTL_MS);
}

async function promptForRpe(ctx, summary) {
    await ctx.deleteMessage().catch(() => {});
    await beginChatResponse(ctx);

    const message =
        `${summary ? `${summary}\n\n` : ''}` +
        `**Шаг 2/3: Оцени нагрузку (RPE)**\n` +
        `1-3 — Очень легко\n` +
        `4-6 — Умеренно\n` +
        `7-8 — Тяжело\n` +
        `9-10 — Предельно`;

    const keyboard = withMainMenuButton([
        [
            Markup.button.callback('1-3 😌', 'rpe_2'),
            Markup.button.callback('4-6 😊', 'rpe_5'),
            Markup.button.callback('7-8 💪', 'rpe_7'),
            Markup.button.callback('9-10 🔥', 'rpe_9'),
        ],
    ]);

    await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...keyboard });
}

function parsePerformanceInput(text, session) {
    const lines = text
        .split(/\n|;/)
        .map(line => line.trim())
        .filter(Boolean);

    const planExercises = Array.isArray(session?.exercises) ? session.exercises : [];
    const entries = [];
    const unmatchedLines = [];

    for (const line of lines) {
        const numbers = extractSetsReps(line);
        if (!numbers) {
            unmatchedLines.push(line);
            continue;
        }

        const targetKey = resolveExerciseKey(line, planExercises);
        entries.push({
            exercise_key: targetKey,
            sets: numbers.sets,
            reps: numbers.reps,
            raw: line,
        });
    }

    const enriched = enrichEntriesWithPlan(entries, planExercises);
    const completionRate = calculateCompletionRate(enriched, planExercises);

    const summaryLines = enriched
        .filter(entry => entry.exercise_key)
        .map(entry => {
            const name = entry.name || entry.exercise_key;
            const target = entry.targetSets && entry.targetReps
                ? `${entry.targetSets}×${entry.targetReps}`
                : 'свободный формат';
            return `• ${name}: ${entry.sets}×${entry.reps} (план ${target})`;
        });

    if (unmatchedLines.length > 0) {
        summaryLines.push(`⚠️ Не распознал: ${unmatchedLines.join('; ')}`);
    }

    const summary = summaryLines.length
        ? `Зафиксировал:\n${summaryLines.join('\n')}\n\nОценка выполнения ≈ ${completionRate}%`
        : 'Данные о подходах сохранены.';

    return {
        entries: enriched,
        unmatched: unmatchedLines,
        completionRate,
        summary,
    };
}

function extractSetsReps(line) {
    const normalized = line.replace(',', '.');
    const crossMatch = /(\d+)\s*[xх×*]\s*(\d+)/i.exec(normalized);
    if (crossMatch) {
        return {
            sets: Number(crossMatch[1]),
            reps: Number(crossMatch[2]),
        };
    }

    const wordsMatch = /(\d+)\s*(?:подход\w*)\D+(\d+)/i.exec(normalized);
    if (wordsMatch) {
        return {
            sets: Number(wordsMatch[1]),
            reps: Number(wordsMatch[2]),
        };
    }

    const numbers = normalized.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
        return {
            sets: Number(numbers[0]),
            reps: Number(numbers[1]),
        };
    }

    return null;
}

function resolveExerciseKey(line, planExercises) {
    const normalized = line.toLowerCase();

    for (const exercise of planExercises) {
        if (!exercise) continue;
        const name = (exercise.name || exercise.exercise_key || '').toLowerCase();
        if (name && normalized.includes(name)) {
            return exercise.exercise_key || exercise.name || null;
        }

        const synonyms = EXERCISE_SYNONYMS[exercise.exercise_key] || [];
        if (synonyms.some(syn => normalized.includes(syn))) {
            return exercise.exercise_key;
        }
    }

    for (const [key, synonyms] of Object.entries(EXERCISE_SYNONYMS)) {
        if (synonyms.some(syn => normalized.includes(syn))) {
            return key;
        }
    }

    return null;
}

function enrichEntriesWithPlan(entries, planExercises) {
    return entries.map(entry => {
        if (!entry.exercise_key) {
            return entry;
        }

        const plan = planExercises.find(ex => ex.exercise_key === entry.exercise_key);

        if (!plan) {
            return entry;
        }

        const targetSets = plan.target?.sets ?? plan.sets ?? null;
        const targetReps = plan.target?.reps ?? plan.reps ?? null;
        const targetVolume = targetSets && targetReps ? targetSets * targetReps : null;
        const actualVolume = entry.sets * entry.reps;

        const completionRatio = targetVolume
            ? Math.min(actualVolume / targetVolume, 1.3)
            : (actualVolume > 0 ? 1 : 0);

        return {
            ...entry,
            name: plan.name || plan.exercise_key,
            targetSets,
            targetReps,
            completionRatio,
            planLevel: plan.level || plan.target?.level || null,
        };
    });
}

function calculateCompletionRate(entries, planExercises) {
    const matched = entries.filter(entry => entry.exercise_key && typeof entry.completionRatio === 'number');

    if (matched.length) {
        const sum = matched.reduce((acc, entry) => acc + entry.completionRatio, 0);
        return Math.round((sum / matched.length) * 100);
    }

    if (planExercises.length === 0) {
        return 100;
    }

    return 70;
}

function mergePerformanceIntoSession(performance, session) {
    if (!performance?.entries?.length || !Array.isArray(session.exercises)) {
        return session.exercises || [];
    }

    const performanceMap = new Map(
        performance.entries
            .filter(entry => entry.exercise_key)
            .map(entry => [entry.exercise_key, entry])
    );

    return session.exercises.map(exercise => {
        const entry = performanceMap.get(exercise.exercise_key);
        if (!entry) {
            return exercise;
        }

        const ratio = entry.completionRatio ?? (entry.sets && entry.reps ? 1 : 0);
        let state = exercise.state;
        if (ratio >= 1) {
            state = 'done';
        } else if (ratio >= 0.5) {
            state = 'in_progress';
        } else {
            state = 'skipped';
        }

        return {
            ...exercise,
            actual: {
                sets: entry.sets,
                reps: entry.reps,
            },
            state,
        };
    });
}

async function persistProgressionDecisions(profileId, session, performance, rpe, notes) {
    if (!Array.isArray(session?.exercises) || !performance?.entries?.length) {
        return;
    }

    for (const entry of performance.entries) {
        if (!entry.exercise_key) {
            continue;
        }

        const planExercise = session.exercises.find(ex => ex.exercise_key === entry.exercise_key);
        if (!planExercise) {
            continue;
        }

        const targetSets = planExercise.target?.sets ?? planExercise.sets ?? 0;
        const targetReps = planExercise.target?.reps ?? planExercise.reps ?? 0;

        const analysis = await progressionService.analyzeExercise({
            exerciseKey: entry.exercise_key,
            targetSets,
            targetReps,
            actualSets: entry.sets,
            actualReps: entry.reps,
            rpe,
            notes,
        });

        const currentLevel = planExercise.level || planExercise.target?.level || null;
        const nextLevel = currentLevel
            ? progressionService.calculateNextLevel(currentLevel, analysis.decision)
            : currentLevel;

        await progressionService.saveProgressionDecision(
            session.id,
            entry.exercise_key,
            analysis,
            currentLevel,
            nextLevel
        );

        await db.logEvent(
            profileId,
            'exercise_progress_updated',
            'info',
            {
                session_id: session.id,
                exercise_key: entry.exercise_key,
                decision: analysis.decision,
                next_level: nextLevel,
            }
        );
    }
}

function buildFeedbackMessage(session, performance, rpe, completionRate, notes) {
    const dateHuman = format(new Date(session.date), 'd MMMM', { locale: ru });
    let message =
        `✅ **Отчёт принят!**\n\n` +
        `Дата: ${dateHuman}\n` +
        `RPE: ${rpe}/10\n` +
        `Выполнение: ${completionRate}%\n`;

    if (performance?.entries?.length) {
        const lines = performance.entries
            .filter(entry => entry.exercise_key)
            .map(entry => {
                const name = entry.name || entry.exercise_key;
                return `• ${name}: ${entry.sets}×${entry.reps}`;
            });

        if (lines.length) {
            message += `\nФакт выполнения:\n${lines.join('\n')}\n`;
        }
    }

    if (notes) {
        message += `\nТвои заметки: ${notes}\n`;
    }

    return message;
}

export default {
    reportCommand,
    reportSessionCallback,
    performanceSkipCallback,
    handlePerformanceText,
    rpeCallback,
    completionCallback,
    notesSkipCallback,
    notesTextHandler,
};
