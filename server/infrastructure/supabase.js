import { createClient } from '@supabase/supabase-js';
import { addDays, format, startOfWeek } from 'date-fns';
import config from '../config/env.js';
import { buildDefaultWeekPlan } from '../services/staticPlan.js';

const PLAN_CACHE_STATE = 'ui_cached_plan';

// Create Supabase client with service role key for backend operations
export const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// Helper functions for common database operations
export const db = {
    // Profile operations
    async getProfileByTelegramId(telegramId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('telegram_id', telegramId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile:', error);
            throw error;
        }

        return data;
    },

    async getProfileById(profileId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile by id:', error);
            throw error;
        }

        return data;
    },

    async createProfile(telegramId, userData = {}) {
        const { data, error } = await supabase
            .from('profiles')
            .insert({
                telegram_id: telegramId,
                goals: userData.goals || {},
                equipment: userData.equipment || [],
                preferences: userData.preferences || {},
                notification_time: userData.notification_time || '06:00:00',
                timezone: userData.timezone || 'Europe/Moscow',
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating profile:', error);
            throw error;
        }

        return data;
    },

    async updateProfile(profileId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', profileId)
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            throw error;
        }

        return data;
    },

    // Training session operations
    async createTrainingSession(sessionData) {
        const { data, error } = await supabase
            .from('training_sessions')
            .insert(sessionData)
            .select()
            .single();

        if (error) {
            console.error('Error creating training session:', error);
            throw error;
        }

        return data;
    },

    async getTrainingSession(sessionId) {
        const { data, error } = await supabase
            .from('training_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error) {
            console.error('Error fetching training session:', error);
            throw error;
        }

        return data;
    },

    async getTrainingSessions(profileId, filters = {}) {
        let query = supabase
            .from('training_sessions')
            .select('*')
            .eq('profile_id', profileId);

        if (filters.startDate) {
            query = query.gte('date', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('date', filters.endDate);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        query = query.order('date', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching training sessions:', error);
            throw error;
        }

        return data;
    },

    async getLatestSessionSummary(profileId) {
        const { data, error } = await supabase
            .from('training_sessions')
            .select('id, date, status, session_type, rpe, completed_at')
            .eq('profile_id', profileId)
            .order('date', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching latest session summary:', error);
            throw error;
        }

        return Array.isArray(data) && data.length ? data[0] : null;
    },

    async getRecentCompletionStats(profileId, { days = 7 } = {}) {
        const { data, error } = await supabase
            .from('training_sessions')
            .select('status, rpe, date')
            .eq('profile_id', profileId)
            .gte('date', format(addDays(new Date(), -days), 'yyyy-MM-dd'));

        if (error) {
            console.error('Error fetching completion stats:', error);
            throw error;
        }

        const summary = {
            total: 0,
            completed: 0,
            skipped: 0,
            lastStatus: null,
            lastRpe: null,
            streak: 0,
        };

        if (!Array.isArray(data) || data.length === 0) {
            return summary;
        }

        const sorted = data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        summary.total = sorted.length;

        let currentStreak = 0;
        for (const entry of sorted) {
            if (entry.status === 'done' || entry.status === 'completed') {
                summary.completed += 1;
                currentStreak += 1;
                summary.lastRpe = entry.rpe ?? summary.lastRpe;
                summary.lastStatus = entry.status;
            } else if (entry.status === 'skipped' || entry.status === 'missed') {
                summary.skipped += 1;
                currentStreak = 0;
                summary.lastStatus = entry.status;
            }
        }

        summary.streak = currentStreak;
        return summary;
    },

    async getAiTemplates(category, { tag, limit = 10 } = {}) {
        let query = supabase
            .from('ai_templates')
            .select('*')
            .eq('category', category)
            .order('created_at', { ascending: false });

        if (tag) {
            query = query.eq('tag', tag);
        }

        if (Number.isFinite(limit)) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching AI templates:', error);
            throw error;
        }

        return Array.isArray(data) ? data : [];
    },

    async triggerPlanUpdate(profileId, {
        reason = 'manual',
        referenceDate = new Date(),
        forceFallback = false,
    } = {}) {
        try {
            const body = {
                profileId,
                reason,
                referenceDate: format(referenceDate, 'yyyy-MM-dd'),
                forceFallback,
            };

            const { data, error } = await supabase.functions.invoke('update_plan', { body });

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Failed to trigger plan update:', error);
            throw error;
        }
    },

    async updateTrainingSession(sessionId, updates) {
        const { data, error } = await supabase
            .from('training_sessions')
            .update(updates)
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('Error updating training session:', error);
            throw error;
        }

        return data;
    },

    async getOrCreateFallbackWeekPlan(profile, profileId, referenceDate) {
        const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');

        try {
            const cached = await this.getDialogState(profileId, PLAN_CACHE_STATE);
            if (cached?.state_payload?.plan?.metadata?.week_start === weekStartStr) {
                return cached.state_payload.plan;
            }
        } catch (error) {
            console.error('Failed to load cached week plan:', error);
        }

        const frequency = profile?.preferences?.training_frequency || 4;
        const plan = buildDefaultWeekPlan({ startDate: weekStart, frequency });

        try {
            await this.saveDialogState(
                profileId,
                PLAN_CACHE_STATE,
                {
                    plan,
                    generated_at: new Date().toISOString(),
                },
                addDays(weekEnd, 1)
            );
        } catch (error) {
            console.error('Failed to cache fallback plan:', error);
        }

        return plan;
    },

    // Exercise progress operations
    async createExerciseProgress(progressData) {
        const { data, error } = await supabase
            .from('exercise_progress')
            .insert(progressData)
            .select()
            .single();

        if (error) {
            console.error('Error creating exercise progress:', error);
            throw error;
        }

        return data;
    },

    async getExerciseProgressHistory(profileId, exerciseKey, limit = 10) {
        const { data, error } = await supabase
            .from('exercise_progress')
            .select(`
        *,
        training_sessions!inner(profile_id, date)
      `)
            .eq('training_sessions.profile_id', profileId)
            .eq('exercise_key', exerciseKey)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching exercise progress history:', error);
            throw error;
        }

        return data;
    },

    async getExerciseProgressOverview(profileId, { limit = 50 } = {}) {
        const { data, error } = await supabase
            .from('exercise_progress')
            .select(`
        id,
        exercise_key,
        level_result,
        level_target,
        decision,
        created_at,
        training_sessions!inner(profile_id, date)
      `)
            .eq('training_sessions.profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching exercise progress overview:', error);
            throw error;
        }

        const latestByExercise = new Map();

        for (const item of data || []) {
            if (!latestByExercise.has(item.exercise_key)) {
                latestByExercise.set(item.exercise_key, item);
            }
        }

        return Array.from(latestByExercise.values());
    },

    // Metrics operations
    async recordMetric(profileId, metricType, value, unit, source = 'bot') {
        const { data, error } = await supabase
            .from('metrics')
            .insert({
                profile_id: profileId,
                metric_type: metricType,
                value,
                unit,
                source,
            })
            .select()
            .single();

        if (error) {
            console.error('Error recording metric:', error);
            throw error;
        }

        return data;
    },

    async getLatestMetrics(profileId) {
        const { data, error } = await supabase
            .from('metrics')
            .select('*')
            .eq('profile_id', profileId)
            .order('recorded_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching latest metrics:', error);
            throw error;
        }

        return data;
    },

    // Operation log
    async logOperation(profileId, action, status, payloadHash = null, errorCode = null) {
        const { data, error } = await supabase
            .from('operation_log')
            .insert({
                profile_id: profileId,
                action,
                status,
                payload_hash: payloadHash,
                error_code: errorCode,
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging operation:', error);
            // Don't throw error for logging failures
            return null;
        }

        return data;
    },

    // Observability events
    async logEvent(profileId, category, severity, payload, traceId = null) {
        const { data, error } = await supabase
            .from('observability_events')
            .insert({
                profile_id: profileId,
                category,
                severity,
                payload,
                trace_id: traceId,
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging event:', error);
            return null;
        }

        return data;
    },

    async logDialogEvent(profileId, eventType, payload = {}, {
        abGroup = null,
        responseLatencyMs = null,
    } = {}) {
        try {
            const { data, error } = await supabase
                .from('dialog_events')
                .insert({
                    profile_id: profileId,
                    event_type: eventType,
                    payload,
                    ab_group: abGroup,
                    response_latency_ms: responseLatencyMs,
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            // Table may be missing if migrations aren't applied yet
            if (error?.code !== '42P01') {
                console.error('Error logging dialog event:', error);
            }
            return null;
        }
    },

    // Dialog states
    async saveDialogState(profileId, stateType, statePayload, expiresAt = null) {
        const { data, error } = await supabase
            .from('dialog_states')
            .upsert({
                profile_id: profileId,
                state_type: stateType,
                state_payload: statePayload,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'profile_id,state_type',
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving dialog state:', error);
            throw error;
        }

        return data;
    },

    async getDialogState(profileId, stateType) {
        const { data, error } = await supabase
            .from('dialog_states')
            .select('*')
            .eq('profile_id', profileId)
            .eq('state_type', stateType)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching dialog state:', error);
            throw error;
        }

        return data;
    },

    async clearDialogState(profileId, stateType) {
        const { error } = await supabase
            .from('dialog_states')
            .delete()
            .eq('profile_id', profileId)
            .eq('state_type', stateType);

        if (error) {
            console.error('Error clearing dialog state:', error);
            throw error;
        }
    },

    async mergeDialogState(profileId, stateType, updater) {
        try {
            const existing = await this.getDialogState(profileId, stateType);
            const currentPayload = existing?.state_payload ?? {};
            const nextPayload = typeof updater === 'function'
                ? updater(currentPayload) ?? currentPayload
                : { ...currentPayload, ...(updater || {}) };

            return this.saveDialogState(
                profileId,
                stateType,
                nextPayload,
                existing?.expires_at || null
            );
        } catch (error) {
            console.error('Failed to merge dialog state:', error);
            throw error;
        }
    },

    async saveAssistantNote(profileId, {
        title = null,
        content,
        tags = [],
        source = 'chat',
        metadata = {},
    }) {
        if (!content || !content.trim()) {
            throw new Error('Note content is required');
        }

        const { data, error } = await supabase
            .from('assistant_notes')
            .insert({
                profile_id: profileId,
                title,
                content: content.trim(),
                tags,
                source,
                metadata,
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving assistant note:', error);
            throw error;
        }

        return data;
    },

    async getAssistantNotes(profileId, { limit = 20 } = {}) {
        const { data, error } = await supabase
            .from('assistant_notes')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching assistant notes:', error);
            throw error;
        }

        return Array.isArray(data) ? data : [];
    },

    async getRecentAssistantNotes(profileId, { limit = 5 } = {}) {
        return this.getAssistantNotes(profileId, { limit });
    },

    async findInactiveAssistantChats({
        thresholdMinutes = 60,
        limit = 20,
    } = {}) {
        const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

        const query = supabase
            .from('dialog_states')
            .select('profile_id, state_payload, updated_at, expires_at')
            .eq('state_type', 'ai_chat_history')
            .lte('updated_at', cutoff)
            .order('updated_at', { ascending: true })
            .limit(limit);

        query.or('state_payload->>session_status.eq.active,state_payload->>session_status.is.null');

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching inactive chats:', error);
            throw error;
        }

        return Array.isArray(data) ? data : [];
    },

    async markAssistantSessionClosed(profileId, {
        reason = 'inactivity',
        closedAt = new Date().toISOString(),
        summary = null,
    } = {}) {
        return this.mergeDialogState(profileId, 'ai_chat_history', (payload) => ({
            ...payload,
            session_status: 'closed',
            closed_at: closedAt,
            closed_reason: reason,
            last_session_summary: summary || payload?.last_session_summary || null,
            messages: [],
        }));
    },

    async getAchievements(profileId, { limit = 5 } = {}) {
        const { data, error } = await supabase
            .from('achievements')
            .select('*')
            .eq('profile_id', profileId)
            .order('awarded_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching achievements:', error);
            throw error;
        }

        return data;
    },

    async getAdherenceSummary(profileId) {
        const { data, error } = await supabase
            .from('training_sessions')
            .select('status')
            .eq('profile_id', profileId)
            .gte('date', format(addDays(new Date(), -30), 'yyyy-MM-dd'));

        if (error) {
            console.error('Error calculating adherence:', error);
            throw error;
        }

        const total = data.length;
        const completed = data.filter(item => item.status === 'done').length;
        const adherence = total === 0 ? 0 : Math.round((completed / total) * 100);

        return {
            window: '30d',
            total_sessions: total,
            completed_sessions: completed,
            adherence_percent: adherence,
        };
    },

    async calculateProgressionDecision(profileId, session) {
        const history = await this.getTrainingSessions(profileId, {
            endDate: session.date,
        });

        const recent = history.slice(0, 6);
        const completionRates = recent.map(item => (item.status === 'done' ? 1 : 0));
        const completionRatio = completionRates.length
            ? completionRates.reduce((acc, value) => acc + value, 0) / completionRates.length
            : 0;

        let decision = 'hold';
        let nextSteps = 'Держим текущую прогрессию. Продолжай в том же духе!';

        if (session.rpe && session.rpe <= 5 && completionRatio > 0.8) {
            decision = 'advance';
            nextSteps = 'Можно усложнить следующую тренировку: добавим подход или усложним уровень.';
        } else if (session.rpe && session.rpe >= 9) {
            decision = 'regress';
            nextSteps = 'Тренировка далась тяжело. На следующий раз упрощаем вариант или уменьшаем объём.';
        } else if (completionRatio < 0.5) {
            decision = 'adjust_focus';
            nextSteps = 'Часто пропуски — скорректируем расписание и нагрузку, чтобы упростить вход.';
        }

        return { decision, next_steps: nextSteps };
    },

    async getVolumeTrend(profileId, startDate) {
        const { data, error } = await supabase
            .from('training_sessions')
            .select('*')
            .eq('profile_id', profileId)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching volume trend:', error);
            throw error;
        }

        const chart = data.map(session => {
            const exercises = Array.isArray(session.exercises) ? session.exercises : [];
            const volume = exercises.reduce((total, exercise) => {
                const sets = exercise.actual?.sets ?? exercise.target?.sets ?? 0;
                const reps = exercise.actual?.reps ?? exercise.target?.reps ?? 0;
                return total + sets * reps;
            }, 0);

            return {
                date: session.date,
                volume,
                status: session.status,
            };
        });

        const totalVolume = chart.reduce((acc, point) => acc + point.volume, 0);
        const averageVolume = chart.length ? Math.round(totalVolume / chart.length) : 0;

        return {
            chart,
            summary: {
                total_volume: totalVolume,
                average_volume: averageVolume,
                period_sessions: chart.length,
            },
        };
    },

    async getRpeDistribution(profileId, startDate) {
        const { data, error } = await supabase
            .from('training_sessions')
            .select('rpe, status, date')
            .eq('profile_id', profileId)
            .gte('date', format(startDate, 'yyyy-MM-dd'));

        if (error) {
            console.error('Error fetching RPE distribution:', error);
            throw error;
        }

        const buckets = [
            { label: 'Лёгкие (1-4)', min: 0, max: 4 },
            { label: 'Средние (5-7)', min: 4, max: 7 },
            { label: 'Тяжёлые (8-9)', min: 7, max: 9 },
            { label: 'Предельные (9-10)', min: 9, max: 11 },
        ].map(bucket => ({ ...bucket, count: 0 }));

        data.forEach(item => {
            const rpeValue = typeof item.rpe === 'number' ? item.rpe : Number(item.rpe);

            if (!rpeValue || Number.isNaN(rpeValue)) {
                return;
            }

            const bucket = buckets.find(b => rpeValue > b.min && rpeValue <= b.max);
            if (bucket) {
                bucket.count += 1;
            }
        });

        const total = buckets.reduce((acc, bucket) => acc + bucket.count, 0);

        return {
            chart: buckets.map(bucket => ({ label: bucket.label, value: bucket.count })),
            summary: {
                total_sessions: total,
                heavy_share: total ? Math.round((buckets[2].count / total) * 100) : 0,
                light_share: total ? Math.round((buckets[0].count / total) * 100) : 0,
            },
        };
    },
};

export default supabase;
