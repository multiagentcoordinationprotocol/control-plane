import { Injectable } from '@nestjs/common';
import { SpanStatusCode, context, trace } from '@opentelemetry/api';

@Injectable()
export class TraceService {
  private readonly tracer = trace.getTracer('macp-control-plane');

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

  startRunTrace(runId: string, attributes: Record<string, string | number | boolean | undefined>) {
    const span = this.tracer.startSpan('run.lifecycle');
    span.setAttribute('run_id', runId);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) span.setAttribute(key, value);
    });
    const traceId = span.spanContext().traceId;
    span.end();
    return traceId;
  }
}
