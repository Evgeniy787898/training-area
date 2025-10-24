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

