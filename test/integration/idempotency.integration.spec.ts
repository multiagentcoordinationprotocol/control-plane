import { createTestApp, TestAppContext } from '../helpers/test-app';
import { decisionModeRequest, decisionHappyScript } from '../fixtures/decision-mode';

describe('Idempotency (integration)', () => {
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

  it('same idempotencyKey returns same runId', async () => {
    const request = decisionModeRequest({
      execution: {
        idempotencyKey: 'idem-test-123',
        tags: ['integration-test']
      }
    });

    const first = await ctx.client.createRun(request);
    const second = await ctx.client.createRun(request);

    expect(first.runId).toBe(second.runId);
  });

  it('different idempotencyKey creates different runs', async () => {
    const first = await ctx.client.createRun(
      decisionModeRequest({
        execution: {
          idempotencyKey: 'idem-a',
          tags: ['integration-test']
        }
      })
    );

    const second = await ctx.client.createRun(
      decisionModeRequest({
        execution: {
          idempotencyKey: 'idem-b',
          tags: ['integration-test']
        }
      })
    );

    expect(first.runId).not.toBe(second.runId);
  });

  it('no idempotencyKey always creates new runs', async () => {
    const first = await ctx.client.createRun(decisionModeRequest());
    const second = await ctx.client.createRun(decisionModeRequest());

    expect(first.runId).not.toBe(second.runId);
  });
});
