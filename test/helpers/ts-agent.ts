import { TestClient } from './test-client';
import { TestSSEClient, SSEEvent } from './sse-client';

export interface AgentRule {
  when: {
    eventType?: string;
    messageType?: string;
    fromParticipant?: string;
  };
  then: {
    delayMs?: number;
    messageType: string;
    payload:
      | Record<string, unknown>
      | ((event: Record<string, unknown>) => Record<string, unknown>);
    to?: string[];
  };
}

/**
 * Rule-based TypeScript agent for integration testing.
 * Subscribes to SSE events and sends messages based on matching rules.
 * Deterministic — no LLM calls.
 */
export class TypeScriptAgent {
  private sseClient: TestSSEClient | null = null;
  private running = false;
  readonly actionsPerformed: Array<{
    rule: AgentRule;
    event: Record<string, unknown>;
    response: Record<string, unknown>;
  }> = [];

  constructor(
    private readonly client: TestClient,
    private readonly baseUrl: string,
    private readonly participantId: string,
    private readonly rules: AgentRule[],
    private readonly apiKey?: string
  ) {}

  /**
   * Start the agent loop: subscribe to SSE, match rules, send messages.
   * Returns when the stream ends or the run reaches a terminal state.
   */
  async run(runId: string, timeoutMs = 30000): Promise<void> {
    this.running = true;
    this.sseClient = new TestSSEClient(this.baseUrl, this.apiKey);
    this.sseClient.connect(runId, { includeSnapshot: true });

    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.running = false;
        this.sseClient?.close();
        reject(
          new Error(
            `Agent ${this.participantId} timed out after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      const processEvents = async () => {
        let lastProcessed = 0;

        while (this.running) {
          // Check for new events
          const events = this.sseClient!.events.slice(lastProcessed);
          lastProcessed = this.sseClient!.events.length;

          for (const event of events) {
            // Check for terminal state in snapshot
            if (event.type === 'snapshot') {
              const snapshot = event.data as Record<string, unknown>;
              const run = snapshot.run as Record<string, unknown> | undefined;
              if (run) {
                const status = run.status as string;
                if (['completed', 'failed', 'cancelled'].includes(status)) {
                  this.running = false;
                  clearTimeout(timer);
                  resolve();
                  return;
                }
              }
            }

            if (event.type === 'canonical_event') {
              await this.processEvent(runId, event);
            }
          }

          // Check if stream closed
          if (this.sseClient!.events.length > 0) {
            const lastEvent = this.sseClient!.events[this.sseClient!.events.length - 1];
            if (lastEvent.type === 'snapshot') {
              const snap = lastEvent.data as Record<string, unknown>;
              const run = snap.run as Record<string, unknown> | undefined;
              if (
                run &&
                ['completed', 'failed', 'cancelled'].includes(
                  run.status as string
                )
              ) {
                this.running = false;
                clearTimeout(timer);
                resolve();
                return;
              }
            }
          }

          await sleep(100);

          if (Date.now() - startTime > timeoutMs) break;
        }

        clearTimeout(timer);
        resolve();
      };

      processEvents().catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  stop(): void {
    this.running = false;
    this.sseClient?.close();
  }

  private async processEvent(runId: string, sseEvent: SSEEvent): Promise<void> {
    const canonical = sseEvent.data as Record<string, unknown>;
    const eventType = canonical.type as string;
    const data = canonical.data as Record<string, unknown> | undefined;

    for (const rule of this.rules) {
      if (!this.matches(eventType, data, rule.when)) continue;

      if (rule.then.delayMs) {
        await sleep(rule.then.delayMs);
      }

      const payload =
        typeof rule.then.payload === 'function'
          ? rule.then.payload(canonical)
          : rule.then.payload;

      try {
        await this.client.sendMessage(runId, {
          from: this.participantId,
          to: rule.then.to,
          messageType: rule.then.messageType,
          payload
        });

        this.actionsPerformed.push({
          rule,
          event: canonical,
          response: payload
        });
      } catch (err) {
        // Message send can fail if run already completed
        if (this.running) {
          console.warn(
            `Agent ${this.participantId} failed to send ${rule.then.messageType}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      // Only fire the first matching rule per event
      break;
    }
  }

  private matches(
    eventType: string,
    data: Record<string, unknown> | undefined,
    when: AgentRule['when']
  ): boolean {
    if (when.eventType && eventType !== when.eventType) return false;

    if (when.messageType && data) {
      const msgType = data.messageType as string | undefined;
      if (msgType !== when.messageType) return false;
    }

    if (when.fromParticipant && data) {
      const sender = data.sender as string | undefined;
      const from = data.from as string | undefined;
      if (sender !== when.fromParticipant && from !== when.fromParticipant)
        return false;
    }

    return true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
