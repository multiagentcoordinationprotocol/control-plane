-- P1.4: Add schema_version to canonical events
ALTER TABLE "run_events_canonical" ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 3;
