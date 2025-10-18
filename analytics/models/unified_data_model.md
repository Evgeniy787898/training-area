# Unified Analytics Data Model

This document outlines the dimensional model and transformation logic for harmonizing workout activity, health telemetry, and feedback signals.

## Dimensional Model Overview

- **`dim_athlete_health`**
  - Grain: One record per athlete per `sample_date`
  - Sources: `raw.wearables_daily`, `raw.athletes`
  - Selected Attributes: `athlete_id`, `sample_date`, `primary_source`, `resting_hr`, `hrv`, `sleep_score`, `step_count`, `calories_burned`, `recovery_status`
  - Derivations:
    - `primary_source`: Prioritized wearable source based on data completeness.
    - `recovery_status`: Derived categorical label using HRV z-score vs. trailing 14-day baseline.

- **`fact_workout_sessions`**
  - Grain: One record per completed workout session (`workout_id`)
  - Sources: `raw.workouts`, `raw.programs`, `dim_athlete_health`
  - Measures: `duration_minutes`, `rpe`, `training_load` (duration \* rpe), `energy_level`, `soreness`
  - Dimensions: `athlete_id`, `program_id`, `workout_date`, `calendar_key`, `health_snapshot_key`
  - Derived Fields:
    - `health_snapshot_key` referencing `dim_athlete_health` for same-day `sample_date`
    - `is_late_completion` comparing scheduled vs actual completion time

- **`fact_feedback`**
  - Grain: One record per feedback submission (`feedback_id`)
  - Sources: `raw.feedback_forms`
  - Measures: `mood_score`, `energy_level`, `soreness`
  - Dimensions: `athlete_id`, `workout_id`, `submission_date`
  - Derived Fields:
    - Normalized `mood_score` mapped from strings to integers

- **`dim_calendar`**
  - Grain: One record per date
  - Source: `reference.calendar_dim`
  - Attributes: `date`, `week_start`, `month`, `quarter`, `is_weekend`

## Transformation Layer

Transformations are expressed as dbt models with incremental logic leveraging the following folder structure:

```
analytics/
  models/
    staging/
      stg_workouts.sql
      stg_wearables_daily.sql
      stg_feedback_forms.sql
    marts/
      fact_workout_sessions.sql
      dim_athlete_health.sql
      fact_feedback.sql
      dim_calendar.sql
  macros/
    resolve_duplicate_sessions.sql
    compute_recovery_status.sql
```

Key design choices:
- Source staging models standardize column names, enforce data types, and filter soft-deleted records.
- Core marts join staging tables, apply deduplication (window functions), and compute derived metrics using macros.
- Incremental materializations leverage `updated_at` (workouts) and `ingested_at` (wearables) watermarks.

## Sample dbt Model Logic

### `models/marts/fact_workout_sessions.sql`

```sql
{{ config(materialized='incremental', unique_key='workout_id') }}

with workouts as (
    select * from {{ ref('stg_workouts') }}
),
feedback as (
    select * from {{ ref('stg_feedback_forms') }}
),
health as (
    select * from {{ ref('dim_athlete_health') }}
)

select
    w.workout_id,
    w.athlete_id,
    w.program_id,
    w.workout_date,
    w.duration_minutes,
    w.rpe,
    w.duration_minutes * coalesce(w.rpe, 0) as training_load,
    f.energy_level,
    f.soreness,
    f.mood_score,
    h.health_snapshot_key,
    h.resting_hr,
    h.hrv,
    h.recovery_status,
    w.updated_at
from workouts w
left join feedback f on f.workout_id = w.workout_id
left join health h on h.athlete_id = w.athlete_id
    and h.sample_date = date(w.workout_date)
{% if is_incremental() %}
where w.updated_at > (select coalesce(max(updated_at), '1900-01-01') from {{ this }})
{% endif %}
```

### `models/marts/dim_athlete_health.sql`

```sql
{{ config(materialized='incremental', unique_key='health_snapshot_key') }}

with source as (
    select
        athlete_id,
        sample_date,
        source_system,
        hrv,
        resting_hr,
        sleep_score,
        step_count,
        calories_burned,
        ingested_at,
        row_number() over (
            partition by athlete_id, sample_date
            order by ingested_at desc
        ) as ingest_rank
    from {{ ref('stg_wearables_daily') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['athlete_id', 'sample_date']) }} as health_snapshot_key,
    athlete_id,
    sample_date,
    source_system as primary_source,
    hrv,
    resting_hr,
    sleep_score,
    step_count,
    calories_burned,
    {{ compute_recovery_status('hrv', 'athlete_id', 'sample_date') }} as recovery_status,
    ingested_at
from source
where ingest_rank = 1
{% if is_incremental() %}
  and ingested_at > (select coalesce(max(ingested_at), '1900-01-01') from {{ this }})
{% endif %}
```

## Testing Strategy
- dbt schema tests for not-null and unique keys on `workout_id`, `health_snapshot_key`, and `feedback_id`.
- Data tests verifying referential integrity between facts and `dim_calendar`.
- Custom tests ensure HRV z-score falls within ±4 standard deviations.

