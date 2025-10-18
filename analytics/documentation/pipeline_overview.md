# Athlete Analytics Pipeline Documentation

## Pipeline Flow

1. **Ingestion Layer**
   - Change data capture jobs land `workouts` and `feedback_forms` into `data/raw` as hourly parquet partitions.
   - Wearable integrations push normalized summaries into `data/raw/wearables_daily.parquet` via ingestion connectors.

2. **Transformation Layer**
   - Airflow DAG `athlete_analytics_pipeline` triggers the `TransformationJob` hourly.
   - The job performs deduplication, calculates training load and recovery status, and produces dimensional parquet tables in `data/processed`.

3. **Metrics Layer**
   - Derived KPIs (RPE average, 7-day training load, HRV trend) materialize into `data/metrics/athlete_metrics.parquet`.
   - dbt models refresh downstream dashboards in the BI warehouse.

## Data Freshness & SLAs

| Dataset | SLA | Monitoring |
| --- | --- | --- |
| `fact_workout_sessions` | <= 20 min behind real time | dbt source freshness + Airflow SLA miss alerts |
| `dim_athlete_health` | <= 1 hour | Airflow data quality checks on ingest latency |
| `fact_feedback` | <= 15 min | Kafka consumer lag metrics |

## Validation & Anomaly Detection

- **dbt Tests**: Unique and not-null checks, referential integrity enforcement, custom HRV z-score bounds.
- **Great Expectations** (optional): Validate distribution of RPE and HRV metrics during nightly runs.
- **Anomaly Thresholds**:
  - RPE average change > 2 points day-over-day triggers Slack alert.
  - HRV trend drop > 20% over 3 days raises recovery warning.

## Dashboards

Dashboards are built in Mode Analytics with the following widgets:

- **Pipeline Status**: Line chart of record counts per dataset vs. SLA thresholds.
- **Data Freshness**: Heatmap showing minutes since last successful run for each source.
- **Athlete Readiness**: Scatter plot of HRV trend vs. training load for actionable insights.

Each dashboard is sourced from the parquet outputs and refreshed hourly via API automation.

## Operational Runbook

- Check Airflow DAGs for failures; retry tasks or backfill as needed.
- Verify `data/processed/state.json` to confirm high-water marks are advancing.
- Review Datadog alerts for ingestion delays, and coordinate with integration partners when SLAs are breached.

