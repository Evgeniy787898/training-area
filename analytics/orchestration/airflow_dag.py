"""Airflow DAG orchestrating ingestion and transformation pipelines."""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.email import send_email

from analytics.etl.transformations import TransformationJob


def _notify_failure(context):
    subject = f"Analytics pipeline failure: {context['task_instance'].task_id}"
    body = f"Task failed at {datetime.utcnow().isoformat()}\n\nContext: {context}"
    send_email(to=["data-team@example.com"], subject=subject, html_content=body)


def run_transformations(**_):
    job = TransformationJob()
    job.run()


def create_dag() -> DAG:
    default_args = {
        "owner": "data-engineering",
        "depends_on_past": False,
        "email_on_failure": False,
        "retries": 1,
        "retry_delay": timedelta(minutes=10),
        "on_failure_callback": _notify_failure,
    }

    dag = DAG(
        dag_id="athlete_analytics_pipeline",
        default_args=default_args,
        description="Ingests workout, wearable, and feedback data and builds analytics marts",
        schedule_interval="0 * * * *",
        start_date=datetime(2023, 1, 1),
        catchup=False,
        tags=["analytics", "athlete"],
    )

    with dag:
        build_marts = PythonOperator(
            task_id="build_incremental_marts",
            python_callable=run_transformations,
            provide_context=True,
        )

    return dag


dag = create_dag()
