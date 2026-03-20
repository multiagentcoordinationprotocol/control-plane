-- Create webhooks table for webhook notification subscriptions
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" UUID PRIMARY KEY,
  "url" TEXT NOT NULL,
  "events" JSONB NOT NULL DEFAULT '[]',
  "secret" VARCHAR(255) NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "webhooks_active_idx" ON "webhooks" ("active");
