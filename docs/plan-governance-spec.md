# Plan Governance and Experimentation Specification

## Overview
This document describes product flows, API designs, data models, and telemetry required to support collaborative editing of generated training plans, robust access controls, experimentation infrastructure, and feedback-driven model retraining. It covers the needs of coaches, athletes, and administrators.

## 1. Collaborative Plan Editing and Approval

### 1.1 Personas
- **Coach:** Reviews generated plans, suggests adjustments, approves plans before delivery to athletes.
- **Athlete:** Receives generated plan, can request changes, acknowledge approval, and track adherence.
- **Admin:** Manages roles, audits modifications, oversees experiments.

### 1.2 UI/UX Flows

#### Flow A: Coach Reviews and Edits Generated Plan
1. Coach lands on "Pending Plans" dashboard filtered to athletes awaiting approval.
2. Selecting a plan opens a split-screen view:
   - Left: timeline of previous plans, adherence stats, algorithm version.
   - Right: current plan calendar by week with inline edit controls.
3. Edits use contextual modals:
   - Clicking a session opens details (exercises, dosage, notes).
   - Coach may adjust exercise selection, volume, and annotations.
4. Change tracking sidebar lists unsaved edits, diffs against generated baseline, and summary badges (e.g., "Volume ↑ 12%").
5. Coach saves a draft; system persists a new version with `status=draft`, logging change summary.
6. Coach clicks "Submit for Approval" to move plan to `status=coach_reviewed` and notifies athlete.

#### Flow B: Athlete Feedback and Approval
1. Athlete receives notification of coach-reviewed plan.
2. Athlete views changes with highlight diff (green additions, red removals) and quick summary of impact.
3. Athlete can:
   - Accept plan → plan moves to `status=approved`, schedule is published.
   - Request changes → comment threads anchored to sessions; plan returns to `status=needs_revision` for coach.
4. Athlete's decision and comments are stored in change log.

#### Flow C: Administrator Audit and Change History
1. Admin accesses "Plan History" via athlete profile.
2. Timeline view displays plan versions, authors, timestamps, change metrics, and approval status.
3. Selecting a version reveals diff viewer and audit log entries (fields changed, old/new values, rationale tags).
4. Admin can export change log to CSV for compliance.

### 1.3 Backend Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/plans?status=pending&coach_id=` | List plans pending review for coach | Query params | Paginated list of plan headers with latest version summary |
| GET | `/api/v1/plans/{plan_id}/versions/{version_id}` | Fetch specific plan version with diff metadata | n/a | Version payload including sections, change markers, approvals |
| PATCH | `/api/v1/plans/{plan_id}/versions/{version_id}` | Apply edits to draft version | JSON Patch-style operations or domain payload | Updated version snapshot, new `version_number` |
| POST | `/api/v1/plans/{plan_id}/submit` | Transition plan to coach-reviewed | `{ "comment": "string" }` | Updated plan status |
| POST | `/api/v1/plans/{plan_id}/approve` | Athlete approval | `{ "decision": "accept|request_changes", "comment": "string" }` | Updated status, recorded decision |
| POST | `/api/v1/plans/{plan_id}/comments` | Create threaded comment | `{ "anchor_id": "session-uuid", "message": "string" }` | Comment resource |
| GET | `/api/v1/plans/{plan_id}/changelog` | Retrieve change history | Query by date/user | Paginated change entries |

### 1.4 Change Tracking Model
- **Tables:**
  - `plans` (id, athlete_id, status, active_version_id, experiment_arm, created_at, created_by)
  - `plan_versions` (id, plan_id, version_number, parent_version_id, status, author_id, diff_summary_json, created_at)
  - `plan_sessions` (version_id, session_id, day, modality, prescribed_work_json)
  - `plan_version_changes` (id, version_id, field_path, old_value, new_value, change_type, comment_id?)
  - `plan_comments` (id, plan_id, version_id, anchor_id, author_id, message, visibility, created_at)

- Change tracking uses immutable `plan_versions`; PATCH creates new version referencing parent. `diff_summary_json` aggregates volume shifts, exercise swaps, rationale tags.

- Audit log integration (see Section 2) ensures every change writes a structured event.

## 2. Role-Based Access Control and Audit Logging

### 2.1 Roles and Permissions
- **Roles:** `admin`, `coach`, `athlete`, `data_scientist`, `support`.
- Permission matrix (examples):
  - `plan:view`: coach (assigned athletes), athlete (own), admin (all), support (assigned groups).
  - `plan:edit`: coach (draft versions), admin.
  - `plan:approve`: athlete (own), admin (override).
  - `experiment:manage`: admin, data_scientist.
  - `audit:read`: admin, compliance.

### 2.2 Access Enforcement
- JWT or session tokens include `role` and `subject_scope` (athlete IDs, team IDs).
- Middleware resolves user context, checks required permission per endpoint.
- Database row-level security (if Postgres) or scoped queries enforce subject-level constraints.
- Sensitive operations (status transitions, experiment assignments) require dual logging: action event + resulting state.

### 2.3 Audit Log Schema
- `audit_events` table:
  - `id`, `occurred_at`, `actor_id`, `actor_role`, `action`, `target_type`, `target_id`, `request_id`, `metadata_json`, `origin_ip`, `user_agent`.
