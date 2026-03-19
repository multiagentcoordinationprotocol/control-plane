import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { HealthController } from './controllers/health.controller';
import { ObservabilityController } from './controllers/observability.controller';
import { RunsController } from './controllers/runs.controller';
import { RuntimeController } from './controllers/runtime.controller';
import { DatabaseModule } from './db/database.module';
import { ArtifactService } from './artifacts/artifact.service';
import { EventNormalizerService } from './events/event-normalizer.service';
import { RunEventService } from './events/run-event.service';
import { StreamHubService } from './events/stream-hub.service';
import { MetricsService } from './metrics/metrics.service';
import { ProjectionService } from './projection/projection.service';
import { ReplayService } from './replay/replay.service';
import { ProtoRegistryService } from './runtime/proto-registry.service';
import { RuntimeCredentialResolverService } from './runtime/runtime-credential-resolver.service';
import { RuntimeProviderRegistry } from './runtime/runtime-provider.registry';
import { RustRuntimeProvider } from './runtime/rust-runtime.provider';
import { EventRepository } from './storage/event.repository';
import { ArtifactRepository } from './storage/artifact.repository';
import { MetricsRepository } from './storage/metrics.repository';
import { ProjectionRepository } from './storage/projection.repository';
import { RunRepository } from './storage/run.repository';
import { RuntimeSessionRepository } from './storage/runtime-session.repository';
import { TraceService } from './telemetry/trace.service';
import { RunExecutorService } from './runs/run-executor.service';
import { RunManagerService } from './runs/run-manager.service';
import { StreamConsumerService } from './runs/stream-consumer.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
  ],
  controllers: [RunsController, RuntimeController, ObservabilityController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    TraceService,
    ProtoRegistryService,
    RuntimeCredentialResolverService,
    RustRuntimeProvider,
    RuntimeProviderRegistry,
    RunRepository,
    RuntimeSessionRepository,
    EventRepository,
    ProjectionRepository,
    ArtifactRepository,
    MetricsRepository,
    StreamHubService,
    EventNormalizerService,
    ProjectionService,
    MetricsService,
    ArtifactService,
    RunEventService,
    ReplayService,
    RunManagerService,
    StreamConsumerService,
    RunExecutorService
  ]
})
export class AppModule {}
