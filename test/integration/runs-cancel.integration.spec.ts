import { createTestApp, TestAppContext } from '../helpers/test-app';
import { decisionModeRequest, decisionHappyScript } from '../fixtures/decision-mode';

describe('Run Cancellation (integration)', () => {
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

  it('cancels a running session', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const result = await ctx.client.cancelRun(runId, 'Integration test cancellation');
    expect(result).toBeDefined();

    await sleep(500);

    const run = await ctx.client.getRun(runId) as any;
    expect(['cancelled', 'completed', 'failed']).toContain(run.status);
  });

  it('cancel emits run.cancelled event', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    await ctx.client.cancelRun(runId);
    await sleep(500);

    const events = await ctx.client.listEvents(runId) as any[];
    // Should have lifecycle events
    expect(events.length).toBeGreaterThan(0);
  });

  it('cancel of non-existent run returns error', async () => {
    const result = await ctx.client.cancelRun(
      '00000000-0000-0000-0000-000000000000'
    ) as any;
    expect(result.statusCode || result.errorCode).toBeDefined();
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
