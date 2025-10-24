-- Fix indexes and constraints
-- Пропускаем ошибки если уже существуют

-- Create indexes only if they don't exist
DO $$ 
BEGIN
    -- profiles indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'profiles_telegram_id_idx') THEN
        CREATE UNIQUE INDEX profiles_telegram_id_idx ON profiles(telegram_id);
    END IF;

    -- training_sessions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'training_sessions_profile_id_date_idx') THEN
        CREATE INDEX training_sessions_profile_id_date_idx ON training_sessions(profile_id, date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'training_sessions_date_idx') THEN
        CREATE INDEX training_sessions_date_idx ON training_sessions(date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'training_sessions_status_idx') THEN
        CREATE INDEX training_sessions_status_idx ON training_sessions(status);
    END IF;

    -- exercise_progress indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'exercise_progress_session_id_idx') THEN
        CREATE INDEX exercise_progress_session_id_idx ON exercise_progress(session_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'exercise_progress_exercise_key_idx') THEN
        CREATE INDEX exercise_progress_exercise_key_idx ON exercise_progress(exercise_key);
    END IF;

    -- Add UNIQUE constraint to dialog_states if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'dialog_states_profile_id_state_type_key'
    ) THEN
        ALTER TABLE dialog_states ADD CONSTRAINT dialog_states_profile_id_state_type_key UNIQUE (profile_id, state_type);
    END IF;
    
END $$;

-- Verify tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
    'profiles',
    'training_sessions', 
    'exercise_progress',
    'metrics',
    'achievements',
    'weekly_reviews',
    'plan_versions',
    'plan_version_items',
    'analytics_reports',
    'analytics_cache',
    'observability_events',
    'plan_version_audit',
    'security_events',
    'dialog_states',
    'operation_log',
    'capabilities'
)
ORDER BY table_name;

