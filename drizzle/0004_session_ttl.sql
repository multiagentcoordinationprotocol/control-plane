-- Add expires_at column to runtime_sessions for TTL tracking
ALTER TABLE "runtime_sessions" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE;
