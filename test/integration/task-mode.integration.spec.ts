import { createTestApp, TestAppContext } from '../helpers/test-app';
import {
  taskModeRequest,
  taskHappyScript,
  taskRejectionScript,
  taskFailureScript
} from '../fixtures/task-mode';

describe('Task Mode (integration)', () => {
  let ctx: TestAppContext;

  afterEach(async () => {
    if (ctx) await ctx.cleanup();
  });

  afterAll(async () => {
    if (ctx) await ctx.app.close();
  });

  describe('Happy Path — Request, Accept, Update, Complete', () => {
    beforeAll(async () => {
      ctx = await createTestApp(taskHappyScript());
    });

    it('creates a task mode run', async () => {
      const { runId } = await ctx.client.createRun(taskModeRequest());
      expect(runId).toBeDefined();

      await sleep(500);

      const run = await ctx.client.getRun(runId) as any;
      expect(['binding_session', 'running', 'completed']).toContain(run.status);
    });

    it('worker accepts and completes task', async () => {
      const { runId } = await ctx.client.createRun(taskModeRequest());
      await sleep(500);

      // Worker accepts
      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskAccept',
        payload: { taskId: 'task-1' }
      });
      await sleep(200);

      // Worker sends progress update
      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskUpdate',
        payload: { taskId: 'task-1', progress: 0.5, message: 'Half done' }
      });
      await sleep(200);

      // Worker completes
      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskComplete',
        payload: {
          taskId: 'task-1',
          output: { result: 'success', itemsProcessed: 42 }
        }
      });

      await sleep(1000);

      const run = await ctx.client.getRun(runId) as any;
      expect(['running', 'completed']).toContain(run.status);
    });

    it('tracks task progress in projection', async () => {
      const { runId } = await ctx.client.createRun(taskModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskAccept',
        payload: { taskId: 'task-1' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskUpdate',
        payload: { taskId: 'task-1', progress: 0.5, message: 'Processing...' }
      });
      await sleep(500);

      const state = await ctx.client.getState(runId) as any;
      expect(state.participants).toBeDefined();
      expect(state.participants.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Task Rejection', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(taskRejectionScript());
    });

    it('worker rejects task', async () => {
      const { runId } = await ctx.client.createRun(taskModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskReject',
        payload: { taskId: 'task-1', reason: 'capacity' }
      });

      await sleep(1000);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Task Failure', () => {
    beforeAll(async () => {
      if (ctx) await ctx.app.close();
      ctx = await createTestApp(taskFailureScript());
    });

    it('worker accepts then fails task', async () => {
      const { runId } = await ctx.client.createRun(taskModeRequest());
      await sleep(500);

      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskAccept',
        payload: { taskId: 'task-1' }
      });
      await sleep(200);

      await ctx.client.sendMessage(runId, {
        from: 'worker',
        to: ['requester'],
        messageType: 'TaskFail',
        payload: { taskId: 'task-1', error: 'Processing failed', retryable: true }
      });

      await sleep(1000);

      const events = await ctx.client.listEvents(runId) as any[];
      const sentEvents = events.filter((e: any) => e.type === 'message.sent');
      expect(sentEvents.length).toBeGreaterThanOrEqual(2);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
