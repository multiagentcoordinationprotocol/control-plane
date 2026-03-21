import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  RawRuntimeEvent,
  RuntimeAck,
  RuntimeCancelResult,
  RuntimeCancelSessionRequest,
  RuntimeGetSessionRequest,
  RuntimeHealth,
  RuntimeInitializeRequest,
  RuntimeInitializeResult,
  RuntimeManifestResult,
  RuntimeModeDescriptor,
  RuntimeOpenSessionRequest,
  RuntimeProvider,
  RuntimeRootDescriptor,
  RuntimeSendRequest,
  RuntimeSendResult,
  RuntimeSessionHandle,
  RuntimeSessionSnapshot,
  RuntimeStartSessionRequest,
  RuntimeStartSessionResult,
  RuntimeStreamSessionRequest
} from '../contracts/runtime';

@Injectable()
export class MockRuntimeProvider implements RuntimeProvider {
  readonly kind = 'mock';
  private readonly logger = new Logger(MockRuntimeProvider.name);

  async initialize(_req: RuntimeInitializeRequest): Promise<RuntimeInitializeResult> {
    return {
      selectedProtocolVersion: '1.0',
      runtimeInfo: { name: 'mock-runtime', version: '0.0.1' },
      supportedModes: ['mock-decision', 'mock-task']
    };
  }

  openSession(req: RuntimeOpenSessionRequest): RuntimeSessionHandle {
    const sessionId = randomUUID();
    const initiator = req.execution.session.participants[0]?.id ?? 'mock-initiator';
    const ack = this.makeAck(sessionId);

    const events: AsyncIterable<RawRuntimeEvent> = {
      [Symbol.asyncIterator]() {
        let done = false;
        return {
          async next(): Promise<IteratorResult<RawRuntimeEvent>> {
            if (done) return { done: true, value: undefined };
            done = true;
            return {
              done: false,
              value: {
                kind: 'stream-status',
                receivedAt: new Date().toISOString(),
                streamStatus: { status: 'opened' }
              }
            };
          },
          async return(): Promise<IteratorResult<RawRuntimeEvent>> {
            done = true;
            return { done: true, value: undefined };
          }
        };
      }
    };

    return {
      send: () => { /* no-op */ },
      events,
      closeWrite: () => { /* no-op */ },
      abort: () => { /* no-op */ },
      sessionAck: Promise.resolve({
        runtimeSessionId: sessionId,
        initiator,
        ack
      })
    };
  }

  async startSession(req: RuntimeStartSessionRequest): Promise<RuntimeStartSessionResult> {
    const sessionId = randomUUID();
    return {
      runtimeSessionId: sessionId,
      initiator: req.execution.session.participants[0]?.id ?? 'mock-initiator',
      ack: this.makeAck(sessionId)
    };
  }

  async send(req: RuntimeSendRequest): Promise<RuntimeSendResult> {
    const messageId = randomUUID();
    return {
      ack: this.makeAck(req.runtimeSessionId, messageId),
      envelope: {
        macpVersion: '1.0',
        mode: req.modeName,
        messageType: req.messageType,
        messageId,
        sessionId: req.runtimeSessionId,
        sender: req.from,
        timestampUnixMs: Date.now(),
        payload: req.payload
      }
    };
  }

  async *streamSession(_req: RuntimeStreamSessionRequest): AsyncIterable<RawRuntimeEvent> {
    yield {
      kind: 'stream-status',
      receivedAt: new Date().toISOString(),
      streamStatus: { status: 'opened' }
    };
    // Mock stream ends immediately
  }

  async getSession(req: RuntimeGetSessionRequest): Promise<RuntimeSessionSnapshot> {
    return {
      sessionId: req.runtimeSessionId,
      mode: 'mock-decision',
      state: 'SESSION_STATE_OPEN'
    };
  }

  async cancelSession(_req: RuntimeCancelSessionRequest): Promise<RuntimeCancelResult> {
    return { ack: this.makeAck(_req.runtimeSessionId) };
  }

  async getManifest(): Promise<RuntimeManifestResult> {
    return {
      agentId: 'mock-runtime',
      title: 'Mock Runtime',
      description: 'A mock runtime for testing',
      supportedModes: ['mock-decision', 'mock-task'],
      metadata: {}
    };
  }

  async listModes(): Promise<RuntimeModeDescriptor[]> {
    return [
      {
        mode: 'mock-decision',
        modeVersion: '1.0',
        title: 'Mock Decision',
        messageTypes: ['Proposal', 'Vote', 'Commitment'],
        terminalMessageTypes: ['Commitment']
      }
    ];
  }

  async listRoots(): Promise<RuntimeRootDescriptor[]> {
    return [];
  }

  async health(): Promise<RuntimeHealth> {
    return { ok: true, runtimeKind: this.kind, detail: 'mock runtime always healthy' };
  }

  private makeAck(sessionId: string, messageId?: string): RuntimeAck {
    return {
      ok: true,
      duplicate: false,
      messageId: messageId ?? randomUUID(),
      sessionId,
      acceptedAtUnixMs: Date.now(),
      sessionState: 'SESSION_STATE_OPEN'
    };
  }
}
