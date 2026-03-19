import { Injectable } from '@nestjs/common';

function readBoolean(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function readNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

@Injectable()
export class AppConfigService {
  readonly port = readNumber('PORT', 3001);
  readonly host = process.env.HOST ?? '0.0.0.0';
  readonly corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  readonly databaseUrl =
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/macp_control_plane';

  readonly runtimeKind = process.env.RUNTIME_KIND ?? 'rust';
  readonly runtimeAddress = process.env.RUNTIME_ADDRESS ?? '127.0.0.1:50051';
  readonly runtimeTls = readBoolean('RUNTIME_TLS', false);
  readonly runtimeAllowInsecure = readBoolean('RUNTIME_ALLOW_INSECURE', process.env.NODE_ENV === 'development');
  readonly runtimeBearerToken = process.env.RUNTIME_BEARER_TOKEN ?? '';
  readonly runtimeUseDevHeader = readBoolean('RUNTIME_USE_DEV_HEADER', process.env.NODE_ENV === 'development');
  readonly runtimeRequestTimeoutMs = readNumber('RUNTIME_REQUEST_TIMEOUT_MS', 30000);
  readonly runtimeDevAgentId = process.env.RUNTIME_DEV_AGENT_ID ?? 'control-plane';
  readonly runtimeStreamSubscriptionMessageType =
    process.env.RUNTIME_STREAM_SUBSCRIPTION_MESSAGE_TYPE ?? 'SessionWatch';
  readonly runtimeStreamSubscriberId =
    process.env.RUNTIME_STREAM_SUBSCRIBER_ID ?? this.runtimeDevAgentId;

  readonly streamIdleTimeoutMs = readNumber('STREAM_IDLE_TIMEOUT_MS', 120000);
  readonly streamMaxRetries = readNumber('STREAM_MAX_RETRIES', 5);
  readonly streamBackoffBaseMs = readNumber('STREAM_BACKOFF_BASE_MS', 250);
  readonly streamBackoffMaxMs = readNumber('STREAM_BACKOFF_MAX_MS', 30000);
  readonly replayMaxDelayMs = readNumber('REPLAY_MAX_DELAY_MS', 2000);
  readonly replayBatchSize = readNumber('REPLAY_BATCH_SIZE', 500);

  readonly dbPoolMax = readNumber('DB_POOL_MAX', 20);
  readonly dbPoolIdleTimeout = readNumber('DB_POOL_IDLE_TIMEOUT', 30000);
  readonly dbPoolConnectionTimeout = readNumber('DB_POOL_CONNECTION_TIMEOUT', 5000);

  readonly logLevel = process.env.LOG_LEVEL ?? 'info';
  readonly otelEnabled = readBoolean('OTEL_ENABLED', false);
  readonly otelServiceName = process.env.OTEL_SERVICE_NAME ?? 'macp-control-plane';
  readonly otelExporterOtlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '';
}
