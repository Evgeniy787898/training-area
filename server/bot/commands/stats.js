import { Markup } from 'telegraf';
import { db } from '../../infrastructure/supabase.js';
import { subDays, format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { beginChatResponse, replyWithTracking } from '../utils/chat.js';
import { getProgressionOverview } from '../../services/staticPlan.js';
import { buildMainMenuKeyboard, withMainMenuButton } from '../utils/menu.js';

const EXERCISE_LABELS = {
    pullups: 'Подтягивания',
    pushups: 'Отжимания',
    squats: 'Приседания',
    legRaises: 'Кор',
};

/**
 * Команда /stats - показать статистику и прогресс
 */
export async function statsCommand(ctx) {
    const profileId = ctx.state.profileId;

    try {
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '⏳ Собираю статистику...', buildMainMenuKeyboard());

        // Получаем данные за последние 4 недели
        const endDate = new Date();
        const startDate = subDays(endDate, 28);

        const sessions = await db.getTrainingSessions(profileId, {
            startDate: format(startDate, 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
        });

        if (!sessions || sessions.length === 0) {
            await beginChatResponse(ctx);
            await replyWithTracking(ctx, buildPrimerMessage(), { parse_mode: 'Markdown', ...buildMainMenuKeyboard() });
            return;
        }

        // Рассчитываем метрики
        const stats = calculateStats(sessions);
        const statsMessage = formatStatsMessage(stats);

        const keyboard = withMainMenuButton([
            [Markup.button.callback('📈 Подробная аналитика', 'stats_detailed')],
            [Markup.button.callback('🏆 Достижения', 'stats_achievements')],
        ]);

        await beginChatResponse(ctx);
        await replyWithTracking(ctx, statsMessage, { parse_mode: 'Markdown', ...keyboard });

        // Записываем метрику просмотра статистики
        await db.recordMetric(profileId, 'stats_viewed', 1, 'count');

    } catch (error) {
        console.error('Error in stats command:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось загрузить статистику. Попробуй позже.', buildMainMenuKeyboard());
    }
}

/**
 * Расчёт статистики
 */
function calculateStats(sessions) {
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'done').length;
    const skipped = sessions.filter(s => s.status === 'skipped').length;
    const adherence = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Рассчитываем среднее RPE
    const rpeValues = sessions
        .filter(s => s.rpe !== null && s.rpe !== undefined)
        .map(s => parseFloat(s.rpe));
    const avgRpe = rpeValues.length > 0
        ? (rpeValues.reduce((sum, val) => sum + val, 0) / rpeValues.length).toFixed(1)
        : null;

    // Находим текущую серию
    let currentStreak = 0;
    const sortedSessions = [...sessions].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const session of sortedSessions) {
        if (session.status === 'done') {
            currentStreak++;
        } else {
            break;
        }
    }

    return {
        total,
        completed,
        skipped,
        adherence,
        avgRpe,
        currentStreak,
    };
}

/**
 * Форматирование сообщения со статистикой
 */
function formatStatsMessage(stats) {
    let message = `📊 **Твоя статистика за 4 недели**\n\n`;

    // Adherence с индикатором
    const adherenceEmoji =
        stats.adherence >= 80 ? '🔥' :
            stats.adherence >= 60 ? '💪' :
                stats.adherence >= 40 ? '👍' : '📈';

    message += `**Регулярность:** ${stats.adherence}% ${adherenceEmoji}\n`;
    message += `${stats.completed} выполнено из ${stats.total} запланированных\n\n`;

    // Средняя нагрузка
    if (stats.avgRpe) {
        const rpeEmoji =
            stats.avgRpe >= 8 ? '🔥' :
                stats.avgRpe >= 6 ? '💪' : '😌';
        message += `**Средняя нагрузка:** ${stats.avgRpe}/10 ${rpeEmoji}\n\n`;
    }

    // Текущая серия
    if (stats.currentStreak > 0) {
        message += `**Текущая серия:** ${stats.currentStreak} 🔥\n`;

        if (stats.currentStreak >= 7) {
            message += `Отличная работа! Продолжай в том же духе!\n`;
        } else if (stats.currentStreak >= 3) {
            message += `Хороший темп! Держи форму!\n`;
        }
        message += '\n';
    }

    // Мотивационный блок
    if (stats.adherence >= 80) {
        message += `✨ Ты тренируешься очень последовательно! Это впечатляет.\n`;
    } else if (stats.adherence >= 60) {
        message += `👍 Хорошая регулярность! Попробуй не пропускать тренировки.\n`;
    } else if (stats.adherence >= 40) {
        message += `📈 Есть прогресс, но можно лучше. Давай держать ритм!\n`;
    } else if (stats.completed > 0) {
        message += `💪 Главное — начал! Попробуй тренироваться чаще.\n`;
    }

    // Пропуски
    if (stats.skipped > 0) {
        message += `\n⏭️ Пропущено: ${stats.skipped}\n`;
        if (stats.skipped >= 5) {
            message += `Слишком много пропусков. Давай найдём способ вписать тренировки в расписание!\n`;
        }
    }

    return message;
}

