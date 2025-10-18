# Data Source Inventory

This document summarizes the upstream data assets that feed the analytics platform.

## Workouts Table (`workouts`)
- **System**: Core training app transactional database
- **Storage**: PostgreSQL (`public.workouts`)
- **Primary Keys**: `workout_id`
- **Schema**:
  | Column | Type | Description |
  | --- | --- | --- |
  | `workout_id` | UUID | Unique identifier for the workout session |
  | `athlete_id` | UUID | Reference to the athlete completing the workout |
  | `program_id` | UUID | Linked training program |
  | `workout_date` | TIMESTAMP | Scheduled start time of the workout |
  | `duration_minutes` | NUMERIC | Total workout duration |
  | `rpe` | INTEGER | Session rate of perceived exertion (1-10) |
  | `completed` | BOOLEAN | Flag indicating workout completion |
  | `created_at` | TIMESTAMP | Record creation timestamp |
  | `updated_at` | TIMESTAMP | Record update timestamp |
- **Refresh Cadence**: CDC stream captured every 15 minutes into raw lake (`raw.workouts`) with nightly full snapshot.

## Wearable & Health Integrations (`wearables_daily`)
- **System**: Integration hub ingesting data from Apple Health, Garmin, WHOOP
- **Storage**: S3 data lake partitioned by `ingest_date`
- **Primary Keys**: Composite of `athlete_id`, `source_system`, `sample_date`
- **Schema**:
  | Column | Type | Description |
  | --- | --- | --- |
  | `athlete_id` | UUID | Athlete identifier |
  | `source_system` | TEXT | Wearable vendor name |
  | `sample_date` | DATE | Date of the summary measurement |
  | `hrv` | NUMERIC | Heart rate variability (ms) |
  | `resting_hr` | NUMERIC | Resting heart rate |
  | `sleep_score` | NUMERIC | Sleep quality (0-100) |
  | `step_count` | INTEGER | Total steps |
  | `calories_burned` | NUMERIC | Active calories |
  | `ingested_at` | TIMESTAMP | Timestamp of ingestion |
- **Refresh Cadence**: Incremental ingestion hourly per source with late-arriving data allowed up to 48 hours.

## Athlete Feedback Forms (`feedback_forms`)
- **System**: Web-based survey captured post-session
- **Storage**: PostgreSQL (`feedback.feedback_forms`)
- **Primary Keys**: `feedback_id`
- **Schema**:
  | Column | Type | Description |
  | --- | --- | --- |
  | `feedback_id` | UUID | Unique feedback submission |
  | `athlete_id` | UUID | Athlete submitting feedback |
  | `workout_id` | UUID | Workout referenced |
  | `submitted_at` | TIMESTAMP | Submission timestamp |
  | `mood` | TEXT | Self-reported mood |
  | `energy_level` | INTEGER | Energy level 1-5 |
  | `soreness` | INTEGER | Muscle soreness 1-5 |
  | `comments` | TEXT | Free-form responses |
- **Refresh Cadence**: Near-real-time replication via Kafka; ingestion job polls every 10 minutes.

## Metadata & Reference Tables
- `athletes` (PostgreSQL, hourly snapshot)
- `programs` (PostgreSQL, nightly snapshot)
- `calendar_dim` (static calendar dimension maintained quarterly)

## Data Quality & Monitoring
- CDC streams monitored via Datadog metrics for latency and failure counts.
- Schema changes tracked with automated dbt source freshness tests.

