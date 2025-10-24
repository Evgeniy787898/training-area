-- Add completed_at column to training_sessions for tracking finish timestamps
ALTER TABLE training_sessions
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS training_sessions_completed_at_idx
    ON training_sessions (completed_at);
