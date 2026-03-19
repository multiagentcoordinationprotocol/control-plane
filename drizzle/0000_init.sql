CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY,
  status varchar(32) NOT NULL,
  mode varchar(16) NOT NULL,
  runtime_kind varchar(64) NOT NULL,
  runtime_version varchar(64),
  runtime_session_id varchar(255),
  trace_id varchar(255),
  idempotency_key varchar(255),
  last_event_seq integer NOT NULL DEFAULT 0,
  source_kind varchar(128),
  source_ref text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code varchar(128),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS runs_runtime_session_id_unique ON runs(runtime_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS runs_idempotency_key_unique ON runs(idempotency_key);
CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);
CREATE INDEX IF NOT EXISTS runs_created_at_idx ON runs(created_at);

CREATE TABLE IF NOT EXISTS runtime_sessions (
  run_id uuid PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  runtime_kind varchar(64) NOT NULL,
  runtime_session_id varchar(255) NOT NULL,
  mode_name varchar(255) NOT NULL,
  mode_version varchar(64),
  configuration_version varchar(128),
  policy_version varchar(128),
  initiator_participant_id varchar(255),
  session_state varchar(64) NOT NULL DEFAULT 'SESSION_STATE_UNSPECIFIED',
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS runtime_sessions_runtime_session_id_unique ON runtime_sessions(runtime_session_id);

CREATE TABLE IF NOT EXISTS run_events_raw (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  ts timestamptz NOT NULL,
  kind varchar(64) NOT NULL,
  source_name varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  trace_id varchar(255),
  span_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS run_events_raw_run_seq_unique ON run_events_raw(run_id, seq);
CREATE INDEX IF NOT EXISTS run_events_raw_run_idx ON run_events_raw(run_id);

CREATE TABLE IF NOT EXISTS run_events_canonical (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  ts timestamptz NOT NULL,
  type varchar(128) NOT NULL,
  subject_kind varchar(64),
  subject_id varchar(255),
  source_kind varchar(64) NOT NULL,
  source_name varchar(128) NOT NULL,
  raw_type varchar(128),
  trace_id varchar(255),
  span_id varchar(255),
  parent_span_id varchar(255),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS run_events_canonical_run_seq_unique ON run_events_canonical(run_id, seq);
CREATE INDEX IF NOT EXISTS run_events_canonical_run_idx ON run_events_canonical(run_id);
CREATE INDEX IF NOT EXISTS run_events_canonical_type_idx ON run_events_canonical(type);

CREATE TABLE IF NOT EXISTS run_projections (
  run_id uuid PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 0,
  run_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals jsonb NOT NULL DEFAULT '{"signals":[]}'::jsonb,
  timeline jsonb NOT NULL DEFAULT '{"latestSeq":0,"totalEvents":0,"recent":[]}'::jsonb,
  trace_summary jsonb NOT NULL DEFAULT '{"spanCount":0,"linkedArtifacts":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS run_artifacts (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind varchar(64) NOT NULL,
  label varchar(255) NOT NULL,
  uri text,
  inline jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS run_artifacts_run_idx ON run_artifacts(run_id);
CREATE INDEX IF NOT EXISTS run_artifacts_kind_idx ON run_artifacts(kind);

CREATE TABLE IF NOT EXISTS run_metrics (
  run_id uuid PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  event_count integer NOT NULL DEFAULT 0,
  message_count integer NOT NULL DEFAULT 0,
  signal_count integer NOT NULL DEFAULT 0,
  proposal_count integer NOT NULL DEFAULT 0,
  tool_call_count integer NOT NULL DEFAULT 0,
  decision_count integer NOT NULL DEFAULT 0,
  stream_reconnect_count integer NOT NULL DEFAULT 0,
  first_event_at timestamptz,
  last_event_at timestamptz,
  duration_ms integer,
  session_state varchar(64),
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
