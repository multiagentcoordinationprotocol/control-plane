import { createTestApp, TestAppContext } from '../helpers/test-app';
import {
  proposalModeRequest,
  proposalAcceptScript,
  proposalCounterScript,
  proposalRejectScript
} from '../fixtures/proposal-mode';

describe('Proposal Mode (integration)', () => {
  let ctx: TestAppContext;

  afterEach(async () => {
    if (ctx) await ctx.cleanup();
  });

  afterAll(async () => {
    if (ctx) await ctx.app.close();
  });

  describe('Accept Flow', () => {
    beforeAll(async () => {
      ctx = await createTestApp(proposalAcceptScript());
    });

    it('reviewer accepts proposal', async () => {
      const { runId } = await ctx.client.createRun(proposalModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'reviewer',
        to: ['author'],
        messageType: 'Accept',
        payload: { proposalId: 'prop-1', comment: 'LGTM' }
      });

      await sleep(1000);

      const run = await ctx.client.getRun(runId) as any;
      expect(['running', 'completed']).toContain(run.status);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Counter-Proposal Flow', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(proposalCounterScript());
    });

    it('reviewer counter-proposes, author accepts', async () => {
      const { runId } = await ctx.client.createRun(proposalModeRequest());
      await sleep(500);

      // Reviewer sends counter-proposal
      await ctx.client.sendMessage(runId, {
        from: 'reviewer',
        to: ['author'],
        messageType: 'CounterProposal',
        payload: {
          proposalId: 'prop-2',
          supersedesProposalId: 'prop-1',
          title: 'Better approach'
        }
      });
      await sleep(200);

      // Author accepts the counter-proposal
      await ctx.client.sendMessage(runId, {
        from: 'author',
        to: ['reviewer'],
        messageType: 'Accept',
        payload: { proposalId: 'prop-2' }
      });

      await sleep(1000);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Rejection Flow', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(proposalRejectScript());
    });

    it('reviewer rejects proposal', async () => {
      const { runId } = await ctx.client.createRun(proposalModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'reviewer',
        to: ['author'],
        messageType: 'Reject',
        payload: { proposalId: 'prop-1', reason: 'Out of scope', terminal: true }
      });

      await sleep(1000);

      const run = await ctx.client.getRun(runId) as any;
      expect(['running', 'completed', 'failed']).toContain(run.status);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
