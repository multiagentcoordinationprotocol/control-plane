import { createTestApp, TestAppContext } from '../helpers/test-app';
import {
  handoffModeRequest,
  handoffAcceptScript,
  handoffDeclineScript
} from '../fixtures/handoff-mode';

describe('Handoff Mode (integration)', () => {
  let ctx: TestAppContext;

  afterEach(async () => {
    if (ctx) await ctx.cleanup();
  });

  afterAll(async () => {
    if (ctx) await ctx.app.close();
  });

  describe('Successful Handoff', () => {
    beforeAll(async () => {
      ctx = await createTestApp(handoffAcceptScript());
    });

    it('source offers, provides context, target accepts', async () => {
      const { runId } = await ctx.client.createRun(handoffModeRequest());
      await sleep(500);

      // Source provides context
      await ctx.client.sendMessage(runId, {
        from: 'source',
        to: ['target'],
        messageType: 'HandoffContext',
        payload: {
          conversationHistory: ['msg1', 'msg2'],
          metadata: { topic: 'billing' }
        }
      });
      await sleep(200);

      // Target accepts
      await ctx.client.sendMessage(runId, {
        from: 'target',
        to: ['source'],
        messageType: 'HandoffAccept',
        payload: { acceptedAt: new Date().toISOString() }
      });

      await sleep(1000);

      const run = await ctx.client.getRun(runId) as any;
      expect(['running', 'completed']).toContain(run.status);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('projected state shows both participants', async () => {
      const { runId } = await ctx.client.createRun(handoffModeRequest());
      await sleep(500);

      const state = await ctx.client.getState(runId) as any;
      expect(state.participants.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Declined Handoff', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(handoffDeclineScript());
    });

    it('target declines handoff', async () => {
      const { runId } = await ctx.client.createRun(handoffModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'target',
        to: ['source'],
        messageType: 'HandoffDecline',
        payload: { reason: 'Not available' }
      });

      await sleep(1000);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(1);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
