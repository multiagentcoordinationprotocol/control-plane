-- P4.2: Durable webhook delivery tracking
CREATE TABLE "webhook_deliveries" (
  "id" UUID PRIMARY KEY,
  "webhook_id" UUID NOT NULL REFERENCES "webhooks"("id") ON DELETE CASCADE,
  "event" VARCHAR(128) NOT NULL,
  "run_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP WITH TIME ZONE,
  "response_status" INTEGER,
  "error_message" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "delivered_at" TIMESTAMP WITH TIME ZONE
);
CREATE INDEX ON "webhook_deliveries" ("webhook_id");
CREATE INDEX ON "webhook_deliveries" ("status");
CREATE INDEX ON "webhook_deliveries" ("run_id");
