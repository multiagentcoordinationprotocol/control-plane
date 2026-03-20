-- Phase 4.2: Audit trail table
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY,
  "actor" varchar(255) NOT NULL,
  "actor_type" varchar(64) NOT NULL,
  "action" varchar(128) NOT NULL,
  "resource" varchar(128) NOT NULL,
  "resource_id" varchar(255),
  "details" jsonb NOT NULL DEFAULT '{}',
  "request_id" varchar(255),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" ("actor");
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" ("action");
CREATE INDEX IF NOT EXISTS "audit_log_resource_idx" ON "audit_log" ("resource");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" ("created_at");
