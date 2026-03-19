import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ExecutionRequest } from '../contracts/control-plane';
import { ArtifactService } from '../artifacts/artifact.service';
import { AppConfigService } from '../config/app-config.service';
import { RunEventService } from '../events/run-event.service';
import { StreamHubService } from '../events/stream-hub.service';
import { ProtoRegistryService } from '../runtime/proto-registry.service';
import { RuntimeProviderRegistry } from '../runtime/runtime-provider.registry';
import { TraceService } from '../telemetry/trace.service';
import { RunRepository } from '../storage/run.repository';
import { RuntimeSessionRepository } from '../storage/runtime-session.repository';
import { RunManagerService } from './run-manager.service';
import { StreamConsumerService } from './stream-consumer.service';

@Injectable()
export class RunExecutorService {
  private readonly logger = new Logger(RunExecutorService.name);

  constructor(
    private readonly runManager: RunManagerService,
    private readonly runRepository: RunRepository,
    private readonly runtimeSessionRepository: RuntimeSessionRepository,
    private readonly runtimeRegistry: RuntimeProviderRegistry,
    private readonly protoRegistry: ProtoRegistryService,
    private readonly traceService: TraceService,
    private readonly eventService: RunEventService,
    private readonly artifactService: ArtifactService,
    private readonly streamConsumer: StreamConsumerService,
    private readonly streamHub: StreamHubService,
    private readonly config: AppConfigService
  ) {}

  async launch(request: ExecutionRequest) {
    if (request.mode === 'replay') {
      throw new BadRequestException('Use /runs/:id/replay for replay mode. POST /runs launches live or sandbox executions.');
    }

    const run = await this.runManager.createRun(request);
    void this.execute(run.id, request);
    return run;
  }

  async cancel(runId: string, reason?: string) {
    const run = await this.runManager.getRun(runId);
    if (!run.runtimeSessionId) {
      throw new BadRequestException('run has no bound runtime session');
    }
    const provider = this.runtimeRegistry.get(run.runtimeKind);
    const session = await this.runtimeSessionRepository.findByRunId(runId);
    const requesterId = session?.initiatorParticipantId ?? undefined;
    await provider.cancelSession({
      runId,
      runtimeSessionId: run.runtimeSessionId,
      reason,
      requesterId
    });
    const cancelled = await this.runManager.markCancelled(runId);
    await this.streamConsumer.stop(runId);
    this.streamHub.complete(runId);
    return cancelled;
  }

  private async execute(runId: string, request: ExecutionRequest): Promise<void> {
    const provider = this.runtimeRegistry.get(request.runtime.kind);
    const deadlineMs = this.config.runtimeRequestTimeoutMs;
    try {
      await this.runManager.markStarted(runId, request);

      await this.traceService.withSpan(
        'runtime.initialize',
        {
          run_id: runId,
          runtime_kind: request.runtime.kind,
          mode_name: request.session.modeName
        },
        async () => {
          await provider.initialize(
            { clientName: 'macp-control-plane', clientVersion: '0.1.0' },
            { deadline: new Date(Date.now() + deadlineMs) }
          );
        }
      );

      const session = await this.traceService.withSpan(
        'runtime.start_session',
        {
          run_id: runId,
          runtime_kind: request.runtime.kind,
          mode_name: request.session.modeName
        },
        async () => provider.startSession(
          { runId, execution: request },
          { deadline: new Date(Date.now() + deadlineMs) }
        )
      );

      await this.runManager.bindSession(runId, request, session);

      for (const message of request.kickoff ?? []) {
        try {
          const payload = message.payloadEnvelope
            ? this.protoRegistry.encodePayloadEnvelope(message.payloadEnvelope)
            : Buffer.from(JSON.stringify(message.payload ?? {}), 'utf8');

          const sendResult = await this.traceService.withSpan(
            'runtime.send_kickoff',
            {
              run_id: runId,
              runtime_kind: request.runtime.kind,
              mode_name: request.session.modeName,
              message_type: message.messageType,
              sender: message.from
            },
            async () =>
              provider.send({
                runId,
                runtimeSessionId: session.runtimeSessionId,
                modeName: request.session.modeName,
                from: message.from,
                to: message.to,
                messageType: message.messageType,
                payload,
                payloadDescriptor: (message.payloadEnvelope as unknown as Record<string, unknown>) ?? message.payload,
                metadata: message.metadata
              })
          );

          await this.eventService.emitControlPlaneEvents(runId, [
            {
              ts: new Date().toISOString(),
              type: 'message.sent',
              source: { kind: 'control-plane', name: 'run-executor' },
              subject: { kind: 'message', id: sendResult.envelope.messageId },
              data: {
                sessionId: session.runtimeSessionId,
                sender: message.from,
                to: message.to,
                messageType: message.messageType,
                kind: message.kind,
                ack: sendResult.ack,
                payloadDescriptor: (message.payloadEnvelope as unknown as Record<string, unknown>) ?? message.payload ?? {}
              }
            }
          ]);
        } catch (kickoffError) {
          this.logger.error(
            `kickoff message failed for run ${runId}, messageType=${message.messageType}: ${kickoffError instanceof Error ? kickoffError.message : String(kickoffError)}`
          );
          await this.eventService.emitControlPlaneEvents(runId, [
            {
              ts: new Date().toISOString(),
              type: 'message.send_failed',
              source: { kind: 'control-plane', name: 'run-executor' },
              subject: { kind: 'message', id: message.messageType },
              data: {
                sessionId: session.runtimeSessionId,
                sender: message.from,
                to: message.to,
                messageType: message.messageType,
                error: kickoffError instanceof Error ? kickoffError.message : String(kickoffError)
              }
            }
          ]);
          await this.runManager.markFailed(runId, kickoffError);
          return;
        }
      }

      const run = await this.runManager.markRunning(runId, session.runtimeSessionId);
      const subscriberId = session.initiator;

      await this.streamConsumer.start({
        runId,
        execution: request,
        runtimeKind: request.runtime.kind,
        runtimeSessionId: session.runtimeSessionId,
        subscriberId
      });

      if (run.traceId) {
        const artifact = await this.artifactService.register({
          runId,
          kind: 'trace',
          label: 'Root run trace',
          inline: { traceId: run.traceId }
        });
        await this.eventService.emitControlPlaneEvents(runId, [
          {
            ts: new Date().toISOString(),
            type: 'artifact.created',
            source: { kind: 'control-plane', name: 'run-executor' },
            subject: { kind: 'artifact', id: artifact.id },
            trace: { traceId: run.traceId },
            data: {
              kind: artifact.kind,
              label: artifact.label,
              traceId: run.traceId,
              artifactId: artifact.id
            }
          }
        ]);
      }
    } catch (error) {
      await this.runManager.markFailed(runId, error);
    }
  }
}
