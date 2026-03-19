import { Injectable } from '@nestjs/common';
import { CanonicalEvent, MetricsSummary } from '../contracts/control-plane';
import { MetricsRepository } from '../storage/metrics.repository';

function safeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

@Injectable()
export class MetricsService {
  constructor(private readonly repository: MetricsRepository) {}

  async recordEvents(runId: string, events: CanonicalEvent[]): Promise<MetricsSummary> {
    const current = (await this.repository.get(runId)) ?? {
      runId,
      eventCount: 0,
      messageCount: 0,
      signalCount: 0,
      proposalCount: 0,
      toolCallCount: 0,
      decisionCount: 0,
      streamReconnectCount: 0,
      counters: {},
      updatedAt: new Date().toISOString()
    };

    let firstEventAt = current.firstEventAt as string | undefined;
    let lastEventAt = current.lastEventAt as string | undefined;
    let eventCount = safeNumber(current.eventCount);
    let messageCount = safeNumber(current.messageCount);
    let signalCount = safeNumber(current.signalCount);
    let proposalCount = safeNumber(current.proposalCount);
    let toolCallCount = safeNumber(current.toolCallCount);
    let decisionCount = safeNumber(current.decisionCount);
    let streamReconnectCount = safeNumber(current.streamReconnectCount);
    let sessionState = current.sessionState as string | undefined;

    for (const event of events) {
      eventCount += 1;
      firstEventAt ??= event.ts;
      lastEventAt = event.ts;
      if (event.type.startsWith('message.')) messageCount += 1;
      if (event.type === 'signal.emitted') signalCount += 1;
      if (event.type.startsWith('proposal.')) proposalCount += 1;
      if (event.type.startsWith('tool.')) toolCallCount += 1;
      if (event.type === 'decision.finalized' || event.type === 'decision.proposed') decisionCount += 1;
      if (event.type === 'session.stream.opened' && event.data.status === 'reconnecting') streamReconnectCount += 1;
      if (event.type === 'session.state.changed' && typeof event.data.state === 'string') {
        sessionState = event.data.state;
      }
    }

    const durationMs = firstEventAt && lastEventAt
      ? new Date(lastEventAt).getTime() - new Date(firstEventAt).getTime()
      : undefined;

    const persisted = await this.repository.upsert(runId, {
      runId,
      eventCount,
      messageCount,
      signalCount,
      proposalCount,
      toolCallCount,
      decisionCount,
      streamReconnectCount,
      firstEventAt,
      lastEventAt,
      durationMs,
      sessionState,
      counters: {}
    });

    return {
      runId,
      eventCount: safeNumber(persisted?.eventCount ?? eventCount),
      messageCount: safeNumber(persisted?.messageCount ?? messageCount),
      signalCount: safeNumber(persisted?.signalCount ?? signalCount),
      proposalCount: safeNumber(persisted?.proposalCount ?? proposalCount),
      toolCallCount: safeNumber(persisted?.toolCallCount ?? toolCallCount),
      decisionCount: safeNumber(persisted?.decisionCount ?? decisionCount),
      streamReconnectCount: safeNumber(persisted?.streamReconnectCount ?? streamReconnectCount),
      firstEventAt: persisted?.firstEventAt as string | undefined,
      lastEventAt: persisted?.lastEventAt as string | undefined,
      durationMs: persisted?.durationMs as number | undefined,
      sessionState: persisted?.sessionState as MetricsSummary['sessionState']
    };
  }

  async get(runId: string): Promise<MetricsSummary | null> {
    const persisted = await this.repository.get(runId);
    if (!persisted) return null;
    return {
      runId,
      eventCount: safeNumber(persisted.eventCount),
      messageCount: safeNumber(persisted.messageCount),
      signalCount: safeNumber(persisted.signalCount),
      proposalCount: safeNumber(persisted.proposalCount),
      toolCallCount: safeNumber(persisted.toolCallCount),
      decisionCount: safeNumber(persisted.decisionCount),
      streamReconnectCount: safeNumber(persisted.streamReconnectCount),
      firstEventAt: persisted.firstEventAt as string | undefined,
      lastEventAt: persisted.lastEventAt as string | undefined,
      durationMs: persisted.durationMs as number | undefined,
      sessionState: persisted.sessionState as MetricsSummary['sessionState']
    };
  }
}
