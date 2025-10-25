import { format } from 'date-fns';
import ru from 'date-fns/locale/ru/index.js';
import { buildDefaultWeekPlan } from './staticPlan.js';
import { detectIntent } from './nlu.js';
import localResponder from './localResponder.js';
import internalAssistantEngine from './internalAssistantEngine.js';

const TRAINER_PREFIXES = ['тренер', 'trainer', 'coach', 'босс', 'boss'];
const TRAINER_INTENTS = new Set([
    'plan.today',
    'plan.week',
    'plan.setup',
    'report.start',
    'stats.show',
    'settings.open',
    'schedule.reschedule',
    'recovery.mode',
    'remind.later',
    'motivation',
]);

class ConversationService {
    async generateReply({ profile, message, history = [], mode = 'chat' }) {
        if (!message) {
            return null;
        }

        const trainerTone = this.shouldUseTrainerMode({ message, mode });

        if (trainerTone) {
            const reply = await internalAssistantEngine.generateTrainerReply({ profile, message, history });
            return reply || this.buildGenericFallback(profile);
        }

        const general = await internalAssistantEngine.generateGeneralReply({ profile, message, history });
        if (general) {
            return general;
        }

        return this.buildFallbackReply({ profile, message, history, mode, trainerTone });
    }

    shouldUseTrainerMode({ message, mode }) {
        if (mode === 'command') {
            return true;
        }

        const normalized = (message || '').trim().toLowerCase();
        if (!normalized) {
            return false;
        }

        if (TRAINER_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
            return true;
        }

        const detected = detectIntent(normalized);
        return TRAINER_INTENTS.has(detected.intent);
    }

    async buildFallbackReply({ profile, message, mode, trainerTone, history } = {}) {
        if (!message) {
            return trainerTone
                ? this.buildGenericFallback(profile)
                : this.buildGeneralFallback(null, profile);
        }

        const { intent } = detectIntent(message);
        const treatAsTrainer = trainerTone || TRAINER_INTENTS.has(intent);

        if (!treatAsTrainer && mode !== 'command') {
            return localResponder.buildLocalReply({ message, profile, history })
                || this.buildGeneralFallback(message, profile);
        }

        switch (intent) {
        case 'plan.today':
        case 'plan.week':
            return this.buildPlanFallback(profile);
        case 'report.start':
            return this.buildReportFallback();
        case 'motivation':
            return internalAssistantEngine.buildMotivationMessage(profile);
        case 'help':
            return this.buildHelpFallback();
        case 'settings.open':
            return this.buildSettingsFallback();
        default:
            return this.buildGenericFallback(profile);
        }
    }

    buildPlanFallback(profile) {
        const frequency = profile?.preferences?.training_frequency || 4;
        const plan = buildDefaultWeekPlan({ frequency });
        const nextSession = plan.sessions?.[0];
        const dateLabel = nextSession?.date
            ? format(new Date(nextSession.date), 'd MMMM', { locale: ru })
            : null;
        const sessionName = nextSession?.focus || nextSession?.session_type || 'тренировка';

        const summary = nextSession
            ? `План готов — ${dateLabel ? `сессия на ${dateLabel}` : 'следующая тренировка'} «${sessionName}».`
            : 'Базовый план готов, можно заняться техникой и восстановлением.';

        const warmup = nextSession?.warmup?.length
            ? nextSession.warmup.join('; ')
            : '5 минут динамической разминки: круговые движения, лёгкие прыжки, мобилизация плеч и таза.';

        const main = nextSession?.exercises?.length
            ? nextSession.exercises
                .slice(0, 3)
                .map(exercise => {
                    const sets = exercise.sets || exercise.target?.sets;
                    const reps = exercise.reps || exercise.target?.reps;
                    const volume = sets && reps ? `${sets}×${reps}` : null;
                    return [exercise.name || exercise.exercise_key, volume, exercise.notes]
                        .filter(Boolean)
                        .join(' — ');
                })
                .join('; ')
            : '3 круга: подтягивания, отжимания, планка — фокус на контроле и дыхании.';

        const cooldown = nextSession?.cooldown?.length
            ? nextSession.cooldown.join('; ')
            : 'Дыхание 4-6-4, растяжка грудного отдела и лёгкий ролл спины.';

        return [
            `${summary} Контроль RPE: держи около 7.`,
            `**Цель:** Сохранить темп и качество повторений.`,
            `**Разминка:** ${warmup}`,
            `**Основная часть:** ${main}`,
            `**Заминка:** ${cooldown}`,
            '**Следующий шаг:** Отметь сессию в WebApp, чтобы план обновился автоматически.',
        ].join('\n');
    }

    buildReportFallback() {
        return [
            '📝 Готов принять отчёт о тренировке и обновить прогрессию.',
            '**Цель:** Зафиксировать объём, RPE и самочувствие, чтобы скорректировать план.',
            '**Разминка:** Напомни, нужна ли была адаптация перед основной частью.',
            '**Основная часть:** Перечисли упражнения с подходами и повторами, добавь ощущения.',
            '**Заминка:** Расскажи, как восстановился — были ли растяжка, дыхание, сон.',
            '**Следующий шаг:** После отчёта предложу рекомендации и обновлю план в WebApp.',
        ].join('\n');
    }

    buildGenericFallback(profile) {
        const frequency = profile?.preferences?.training_frequency
            || profile?.training_frequency
            || profile?.profile?.preferences?.training_frequency
            || 4;
        const goal = profile?.goals?.description
            || profile?.preferences?.training_goal
            || profile?.profile?.goals?.description
            || 'укрепить базовые движения';

        return [
            'Продолжаем держать курс на прогресс.',
            `Сейчас ориентируемся на цель: ${goal}.`,
            `Частота тренировок — ${frequency} раз(а) в неделю, можно корректировать при необходимости.`,
            'Если нужна помощь с планом, отчётом или восстановлением — просто сформулируй запрос.',
        ].join(' ');
    }

    buildGeneralFallback(message, profile) {
        return localResponder.buildLocalReply({ message, profile })
            || 'Я здесь, чтобы поддержать тренировки, восстановление и планирование. Подскажи, что хочешь сделать.';
    }

    buildHelpFallback() {
        return [
            '🤝 Вот чем я могу помочь прямо в чате:',
            '• Составить план на день или неделю и адаптировать его под цели.',
            '• Принять отчёт, оценить RPE и предложить следующий шаг.',
            '• Напомнить о тренировке, поделиться статистикой и мотивацией.',
            '• Открыть WebApp командой «Открой приложение».',
            'С чего начнём?',
        ].join('\n');
    }

    buildSettingsFallback() {
        return [
            '⚙️ Настройки доступны в WebApp.',
            'Там можно изменить время уведомлений, включить паузу и обновить частоту тренировок.',
            'Скажи «Открой приложение», и я отправлю кнопку для перехода.',
        ].join('\n');
    }
}

const conversationService = new ConversationService();

export default conversationService;

function formatStructuredReply(text) {
    if (!text) {
        return null;
    }

    let formatted = text.replace(/\n{3,}/g, '\n\n').trim();

    if (!formatted.includes('**Цель:**')) {
        const lines = formatted.split('\n').filter(Boolean);
        const [summary, ...rest] = lines;
        const blocks = rest.length ? rest.join('\n') : null;
        return [summary, blocks].filter(Boolean).join('\n');
    }

    return formatted;
}

export { formatStructuredReply };
