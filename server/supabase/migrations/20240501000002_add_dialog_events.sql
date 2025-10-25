-- Migration: 20240501000002_add_dialog_events.sql
-- Purpose: align database schema with dialogue analytics documented requirements

-- Ensure uuid extension exists (harmless if already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS dialog_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  ab_group TEXT,
  response_latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dialog_events_profile_id_idx
  ON dialog_events(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dialog_events_event_type_idx
  ON dialog_events(event_type, created_at DESC);
