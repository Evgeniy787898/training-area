-- Initial schema for training bot
-- Migration: 20240101000000_initial_schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE NOT NULL,
  goals JSONB DEFAULT '{}',
  equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferences JSONB DEFAULT '{}',
  notification_time TIME DEFAULT '06:00:00',
  timezone TEXT DEFAULT 'Europe/Moscow',
  notifications_paused BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on telegram_id
CREATE UNIQUE INDEX profiles_telegram_id_idx ON profiles(telegram_id);

-- Training sessions table
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  session_type TEXT,
  exercises JSONB DEFAULT '[]',
  rpe NUMERIC(3,1),
  notes TEXT,
  status TEXT DEFAULT 'planned',
  trace_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX training_sessions_profile_id_date_idx ON training_sessions(profile_id, date);
CREATE INDEX training_sessions_date_idx ON training_sessions(date);
CREATE INDEX training_sessions_status_idx ON training_sessions(status);

-- Exercise progress table
CREATE TABLE IF NOT EXISTS exercise_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,
  level_target TEXT,
  level_result TEXT,
  volume_target INTEGER,
  volume_actual INTEGER,
  rpe NUMERIC(3,1),
  notes TEXT,
  decision TEXT,
  streak_success INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX exercise_progress_session_id_idx ON exercise_progress(session_id);
CREATE INDEX exercise_progress_exercise_key_idx ON exercise_progress(exercise_key);

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  unit TEXT
);

-- Create index
CREATE INDEX metrics_profile_id_recorded_at_idx ON metrics(profile_id, recorded_at);
CREATE INDEX metrics_metric_type_idx ON metrics(metric_type);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  trigger_source TEXT
);

-- Weekly reviews table
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  summary JSONB DEFAULT '{}',
  adjustments JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  review_score INTEGER
);

-- Create index
CREATE INDEX weekly_reviews_profile_id_week_start_idx ON weekly_reviews(profile_id, week_start);

-- Plan versions table
CREATE TABLE IF NOT EXISTS plan_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  summary JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

-- Create unique constraint and index
CREATE UNIQUE INDEX plan_versions_profile_id_version_idx ON plan_versions(profile_id, version);
CREATE INDEX plan_versions_is_active_idx ON plan_versions(is_active);

-- Plan version items table
CREATE TABLE IF NOT EXISTS plan_version_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  slot_status TEXT DEFAULT 'active'
);

-- Create indexes
CREATE INDEX plan_version_items_plan_version_id_idx ON plan_version_items(plan_version_id);
CREATE INDEX plan_version_items_slot_date_idx ON plan_version_items(slot_date, slot_status);

-- Analytics reports table
CREATE TABLE IF NOT EXISTS analytics_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  default_range DATERANGE,
  query_template TEXT,
  visual_type TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics cache table
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_slug TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  image_url TEXT,
  payload JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Create unique index
CREATE UNIQUE INDEX analytics_cache_profile_report_params_idx ON analytics_cache(profile_id, report_slug, params_hash);

-- Observability events table
CREATE TABLE IF NOT EXISTS observability_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  trace_id UUID,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  handled BOOLEAN DEFAULT FALSE
);

-- Create index
CREATE INDEX observability_events_profile_id_recorded_at_idx ON observability_events(profile_id, recorded_at);
CREATE INDEX observability_events_category_idx ON observability_events(category);
CREATE INDEX observability_events_severity_idx ON observability_events(severity);

-- Plan version audit table
CREATE TABLE IF NOT EXISTS plan_version_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  diff JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX plan_version_audit_plan_version_id_idx ON plan_version_audit(plan_version_id);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_comment TEXT
);

-- Create index
CREATE INDEX security_events_profile_id_event_type_idx ON security_events(profile_id, event_type);

-- Dialog states table
CREATE TABLE IF NOT EXISTS dialog_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  state_type TEXT NOT NULL,
  state_payload JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, state_type)
);

-- Create index
CREATE INDEX dialog_states_profile_id_state_type_idx ON dialog_states(profile_id, state_type);
CREATE INDEX dialog_states_expires_at_idx ON dialog_states(expires_at);

-- Operation log table
CREATE TABLE IF NOT EXISTS operation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload_hash TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX operation_log_profile_id_action_idx ON operation_log(profile_id, action);
CREATE INDEX operation_log_created_at_idx ON operation_log(created_at);

-- Capabilities table
CREATE TABLE IF NOT EXISTS capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capability_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  intent_patterns TEXT[],
  required_params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_sessions_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_version_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialog_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - будут расширены)
-- Service role имеет полный доступ, пользовательские политики добавим позже

-- Grant permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

