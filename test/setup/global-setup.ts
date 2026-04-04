import { execSync } from 'node:child_process';
import { Client } from 'pg';

const TEST_DB_URL =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/macp_control_plane_test';

export default async function globalSetup(): Promise<void> {
  // If not in CI, start the test postgres container
  if (!process.env.CI) {
    try {
      execSync(
        'docker compose -f docker-compose.test.yml up -d postgres-test --wait',
        { stdio: 'inherit', cwd: process.cwd() }
      );
    } catch {
      console.warn(
        'Could not start docker compose. Assuming database is already running.'
      );
    }
  }

  // Wait for postgres to be ready
  let retries = 20;
  while (retries > 0) {
    try {
      const client = new Client({ connectionString: TEST_DB_URL });
      await client.connect();
      await client.end();
      break;
    } catch {
      retries--;
      if (retries === 0) throw new Error('Test database not reachable');
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Store the DB URL for tests to pick up
  process.env.DATABASE_URL = TEST_DB_URL;

  console.log('Integration test global setup complete.');
}
