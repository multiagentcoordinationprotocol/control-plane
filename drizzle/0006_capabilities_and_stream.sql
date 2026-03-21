-- P1.3: Add capabilities, stream cursor, and stream timestamps to runtime_sessions
ALTER TABLE "runtime_sessions" ADD COLUMN "capabilities" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "runtime_sessions" ADD COLUMN "last_stream_cursor" INTEGER;
ALTER TABLE "runtime_sessions" ADD COLUMN "stream_connected_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "runtime_sessions" ADD COLUMN "stream_disconnected_at" TIMESTAMP WITH TIME ZONE;
