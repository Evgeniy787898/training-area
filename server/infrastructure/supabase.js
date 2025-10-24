import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';

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
};

export default supabase;

