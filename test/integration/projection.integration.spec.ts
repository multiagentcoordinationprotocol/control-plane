import { createTestApp, TestAppContext } from '../helpers/test-app';
import { decisionModeRequest, decisionHappyScript } from '../fixtures/decision-mode';

describe('Projection (integration)', () => {
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

  it('projection includes all required sections', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const state = await ctx.client.getState(runId) as any;

    expect(state).toHaveProperty('run');
    expect(state).toHaveProperty('participants');
    expect(state).toHaveProperty('graph');
    expect(state).toHaveProperty('decision');
    expect(state).toHaveProperty('signals');
    expect(state).toHaveProperty('progress');
    expect(state).toHaveProperty('timeline');
    expect(state).toHaveProperty('trace');
    expect(state).toHaveProperty('outboundMessages');
  });

  it('projection tracks participant status', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const state = await ctx.client.getState(runId) as any;
    expect(state.participants).toBeInstanceOf(Array);
    // Should have participants from the execution request
    if (state.participants.length > 0) {
      const participant = state.participants[0];
      expect(participant).toHaveProperty('participantId');
      expect(participant).toHaveProperty('status');
    }
  });

  it('projection tracks timeline with sequence numbers', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const state = await ctx.client.getState(runId) as any;
    expect(state.timeline).toHaveProperty('latestSeq');
    expect(state.timeline).toHaveProperty('totalEvents');
    expect(state.timeline.totalEvents).toBeGreaterThanOrEqual(0);
  });

  it('projection graph tracks message flow', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    // Send a message to create a graph edge
    await ctx.client.sendMessage(runId, {
      from: 'evaluator',
      to: ['proposer'],
      messageType: 'Evaluation',
      payload: { recommendation: 'APPROVE' }
    });
    await sleep(500);

    const state = await ctx.client.getState(runId) as any;
    expect(state.graph).toHaveProperty('nodes');
    expect(state.graph).toHaveProperty('edges');
  });

  it('projection rebuilds from events', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    // Get state before rebuild
    const before = await ctx.client.getState(runId) as any;

    // Trigger projection rebuild
    await ctx.client.rebuildProjection(runId);
    await sleep(300);

    // Get state after rebuild
    const after = await ctx.client.getState(runId) as any;

    // Core structure should be the same
    expect(after.run.runId).toBe(before.run.runId);
    expect(after.run.status).toBe(before.run.status);
    expect(after.timeline.totalEvents).toBe(before.timeline.totalEvents);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
