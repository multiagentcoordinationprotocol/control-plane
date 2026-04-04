import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ThrottleByUserGuard } from './auth/throttle-by-user.guard';
import { ConfigModule } from './config/config.module';
import { AdminController } from './controllers/admin.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AuditController } from './controllers/audit.controller';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { ObservabilityController } from './controllers/observability.controller';
import { RunInsightsController } from './controllers/run-insights.controller';
import { RunsController } from './controllers/runs.controller';
import { RuntimeController } from './controllers/runtime.controller';
import { DatabaseModule } from './db/database.module';
import { ArtifactService } from './artifacts/artifact.service';
import { AuditService } from './audit/audit.service';
import { EventNormalizerService } from './events/event-normalizer.service';
import { RunEventService } from './events/run-event.service';
import { StreamHubService } from './events/stream-hub.service';
import { MetricsService } from './metrics/metrics.service';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
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
import { OutboundMessageRepository } from './storage/outbound-message.repository';
import { RunRepository } from './storage/run.repository';
import { RuntimeSessionRepository } from './storage/runtime-session.repository';
import { InstrumentationService } from './telemetry/instrumentation.service';
import { TraceService } from './telemetry/trace.service';
import { RunInsightsService } from './insights/run-insights.service';
import { RunExecutorService } from './runs/run-executor.service';
import { RunManagerService } from './runs/run-manager.service';
import { RunRecoveryService } from './runs/run-recovery.service';
import { StreamConsumerService } from './runs/stream-consumer.service';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookDeliveryRepository } from './webhooks/webhook-delivery.repository';
import { WebhookRepository } from './webhooks/webhook.repository';
import { WebhookService } from './webhooks/webhook.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
  ],
  controllers: [RunsController, RunInsightsController, RuntimeController, ObservabilityController, HealthController, MetricsController, AdminController, AuditController, WebhookController, DashboardController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottleByUserGuard },
    InstrumentationService,
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
    OutboundMessageRepository,
    StreamHubService,
    EventNormalizerService,
    ProjectionService,
    MetricsService,
    ArtifactService,
    AuditService,
    RunEventService,
    ReplayService,
    RunManagerService,
    StreamConsumerService,
    RunExecutorService,
    RunRecoveryService,
    RunInsightsService,
    WebhookRepository,
    WebhookDeliveryRepository,
    WebhookService,
    DashboardService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
