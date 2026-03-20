import { Injectable } from '@nestjs/common';
import { Span, SpanStatusCode, context, trace } from '@opentelemetry/api';

@Injectable()
export class TraceService {
  private readonly tracer = trace.getTracer('macp-control-plane');
  private readonly runSpans = new Map<string, Span>();

  async withSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean | undefined>,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(name);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) span.setAttribute(key, value);
    });

    try {
      return await context.with(trace.setSpan(context.active(), span), fn);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      span.end();
    }
  }

  startRunTrace(runId: string, attributes: Record<string, string | number | boolean | undefined>): string {
    const span = this.tracer.startSpan('run.lifecycle');
    span.setAttribute('run_id', runId);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) span.setAttribute(key, value);
    });
    const traceId = span.spanContext().traceId;
    // Keep span alive — end it when run reaches terminal state
    this.runSpans.set(runId, span);
    return traceId;
  }

  endRunTrace(runId: string, status: 'completed' | 'failed' | 'cancelled', error?: string): void {
    const span = this.runSpans.get(runId);
    if (!span) return;
    this.runSpans.delete(runId);

    span.setAttribute('run.terminal_status', status);
    if (status === 'failed') {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error ?? 'run failed' });
      if (error) span.recordException(new Error(error));
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    span.end();
  }
}
