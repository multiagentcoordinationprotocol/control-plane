ALTER TABLE "run_projections" ADD COLUMN IF NOT EXISTS "progress" jsonb NOT NULL DEFAULT '{"entries":[]}';
CREATE INDEX IF NOT EXISTS run_events_raw_run_ts_idx ON run_events_raw(run_id, ts);
CREATE INDEX IF NOT EXISTS run_events_raw_run_seq_idx ON run_events_raw(run_id, seq);
