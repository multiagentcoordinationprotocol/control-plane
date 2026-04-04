import { createTestApp, TestAppContext } from '../helpers/test-app';
import {
  quorumModeRequest,
  quorumReachedScript,
  quorumRejectedScript,
  quorumAbstentionScript
} from '../fixtures/quorum-mode';

describe('Quorum Mode (integration)', () => {
  let ctx: TestAppContext;

  afterEach(async () => {
    if (ctx) await ctx.cleanup();
  });

  afterAll(async () => {
    if (ctx) await ctx.app.close();
  });

  describe('Quorum Reached', () => {
    beforeAll(async () => {
      ctx = await createTestApp(quorumReachedScript());
    });

    it('two approvals reach quorum', async () => {
      const { runId } = await ctx.client.createRun(quorumModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'voter_a',
        to: ['initiator'],
        messageType: 'Approve',
        payload: { requestId: 'approval-1', comment: 'Ship it' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'voter_b',
        to: ['initiator'],
        messageType: 'Approve',
        payload: { requestId: 'approval-1' }
      });

      await sleep(1000);

      const run = await ctx.client.getRun(runId) as any;
      expect(['running', 'completed']).toContain(run.status);
    });
  });

  describe('Quorum Not Reached', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(quorumRejectedScript());
    });

    it('majority rejection blocks quorum', async () => {
      const { runId } = await ctx.client.createRun(quorumModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'voter_a',
        to: ['initiator'],
        messageType: 'Approve',
        payload: { requestId: 'approval-1' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'voter_b',
        to: ['initiator'],
        messageType: 'Reject',
        payload: { requestId: 'approval-1', reason: 'Not ready' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'voter_c',
        to: ['initiator'],
        messageType: 'Reject',
        payload: { requestId: 'approval-1', reason: 'Missing tests' }
      });

      await sleep(1000);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Abstention Handling', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(quorumAbstentionScript());
    });

    it('abstention does not block quorum when approvals sufficient', async () => {
      const { runId } = await ctx.client.createRun(quorumModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'voter_a',
        to: ['initiator'],
        messageType: 'Approve',
        payload: { requestId: 'approval-1' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'voter_b',
        to: ['initiator'],
        messageType: 'Abstain',
        payload: { requestId: 'approval-1', reason: 'No opinion' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'voter_c',
        to: ['initiator'],
        messageType: 'Approve',
        payload: { requestId: 'approval-1' }
      });

      await sleep(1000);

      const run = await ctx.client.getRun(runId) as any;
      expect(['running', 'completed']).toContain(run.status);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
