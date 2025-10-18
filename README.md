# Training Area Analytics

This repository contains reference implementations for ingesting athlete workout, wearable telemetry, and feedback data into a unified analytics warehouse.

## Structure

- `analytics/data_sources/inventory.md` – catalog of upstream sources, schema details, and refresh cadence.
- `analytics/models/unified_data_model.md` – dimensional model design and dbt transformation logic.
- `analytics/etl/transformations.py` – incremental pandas-based ETL job that harmonizes raw data and computes derived metrics.
- `analytics/orchestration/airflow_dag.py` – Airflow DAG wiring ingestion, transformation, and alerting.
- `analytics/documentation/pipeline_overview.md` – operational documentation, dashboards, and monitoring guidance.
- `analytics/tests/test_transformations.py` – unit test coverage for the transformation job.

## Local Development

1. Install dependencies: `pip install -r requirements.txt` (create as needed with pandas, pyarrow, pytest).
2. Place sample parquet files in `data/raw` matching source schemas.
3. Execute the transformation job:
   ```bash
   python -m analytics.etl.transformations
   ```
4. Run tests:
   ```bash
   pytest
   ```

## Orchestration

Deploy the Airflow DAG by copying `analytics/orchestration/airflow_dag.py` into the Airflow DAGs folder. Configure connections for source data storage and update notification email settings as needed.