- Events triggered by:
  - Plan edits (`action=plan.edit`), approvals, comments, overrides.
  - Role changes, experiment assignments, feature flag overrides.
  - Manual data corrections.
- Use append-only store with WORM retention (e.g., Postgres table + S3 glacier export). Provide admin UI filters (date, actor, athlete).

### 2.4 Manual Adjustment Workflow
- When a plan edit occurs via admin/coach UI, backend wraps transaction:
  1. Validate RBAC.
  2. Persist new `plan_version` and modifications.
  3. Insert `audit_event` summarizing fields changed (reference `plan_version_changes`).
  4. Emit message to telemetry bus (`plan.version.updated`).
- Provide automated nightly reconciliation to detect orphan versions and raise alerts if audit events missing.

## 3. Experimentation Framework

### 3.1 Requirements
- Randomize athletes into algorithm variants (A/B/n) with stratification (sport, level).
- Support holdouts, guardrails, and time-bounded experiments.
- Provide deterministic assignments and exposure logging.

### 3.2 Architecture
- **Feature Flag Service** (`experiments_service`):
  - REST/gRPC endpoint `POST /assignments` accepting `{ subject_id, experiment_key, attributes }`.
  - Deterministic hashing (e.g., Murmur3) seeded by experiment config.
  - Stores assignments in `experiment_assignments` (subject_id, experiment_id, variant, bucket, assigned_at, is_holdout).
- **Experiment Config** table (`experiments`):
  - `id`, `key`, `name`, `status (draft|running|paused|complete)`, `start_at`, `end_at`, `variant_weights`, `stratification_keys`, `holdout_percentage`, `owner_id`.
- Control plane UI for data scientists to create/edit experiments with preview of allocation.

### 3.3 Integration with Plan Generation
- Plan generation request calls assignment service for `plan_algorithm_variant`.
- Response attaches `experiment_arm` to new plan record and logs exposure event (`plan.generated` with variant).
- Feature flags used for UI toggles (e.g., new diff viewer) through CDN-cached configuration.

## 4. Outcome Metrics and Telemetry

### 4.1 Metrics Definitions
- **Adherence Rate:** Completed sessions / scheduled sessions per plan, aggregated weekly.
- **Performance Improvement:** Change in key performance indicators (e.g., max reps, power output) over evaluation window.
- **Time-to-approval:** Duration from plan generation to athlete approval.
- **Override Frequency:** Percent of generated plans requiring manual edits.
- **Athlete Satisfaction:** CSAT surveys post-cycle.

### 4.2 Data Pipeline
- Instrument plan lifecycle events (`plan.generated`, `plan.edited`, `plan.approved`, `plan.published`, `plan.completed`).
- Log adherence via workout completion events; join with plan versions to compute diffs.
- Stream telemetry to warehouse (e.g., via Kafka → Snowflake). Ensure events include `experiment_arm`, `algorithm_version`, `coach_id`.
- Schedule daily dbt models to compute experiment metrics (adherence uplift, approval latency).

### 4.3 Dashboarding
- Experiment results dashboard with:
  - Variant comparison (adherence, performance improvement, override rate).
  - Funnel chart for plan lifecycle (generated → approved → completed).
  - Change impact heatmap by coach.
- Alert thresholds (e.g., adherence drop >10%) using observability tool (PagerDuty/Slack).

## 5. Feedback Loop into Retraining

### 5.1 Data Capture
- Persist override metadata: reason codes (`injury`, `time_constraint`, `athlete_preference`), manual adjustments (volume %, exercise swaps).
- Store athlete feedback comments categorized via NLP tagging.
- Link plan versions to training outcomes and satisfaction scores.

### 5.2 Retraining Pipeline
1. Nightly ETL exports plan versions, overrides, outcomes to feature store (Parquet/S3).
2. Feature engineering attaches context (athlete profile, season, experiment variant).
3. Label generation uses adherence/performance metrics over subsequent weeks.
4. Model training pipeline (e.g., Airflow) consumes curated dataset, tracks algorithm versioning (MLflow).
5. Evaluation stage compares candidate model vs control on offline metrics; if passing, roll into new experiment variant.

### 5.3 Human-in-the-loop Review
- Data scientists review override clusters, produce heuristics to feed into model features.
- Provide coaches with summary of how overrides influenced retraining (transparency report).
- When significant override patterns detected, auto-create experiment proposals to validate hypotheses before global rollout.

## 6. Security and Compliance Considerations
- Encrypt audit logs at rest, restrict access to compliance roles.
- Provide data retention policy (e.g., 7 years) for plan edits.
- Redact PII from telemetry via hashing or tokenization.
- Ensure experimentation assignments respect consent (opt-in/out flags per athlete).

## 7. Implementation Milestones
1. **Milestone 1:** Ship collaborative plan editor with change tracking and RBAC (Sections 1 & 2).
2. **Milestone 2:** Deploy experimentation service and integrate with plan generation (Section 3).
3. **Milestone 3:** Launch telemetry and analytics dashboards (Section 4).
4. **Milestone 4:** Operationalize retraining feedback loop (Section 5).

Each milestone should include automated testing, monitoring, and documentation updates.
