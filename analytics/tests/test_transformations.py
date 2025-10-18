"""Unit tests for transformation jobs."""

from datetime import datetime
from pathlib import Path

import pandas as pd
import pytest

from analytics.etl.transformations import TransformationJob, IncrementalState, PROCESSED_DIR, RAW_DIR


def setup_module(module):
    (RAW_DIR).mkdir(parents=True, exist_ok=True)
    (PROCESSED_DIR).mkdir(parents=True, exist_ok=True)


def _write_parquet(name: str, data: pd.DataFrame) -> None:
    path = RAW_DIR / f"{name}.parquet"
    data.to_parquet(path, index=False)


def test_incremental_pipeline(tmp_path, monkeypatch):
    monkeypatch.setattr("analytics.etl.transformations.RAW_DIR", tmp_path / "raw")
    monkeypatch.setattr("analytics.etl.transformations.PROCESSED_DIR", tmp_path / "processed")
    monkeypatch.setattr("analytics.etl.transformations.METRICS_DIR", tmp_path / "metrics")
    monkeypatch.setattr("analytics.etl.transformations.STATE_FILE", tmp_path / "processed" / "state.json")

    raw_dir = tmp_path / "raw"
    raw_dir.mkdir(parents=True)

    workouts = pd.DataFrame(
        {
            "workout_id": ["w1", "w2"],
            "athlete_id": ["a1", "a1"],
            "program_id": ["p1", "p1"],
            "workout_date": ["2023-01-01", "2023-01-02"],
            "duration_minutes": [45, 30],
            "rpe": [6, 7],
            "updated_at": ["2023-01-01T10:00:00Z", "2023-01-02T10:00:00Z"],
        }
    )
    workouts.to_parquet(raw_dir / "workouts.parquet", index=False)

    wearables = pd.DataFrame(
        {
            "athlete_id": ["a1", "a1"],
            "sample_date": ["2023-01-01", "2023-01-02"],
            "hrv": [80.0, 85.0],
            "resting_hr": [55, 54],
            "sleep_score": [90, 88],
            "step_count": [10000, 11000],
            "calories_burned": [500, 550],
            "source_system": ["whoop", "garmin"],
            "ingested_at": ["2023-01-01T09:00:00Z", "2023-01-02T09:00:00Z"],
        }
    )
    wearables.to_parquet(raw_dir / "wearables_daily.parquet", index=False)

    feedback = pd.DataFrame(
        {
            "feedback_id": ["f1"],
            "workout_id": ["w1"],
            "athlete_id": ["a1"],
            "mood": ["Great"],
            "energy_level": [4],
            "soreness": [2],
            "submitted_at": ["2023-01-01T12:00:00Z"],
        }
    )
    feedback.to_parquet(raw_dir / "feedback_forms.parquet", index=False)

    job = TransformationJob(run_time=datetime(2023, 1, 3))
    job.run()

    fact_path = tmp_path / "processed" / "fact_workout_sessions.parquet"
    assert fact_path.exists()

    fact = pd.read_parquet(fact_path)
    assert "training_load" in fact.columns
    assert fact.loc[fact["workout_id"] == "w1", "training_load"].iloc[0] == 270

    metrics_path = tmp_path / "metrics" / "athlete_metrics.parquet"
    metrics = pd.read_parquet(metrics_path)
    assert metrics.loc[metrics["athlete_id"] == "a1", "rpe_avg"].iloc[0] == pytest.approx(6.5)
    assert (tmp_path / "processed" / "state.json").exists()

