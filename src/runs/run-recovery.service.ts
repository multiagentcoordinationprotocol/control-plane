import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ExecutionRequest } from '../contracts/control-plane';
import { AppConfigService } from '../config/app-config.service';
import { RunEventService } from '../events/run-event.service';
import { RunRepository } from '../storage/run.repository';
import { RuntimeSessionRepository } from '../storage/runtime-session.repository';
import { RunManagerService } from './run-manager.service';
import { StreamConsumerService } from './stream-consumer.service';

@Injectable()
export class RunRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RunRecoveryService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly runRepository: RunRepository,
    private readonly runtimeSessionRepository: RuntimeSessionRepository,
    private readonly runManager: RunManagerService,
    private readonly streamConsumer: StreamConsumerService,
    private readonly eventService: RunEventService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.runRecoveryEnabled) {
      this.logger.log('run recovery disabled');
      return;
    }
    await this.recoverActiveRuns();
  }

  async recoverActiveRuns(): Promise<void> {
    const activeRuns = await this.runRepository.listActiveRuns();
    if (activeRuns.length === 0) {
      this.logger.log('no active runs to recover');
      return;
    }
    this.logger.log(`recovering ${activeRuns.length} active run(s)`);

    for (const run of activeRuns) {
      try {
        await this.recoverRun(run);
      } catch (error) {
        this.logger.error(
          `failed to recover run ${run.id}: ${error instanceof Error ? error.message : String(error)}`
        );
        try {
          await this.runManager.markFailed(run.id, error);
        } catch (markError) {
          this.logger.error(
            `failed to mark run ${run.id} as failed: ${markError instanceof Error ? markError.message : String(markError)}`
          );
        }
      }
    }
  }

  private async recoverRun(run: {
    id: string;
    status: string;
    runtimeKind: string;
    runtimeSessionId: string | null;
    lastEventSeq: number;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const executionRequest = run.metadata?.executionRequest as ExecutionRequest | undefined;
    if (!executionRequest) {
      throw new Error('missing executionRequest in run metadata');
    }

    const session = await this.runtimeSessionRepository.findByRunId(run.id);
    const runtimeSessionId = run.runtimeSessionId ?? session?.runtimeSessionId;
    if (!runtimeSessionId) {
      throw new Error('no runtime session ID available for recovery');
    }

    const subscriberId =
      session?.initiatorParticipantId ??
      executionRequest.session.initiatorParticipantId ??
      executionRequest.session.participants[0]?.id ??
      'control-plane';

    // Promote binding_session → running if needed
    if (run.status === 'binding_session') {
      await this.runManager.markRunning(run.id, runtimeSessionId);
    }

    await this.eventService.emitControlPlaneEvents(run.id, [
      {
        ts: new Date().toISOString(),
        type: 'session.stream.opened',
        source: { kind: 'control-plane', name: 'run-recovery' },
        subject: { kind: 'session', id: runtimeSessionId },
        data: { status: 'recovered', detail: 'stream resumed after restart' }
      }
    ]);

    await this.streamConsumer.start({
      runId: run.id,
      execution: executionRequest,
      runtimeKind: run.runtimeKind,
      runtimeSessionId,
      subscriberId,
      resumeFromSeq: run.lastEventSeq
    });

    this.logger.log(`recovered run ${run.id} from seq ${run.lastEventSeq}`);
  }
}
