"""Incremental transformation jobs for athlete analytics."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import pandas as pd


RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
METRICS_DIR = Path("data/metrics")
STATE_FILE = PROCESSED_DIR / "state.json"


@dataclass
class IncrementalState:
    """Tracks high-water marks for each source."""

    workouts_updated_at: Optional[str] = None
    wearables_ingested_at: Optional[str] = None
    feedback_updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Optional[str]]:
        return {
            "workouts_updated_at": self.workouts_updated_at,
            "wearables_ingested_at": self.wearables_ingested_at,
            "feedback_updated_at": self.feedback_updated_at,
        }

    @classmethod
    def load(cls) -> "IncrementalState":
        if STATE_FILE.exists():
            with STATE_FILE.open() as f:
                payload = json.load(f)
            return cls(**payload)
        return cls()

    def save(self) -> None:
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        with STATE_FILE.open("w") as f:
            json.dump(self.to_dict(), f, indent=2)


class TransformationJob:
    """Coordinates extraction, transformation, and validation."""

    def __init__(self, run_time: Optional[datetime] = None) -> None:
        self.state = IncrementalState.load()
        self.run_time = run_time or datetime.utcnow()

    def _load_source(self, name: str, *, timestamp_col: str, watermark: Optional[str]) -> pd.DataFrame:
        path = RAW_DIR / f"{name}.parquet"
        if not path.exists():
            raise FileNotFoundError(f"Missing raw dataset: {path}")
        df = pd.read_parquet(path)
        if watermark:
            df = df[df[timestamp_col] > watermark]
        return df

    def _normalize_workouts(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.drop_duplicates(subset=["workout_id"], keep="last")
        df["training_load"] = df["duration_minutes"].fillna(0) * df["rpe"].fillna(0)
        return df

    def _normalize_wearables(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values("ingested_at").drop_duplicates(
            subset=["athlete_id", "sample_date"], keep="last"
        )
        df["recovery_status"] = self._compute_recovery_status(df)
        return df

    @staticmethod
    def _compute_recovery_status(df: pd.DataFrame) -> pd.Series:
        rolling = (
            df.sort_values(["athlete_id", "sample_date"])
            .groupby("athlete_id")
            .hrv.transform(lambda s: (s - s.rolling(14, min_periods=7).mean()) / s.rolling(14, min_periods=7).std())
        )
        return pd.cut(
            rolling,
            bins=[float("-inf"), -1.5, -0.5, 0.5, 1.5, float("inf")],
            labels=["overreaching", "strain", "steady", "primed", "peak"],
        )

    def _normalize_feedback(self, df: pd.DataFrame) -> pd.DataFrame:
        mood_map = {"great": 5, "good": 4, "ok": 3, "poor": 2, "awful": 1}
        df["mood_score"] = df["mood"].str.lower().map(mood_map).fillna(3)
        df = df.drop_duplicates(subset=["feedback_id"], keep="last")
        return df

    def _merge_fact_workout_sessions(
        self, workouts: pd.DataFrame, health: pd.DataFrame, feedback: pd.DataFrame
    ) -> pd.DataFrame:
        merged = workouts.merge(
            health,
            how="left",
            left_on=["athlete_id", "workout_date"],
            right_on=["athlete_id", "sample_date"],
            suffixes=("", "_health"),
        ).merge(
            feedback[["workout_id", "energy_level", "soreness", "mood_score"]],
            how="left",
            on="workout_id",
        )
        return merged

    def _compute_metrics(self, workouts: pd.DataFrame) -> pd.DataFrame:
        metrics = workouts.groupby("athlete_id").agg(
            rpe_avg=("rpe", "mean"),
            training_load_7d=("training_load", lambda s: s.tail(7).sum()),
            hrv_trend=("hrv", lambda s: s.tail(7).mean()),
        )
        metrics.reset_index(inplace=True)
        metrics["generated_at"] = self.run_time.isoformat()
        return metrics

    def _validate(self, df: pd.DataFrame) -> None:
        if df["workout_id"].isna().any():
            raise ValueError("Null workout_id detected")
        if (df["rpe"] < 0).any() or (df["rpe"] > 10).any():
            raise ValueError("RPE out of expected range 0-10")

    def run(self) -> None:
        workouts = self._load_source(
            "workouts", timestamp_col="updated_at", watermark=self.state.workouts_updated_at
        )
        wearables = self._load_source(
            "wearables_daily", timestamp_col="ingested_at", watermark=self.state.wearables_ingested_at
        )
        feedback = self._load_source(
            "feedback_forms", timestamp_col="submitted_at", watermark=self.state.feedback_updated_at
        )

        workouts = self._normalize_workouts(workouts)
        wearables = self._normalize_wearables(wearables)
        feedback = self._normalize_feedback(feedback)

        fact_workouts = self._merge_fact_workout_sessions(workouts, wearables, feedback)
        self._validate(fact_workouts)

        metrics = self._compute_metrics(fact_workouts)

        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        METRICS_DIR.mkdir(parents=True, exist_ok=True)

        fact_workouts.to_parquet(PROCESSED_DIR / "fact_workout_sessions.parquet", index=False)
        wearables.to_parquet(PROCESSED_DIR / "dim_athlete_health.parquet", index=False)
        feedback.to_parquet(PROCESSED_DIR / "fact_feedback.parquet", index=False)
        metrics.to_parquet(METRICS_DIR / "athlete_metrics.parquet", index=False)

        self.state.workouts_updated_at = str(workouts["updated_at"].max())
        self.state.wearables_ingested_at = str(wearables["ingested_at"].max())
        self.state.feedback_updated_at = str(feedback["submitted_at"].max())
        self.state.save()


if __name__ == "__main__":
    job = TransformationJob()
    job.run()
