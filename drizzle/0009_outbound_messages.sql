-- P2.2: Outbound message tracking table
CREATE TABLE "run_outbound_messages" (
  "id" UUID PRIMARY KEY,
  "run_id" UUID NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
  "runtime_session_id" VARCHAR(255) NOT NULL,
  "message_id" VARCHAR(255) NOT NULL,
  "message_type" VARCHAR(128) NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "sender" VARCHAR(255) NOT NULL,
  "recipients" JSONB NOT NULL DEFAULT '[]',
  "status" VARCHAR(32) NOT NULL DEFAULT 'queued',
  "payload_descriptor" JSONB NOT NULL DEFAULT '{}',
  "ack" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "accepted_at" TIMESTAMP WITH TIME ZONE,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON "run_outbound_messages" ("message_id");
CREATE INDEX ON "run_outbound_messages" ("run_id");
CREATE INDEX ON "run_outbound_messages" ("status");
