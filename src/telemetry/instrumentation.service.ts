import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class InstrumentationService implements OnModuleInit {
  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status_code'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status_code'] as const
  });

  readonly activeSseConnections = new client.Gauge({
    name: 'active_sse_connections',
    help: 'Number of active SSE connections'
  });

  readonly activeStreams = new client.Gauge({
    name: 'active_runtime_streams',
    help: 'Number of active runtime gRPC streams'
  });

  readonly runStateTotal = new client.Counter({
    name: 'run_state_transitions_total',
    help: 'Total run state transitions',
    labelNames: ['status'] as const
  });

  readonly grpcCallDuration = new client.Histogram({
    name: 'grpc_call_duration_seconds',
    help: 'Duration of gRPC calls to runtime in seconds',
    labelNames: ['method', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30]
  });

  readonly circuitBreakerState = new client.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=half_open, 2=open)'
  });

  onModuleInit(): void {
    client.collectDefaultMetrics();
  }

  async getMetrics(): Promise<string> {
    return client.register.metrics();
  }

  getContentType(): string {
    return client.register.contentType;
  }
}
