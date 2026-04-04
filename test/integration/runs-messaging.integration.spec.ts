import { createTestApp, TestAppContext } from '../helpers/test-app';
import { decisionModeRequest, decisionHappyScript } from '../fixtures/decision-mode';

describe('Run Messaging (integration)', () => {
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

  it('sends a message with JSON payload and receives ack', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const result = await ctx.client.sendMessage(runId, {
      from: 'evaluator',
      to: ['proposer'],
      messageType: 'Evaluation',
      payload: { recommendation: 'APPROVE', rationale: 'Looks good' }
    });

    expect(result).toHaveProperty('messageId');
    expect(result).toHaveProperty('ack');
    expect(result.ack).toHaveProperty('ok', true);
  });

  it('persists message.sent canonical event', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    await ctx.client.sendMessage(runId, {
      from: 'evaluator',
      to: ['proposer'],
      messageType: 'Evaluation',
      payload: { recommendation: 'APPROVE' }
    });

    await sleep(500);

    const events = await ctx.client.listEvents(runId) as any[];
    const sentEvents = events.filter((e: any) => e.type === 'message.sent');
    expect(sentEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('sends a signal', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const result = await ctx.client.sendSignal(runId, {
      from: 'proposer',
      messageType: 'Signal',
      payload: { type: 'attention', message: 'Urgent review needed' }
    });

    expect(result).toBeDefined();
  });

  it('updates context during session', async () => {
    const { runId } = await ctx.client.createRun(decisionModeRequest());
    await sleep(500);

    const result = await ctx.client.updateContext(runId, {
      from: 'proposer',
      context: { additionalData: 'new context information' }
    });

    expect(result).toBeDefined();
  });

  it('rejects message to non-existent run', async () => {
    const result = await ctx.client.sendMessage(
      '00000000-0000-0000-0000-000000000000',
      {
        from: 'evaluator',
        messageType: 'Evaluation',
        payload: {}
      }
    ) as any;

    // Should return an error
    expect(result.statusCode || result.errorCode).toBeDefined();
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
