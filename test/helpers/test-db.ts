import { Pool } from 'pg';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/macp_control_plane_test';

/**
 * Truncate all tables to ensure clean state between test suites.
 * Uses CASCADE to handle foreign key relationships.
 */
export async function truncateAll(pool?: Pool): Promise<void> {
  const p = pool ?? new Pool({ connectionString: TEST_DB_URL });
  const ownPool = !pool;

  try {
    await p.query(`
      TRUNCATE
        webhook_deliveries,
        webhooks,
        run_outbound_messages,
        run_metrics,
        run_artifacts,
        run_projections,
        run_events_canonical,
        run_events_raw,
        runtime_sessions,
        audit_log,
        runs
      CASCADE
    `);
  } finally {
    if (ownPool) {
      await p.end();
    }
  }
}

/**
 * Create a fresh pool connection to the test database.
 */
export function createTestPool(): Pool {
  return new Pool({
    connectionString: TEST_DB_URL,
    max: 5
  });
}
