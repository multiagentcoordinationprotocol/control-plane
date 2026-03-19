import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CanonicalEvent } from '../contracts/control-plane';
import { RawRuntimeEvent } from '../contracts/runtime';
import { DatabaseService } from '../db/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { ProjectionService } from '../projection/projection.service';
import { EventRepository } from '../storage/event.repository';
import { RunRepository } from '../storage/run.repository';
import { StreamHubService } from './stream-hub.service';

@Injectable()
export class RunEventService {
  constructor(
    private readonly database: DatabaseService,
    private readonly runRepository: RunRepository,
    private readonly eventRepository: EventRepository,
    private readonly projectionService: ProjectionService,
    private readonly metricsService: MetricsService,
    private readonly streamHub: StreamHubService
  ) {}

  async emitControlPlaneEvents(
    runId: string,
    partialEvents: Array<Omit<CanonicalEvent, 'id' | 'seq' | 'runId'>>
  ): Promise<CanonicalEvent[]> {
    if (partialEvents.length === 0) return [];

    const events = await this.database.db.transaction(async (tx) => {
      const startSeq = await this.runRepository.allocateSequence(runId, partialEvents.length);
      const prepared = partialEvents.map((event, index) => ({
        ...event,
        id: randomUUID(),
        runId,
        seq: startSeq + index
      }));
      await this.eventRepository.appendCanonical(prepared, tx);
      return prepared;
    });

    const projection = await this.projectionService.applyAndPersist(runId, events);
    await this.metricsService.recordEvents(runId, events);
    events.forEach((event) => this.streamHub.publishEvent(event));
    this.streamHub.publishSnapshot(runId, projection);
    return events;
  }

  async persistRawAndCanonical(
    runId: string,
    rawEvent: RawRuntimeEvent,
    canonicalEvents: CanonicalEvent[]
  ): Promise<CanonicalEvent[]> {
    const total = 1 + canonicalEvents.length;

    const normalized = await this.database.db.transaction(async (tx) => {
      const startSeq = await this.runRepository.allocateSequence(runId, total);
      await this.eventRepository.appendRaw(runId, startSeq, rawEvent, tx);
      const prepared = canonicalEvents.map((event, index) => ({
        ...event,
        seq: startSeq + index + 1,
        id: event.id || randomUUID()
      }));
      await this.eventRepository.appendCanonical(prepared, tx);
      return prepared;
    });

    const projection = await this.projectionService.applyAndPersist(runId, normalized);
    await this.metricsService.recordEvents(runId, normalized);
    normalized.forEach((event) => this.streamHub.publishEvent(event));
    this.streamHub.publishSnapshot(runId, projection);
    return normalized;
  }
}
