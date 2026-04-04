import { createTestApp, TestAppContext } from '../helpers/test-app';
import { decisionHappyScript } from '../fixtures/decision-mode';

describe('Dashboard Overview (integration)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp(decisionHappyScript());
  });

  afterAll(async () => {
    if (ctx) await ctx.app.close();
  });

  it('GET /dashboard/overview returns KPIs and charts with default range', async () => {
    const result = await ctx.client.request('GET', '/dashboard/overview');
    expect(result).toHaveProperty('kpis');
    expect(result).toHaveProperty('charts');
    expect(result.kpis).toHaveProperty('totalRuns');
    expect(result.kpis).toHaveProperty('activeRuns');
    expect(result.kpis).toHaveProperty('completedRuns');
    expect(result.kpis).toHaveProperty('failedRuns');
    expect(result.charts).toHaveProperty('runVolume');
    expect(result.charts).toHaveProperty('signalVolume');
    expect(result.charts).toHaveProperty('errorClasses');
  });

  it('GET /dashboard/overview?range=7d works', async () => {
    const result = await ctx.client.request('GET', '/dashboard/overview', {
      query: { range: '7d' }
    });
    expect(result).toHaveProperty('kpis');
    expect(typeof result.kpis.totalRuns).toBe('number');
  });

  it('GET /dashboard/overview?range=30d works', async () => {
    const result = await ctx.client.request('GET', '/dashboard/overview', {
      query: { range: '30d' }
    });
    expect(result).toHaveProperty('kpis');
  });

  it('KPIs reflect created runs', async () => {
    // Create a run
    await ctx.client.createRun({
      mode: 'sandbox',
      runtime: { kind: 'scripted-mock' },
      session: {
        modeName: 'macp.mode.decision.v1',
        modeVersion: '1.0.0',
        configurationVersion: '1.0.0',
        ttlMs: 60000,
        participants: [{ id: 'alice', role: 'proposer' }]
      }
    });

    await sleep(500);

    const result = await ctx.client.request('GET', '/dashboard/overview');
    expect(result.kpis.totalRuns).toBeGreaterThanOrEqual(1);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
