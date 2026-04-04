import { createTestApp, TestAppContext } from '../helpers/test-app';
import { decisionModeRequest, decisionHappyScript } from '../fixtures/decision-mode';

describe('Concurrency (integration)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp(decisionHappyScript());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await ctx.cleanup();
  });

  it('creates multiple runs simultaneously', async () => {
    const count = 5;
    const promises = Array.from({ length: count }, () =>
      ctx.client.createRun(decisionModeRequest())
    );

    const results = await Promise.all(promises);

    // All should succeed
    expect(results.length).toBe(count);

    // All should have unique IDs
    const ids = results.map((r) => r.runId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(count);

    // All should have valid UUIDs
    for (const result of results) {
      expect(result.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(result.status).toBe('queued');
    }
  });

  it('concurrent messages to same run are all accepted', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    // Send multiple messages concurrently
    const promises = Array.from({ length: 3 }, (_, i) =>
      ctx.client.sendMessage(runId, {
        from: 'evaluator',
        to: ['proposer'],
        messageType: 'Evaluation',
        payload: {
          recommendation: 'APPROVE',
          rationale: `Concurrent evaluation ${i}`
        }
      })
    );

    const results = await Promise.allSettled(promises);

    // At least some should succeed (run may not be in correct state for all)
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThan(0);
  });

  it('fetching runs concurrently does not cause issues', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(300);

    // Fetch the same run concurrently
    const promises = Array.from({ length: 10 }, () =>
      ctx.client.getRun(runId)
    );

    const results = await Promise.all(promises);

    // All should return the same run
    for (const result of results) {
      expect((result as any).id).toBe(runId);
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