/**
 * Подробная аналитика
 */
export async function statsDetailedCallback(ctx) {
    await ctx.answerCbQuery();

    const profileId = ctx.state.profileId;

    try {
        await ctx.deleteMessage();
    } catch (error) {
        // ignore
    }

    try {
        const endDate = new Date();
        const startDate = subDays(endDate, 28);

        const [volumeTrend, rpeDistribution, adherence] = await Promise.all([
            db.getVolumeTrend(profileId, startDate),
            db.getRpeDistribution(profileId, startDate),
            db.getAdherenceSummary(profileId),
        ]);

        const message = formatDetailedAnalytics(volumeTrend, rpeDistribution, adherence);

        await beginChatResponse(ctx);
        await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...buildMainMenuKeyboard() });
    } catch (error) {
        console.error('Failed to load detailed stats:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось собрать подробную аналитику. Попробуй позже.', buildMainMenuKeyboard());
    }
}

/**
 * Достижения
 */
export async function statsAchievementsCallback(ctx) {
    await ctx.answerCbQuery();

    const profileId = ctx.state.profileId;

    try {
        try {
            await ctx.deleteMessage();
        } catch (error) {
            // Сообщение уже могло быть удалено
        }

        await beginChatResponse(ctx);

        const achievements = await db.getAchievements(profileId, { limit: 10 });

        if (achievements.length === 0) {
            await replyWithTracking(ctx,
                '🏆 **Достижения**\n\n' +
                'Пока нет достижений.\n\n' +
                'Продолжай тренироваться, и они появятся!\n\n' +
                'Возможные достижения:\n' +
                '• Первая тренировка ✅\n' +
                '• Серия 7 дней 🔥\n' +
                '• Месяц без пропусков 💎\n' +
                '• Личный рекорд 🏅',
                { parse_mode: 'Markdown', ...buildMainMenuKeyboard() }
            );
        } else {
            let message = '🏆 **Твои достижения**\n\n';
            achievements.forEach(ach => {
                const date = ach.awarded_at
                    ? format(new Date(ach.awarded_at), 'd MMMM', { locale: ru })
                    : null;
                message += `${ach.emoji || '✅'} ${ach.title}\n`;
                if (ach.description) {
                    message += `   ${ach.description}\n`;
                }
                if (date) {
                    message += `   Получено: ${date}\n`;
                }
                message += '\n';
            });
            await replyWithTracking(ctx, message, { parse_mode: 'Markdown', ...buildMainMenuKeyboard() });
        }

    } catch (error) {
        console.error('Error showing achievements:', error);
        await beginChatResponse(ctx);
        await replyWithTracking(ctx, '😔 Не удалось загрузить достижения.', buildMainMenuKeyboard());
    }
}

function buildPrimerMessage() {
    const overviewKeys = ['pullups', 'pushups', 'squats'];
    const items = overviewKeys
        .map(key => ({ key, data: getProgressionOverview(key) }))
        .filter(item => item.data);

    let message = '📊 **Пока нет данных для статистики**\n\n';
    message += 'Я веду историю, как только появится первая отметка о тренировке.\n\n';

    if (items.length > 0) {
        message += 'Базовая программа строится на прогрессиях:\n';
        message += items.map(({ key, data }) => {
            const label = EXERCISE_LABELS[key] || key;
            return `• ${label}: ${data.startLevel} → ${data.peakLevel} (${data.totalSteps} шагов)`;
        }).join('\n');
        message += '\n\n';
    }

    message += 'Отправь первый отчёт — и я покажу регулярность, RPE и серию тренировок.';
    return message;
}

function formatDetailedAnalytics(volumeTrend, rpeDistribution, adherence) {
    const chartPoints = volumeTrend.chart.slice(-5).map(point => {
        const dateLabel = format(new Date(point.date), 'd MMM', { locale: ru });
        return `• ${dateLabel}: объём ${point.volume}`;
    }).join('\n');

    const heavyShare = rpeDistribution.summary.heavy_share;
    const lightShare = rpeDistribution.summary.light_share;

    const message =
        '📈 **Подробная аналитика**\n\n' +
        'Объём за последние 4 недели:\n' +
        (chartPoints || '— данных пока недостаточно') + '\n\n' +
        `Средний объём за тренировку: ${volumeTrend.summary.average_volume}\n` +
        `Всего тренировок за период: ${volumeTrend.summary.period_sessions}\n\n` +
        'RPE по ощущениям:\n' +
        rpeDistribution.chart.map(bucket => `• ${bucket.label}: ${bucket.value}`).join('\n') + '\n\n' +
        `Тяжёлые сессии: ${heavyShare}% • Лёгкие: ${lightShare}%\n\n` +
        `Регулярность за месяц: ${adherence.adherence_percent}% (из ${adherence.total_sessions} тренировок)`;

    return message;
}

export default {
    statsCommand,
    statsDetailedCallback,
    statsAchievementsCallback,
};

