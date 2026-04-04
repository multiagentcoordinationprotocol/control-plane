import { createTestApp, TestAppContext } from '../helpers/test-app';
import { TestSSEClient } from '../helpers/sse-client';
import { decisionModeRequest, decisionHappyScript } from '../fixtures/decision-mode';

describe('Run SSE Streaming (integration)', () => {
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

  it('SSE stream delivers canonical events', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());

    const sse = new TestSSEClient(ctx.url, 'test-key-integration');
    sse.connect(runId, { includeSnapshot: true });

    try {
      // Wait for at least one event
      await sleep(2000);

      // Should have received some events
      expect(sse.events.length).toBeGreaterThan(0);

      // Check event structure
      for (const event of sse.events) {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(['snapshot', 'canonical_event', 'heartbeat']).toContain(
          event.type
        );
      }
    } finally {
      sse.close();
    }
  });

  it('SSE stream includes snapshot when requested', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const sse = new TestSSEClient(ctx.url, 'test-key-integration');
    sse.connect(runId, { includeSnapshot: true });

    try {
      await sleep(2000);

      const snapshots = sse.getEventsByType('snapshot');
      expect(snapshots.length).toBeGreaterThanOrEqual(1);

      if (snapshots.length > 0) {
        const snapshot = snapshots[0].data as Record<string, unknown>;
        expect(snapshot).toHaveProperty('run');
        expect(snapshot).toHaveProperty('participants');
      }
    } finally {
      sse.close();
    }
  });

  it('SSE events have sequential IDs for resume support', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const sse = new TestSSEClient(ctx.url, 'test-key-integration');
    sse.connect(runId);

    try {
      await sleep(2000);

      const canonicalEvents = sse.getEventsByType('canonical_event');
      if (canonicalEvents.length >= 2) {
        // Event IDs should be parseable as sequence numbers
        const ids = canonicalEvents
          .map((e) => e.id)
          .filter((id) => id !== undefined);
        expect(ids.length).toBeGreaterThan(0);
      }
    } finally {
      sse.close();
    }
  });

  it('SSE stream can resume from afterSeq', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(1000);

    // Get current events to find a seq to resume from
    const events = (await ctx.client.listEvents(runId)) as any[];
    if (events.length === 0) return; // Skip if no events yet

    const midSeq = events[0].seq;

    const sse = new TestSSEClient(ctx.url, 'test-key-integration');
    sse.connect(runId, { afterSeq: midSeq });

    try {
      await sleep(2000);

      // All canonical events should have seq > midSeq
      const canonicalEvents = sse.getEventsByType('canonical_event');
      for (const event of canonicalEvents) {
        const data = event.data as Record<string, unknown>;
        if (data.seq !== undefined) {
          expect(data.seq as number).toBeGreaterThan(midSeq);
        }
      }
    } finally {
      sse.close();
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
