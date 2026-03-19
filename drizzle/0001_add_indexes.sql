-- Add performance indexes for common query patterns

-- Index for finding active/in-progress runs
CREATE INDEX IF NOT EXISTS runs_active_idx ON runs(status) WHERE status IN ('queued', 'starting', 'binding_session', 'running');

-- Index for filtering by runtime_kind
CREATE INDEX IF NOT EXISTS runs_runtime_kind_idx ON runs(runtime_kind);

-- Index for efficient event timeline queries
CREATE INDEX IF NOT EXISTS run_events_canonical_run_ts_idx ON run_events_canonical(run_id, ts);

-- Index for raw event deduplication
CREATE INDEX IF NOT EXISTS run_events_raw_run_kind_idx ON run_events_raw(run_id, kind);
