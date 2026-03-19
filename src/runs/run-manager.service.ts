import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ExecutionRequest, RunStateProjection } from '../contracts/control-plane';
import { TraceService } from '../telemetry/trace.service';
import { ProjectionService } from '../projection/projection.service';
import { RunEventService } from '../events/run-event.service';
import { RunRepository } from '../storage/run.repository';
import { RuntimeSessionRepository } from '../storage/runtime-session.repository';

@Injectable()
export class RunManagerService {
  constructor(
    private readonly runRepository: RunRepository,
    private readonly runtimeSessionRepository: RuntimeSessionRepository,
    private readonly projectionService: ProjectionService,
    private readonly runEventService: RunEventService,
    private readonly traceService: TraceService
  ) {}

  async createRun(request: ExecutionRequest) {
    const idempotencyKey = request.execution?.idempotencyKey;
    if (idempotencyKey) {
      const existing = await this.runRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }

    const runId = randomUUID();
    const traceId = this.traceService.startRunTrace(runId, {
      runtime_kind: request.runtime.kind,
      mode_name: request.session.modeName,
      execution_mode: request.mode
    });

    const record = await this.runRepository.create({
      id: runId,
      status: 'queued',
      mode: request.mode,
      runtimeKind: request.runtime.kind,
      runtimeVersion: request.runtime.version,
      idempotencyKey,
      tags: request.execution?.tags ?? [],
      sourceKind: request.session.metadata?.source as string | undefined,
      sourceRef: request.session.metadata?.sourceRef as string | undefined,
      metadata: {
        executionRequest: request,
        requester: request.execution?.requester
      },
      traceId
    });

    await this.runEventService.emitControlPlaneEvents(record.id, [
      {
        ts: new Date().toISOString(),
        type: 'run.created',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'run', id: record.id },
        trace: { traceId },
        data: {
          status: record.status,
          modeName: request.session.modeName,
          runtimeKind: request.runtime.kind,
          runtimeVersion: request.runtime.version,
          traceId
        }
      }
    ]);

    return record;
  }

  async markStarted(runId: string, request: ExecutionRequest) {
    const run = await this.runRepository.markStarted(runId);
    await this.runEventService.emitControlPlaneEvents(runId, [
      {
        ts: new Date().toISOString(),
        type: 'run.started',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'run', id: runId },
        trace: run.traceId ? { traceId: run.traceId } : undefined,
        data: {
          status: 'starting',
          startedAt: run.startedAt,
          modeName: request.session.modeName,
          runtimeKind: request.runtime.kind,
          traceId: run.traceId
        }
      }
    ]);
    return run;
  }

  async bindSession(
    runId: string,
    request: ExecutionRequest,
    session: { runtimeSessionId: string; initiator: string; ack: { sessionState: string } }
  ) {
    const run = await this.runRepository.update(runId, {
      status: 'binding_session',
      runtimeSessionId: session.runtimeSessionId
    });
    await this.runtimeSessionRepository.upsert({
      runId,
      runtimeKind: request.runtime.kind,
      runtimeSessionId: session.runtimeSessionId,
      modeName: request.session.modeName,
      modeVersion: request.session.modeVersion,
      configurationVersion: request.session.configurationVersion,
      policyVersion: request.session.policyVersion,
      initiatorParticipantId: session.initiator,
      sessionState: session.ack.sessionState,
      lastSeenAt: new Date().toISOString(),
      metadata: {
        participants: request.session.participants,
        roots: request.session.roots ?? []
      }
    });

    const participantEvents = request.session.participants.map((participant) => ({
      ts: new Date().toISOString(),
      type: 'participant.seen' as const,
      source: { kind: 'control-plane' as const, name: 'run-manager' },
      subject: { kind: 'participant' as const, id: participant.id },
      data: {
        participantId: participant.id,
        role: participant.role,
        transportIdentity: participant.transportIdentity,
        status: 'idle'
      }
    }));

    await this.runEventService.emitControlPlaneEvents(runId, [
      {
        ts: new Date().toISOString(),
        type: 'session.bound',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'session', id: session.runtimeSessionId },
        data: {
          sessionId: session.runtimeSessionId,
          initiator: session.initiator,
          state: session.ack.sessionState,
          modeName: request.session.modeName,
          modeVersion: request.session.modeVersion,
          configurationVersion: request.session.configurationVersion,
          policyVersion: request.session.policyVersion,
          participants: request.session.participants.map((item) => item.id)
        }
      },
      ...participantEvents
    ]);

    return run;
  }

  async markRunning(runId: string, runtimeSessionId: string) {
    const run = await this.runRepository.markRunning(runId, runtimeSessionId);
    await this.runEventService.emitControlPlaneEvents(runId, [
      {
        ts: new Date().toISOString(),
        type: 'session.state.changed',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'session', id: runtimeSessionId },
        trace: run.traceId ? { traceId: run.traceId } : undefined,
        data: {
          sessionId: runtimeSessionId,
          state: 'SESSION_STATE_OPEN'
        }
      }
    ]);
    return run;
  }

  async markCompleted(runId: string) {
    const current = await this.getRun(runId);
    if (current.status === 'completed') return current;
    const run = await this.runRepository.markCompleted(runId);
    await this.runEventService.emitControlPlaneEvents(runId, [
      {
        ts: new Date().toISOString(),
        type: 'run.completed',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'run', id: runId },
        trace: run.traceId ? { traceId: run.traceId } : undefined,
        data: {
          status: 'completed',
          endedAt: run.endedAt,
          runtimeSessionId: run.runtimeSessionId,
          traceId: run.traceId
        }
      }
    ]);
    return run;
  }

  async markCancelled(runId: string) {
    const current = await this.getRun(runId);
    if (current.status === 'cancelled') return current;
    const run = await this.runRepository.markCancelled(runId);
    await this.runEventService.emitControlPlaneEvents(runId, [
      {
        ts: new Date().toISOString(),
        type: 'run.cancelled',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'run', id: runId },
        trace: run.traceId ? { traceId: run.traceId } : undefined,
        data: {
          status: 'cancelled',
          endedAt: run.endedAt,
          runtimeSessionId: run.runtimeSessionId,
          traceId: run.traceId
        }
      }
    ]);
    return run;
  }

  async markFailed(runId: string, error: unknown) {
    const current = await this.getRun(runId);
    if (current.status === 'failed') return current;
    const message = error instanceof Error ? error.message : String(error);
    const run = await this.runRepository.markFailed(runId, 'RUN_FAILED', message);
    await this.runEventService.emitControlPlaneEvents(runId, [
      {
        ts: new Date().toISOString(),
        type: 'run.failed',
        source: { kind: 'control-plane', name: 'run-manager' },
        subject: { kind: 'run', id: runId },
        trace: run.traceId ? { traceId: run.traceId } : undefined,
        data: {
          status: 'failed',
          endedAt: run.endedAt,
          runtimeSessionId: run.runtimeSessionId,
          traceId: run.traceId,
          error: message
        }
      }
    ]);
    return run;
  }

  async listRuns(filters: {
    status?: import('../contracts/control-plane').RunStatus;
    tags?: string[];
    createdAfter?: string;
    createdBefore?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    return this.runRepository.list(filters);
  }

  async getRun(runId: string) {
    const run = await this.runRepository.findById(runId);
    if (!run) throw new NotFoundException(`run ${runId} not found`);
    return run;
  }

  async getState(runId: string): Promise<RunStateProjection> {
    await this.getRun(runId);
    return (await this.projectionService.get(runId)) ?? this.projectionService.empty(runId);
  }
}
