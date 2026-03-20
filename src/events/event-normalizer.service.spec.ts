import { EventNormalizerService } from './event-normalizer.service';
import { ProtoRegistryService } from '../runtime/proto-registry.service';
import { RawRuntimeEvent, NormalizeContext } from '../contracts/runtime';
import { ExecutionRequest } from '../contracts/control-plane';

function makeContext(overrides?: Partial<NormalizeContext>): NormalizeContext {
  return {
    knownParticipants: new Set<string>(),
    runtimeSessionId: 'session-1',
    execution: {
      mode: 'live',
      runtime: { kind: 'rust', version: '0.1.0' },
      session: {
        modeName: 'decision',
        modeVersion: '1.0.0',
        configurationVersion: '1.0.0',
        ttlMs: 30000,
        participants: [{ id: 'agent-a' }, { id: 'agent-b' }],
      },
    } as ExecutionRequest,
    ...overrides,
  };
}

function makeEnvelope(overrides?: Record<string, unknown>) {
  return {
    macpVersion: '1.0',
    mode: 'macp.mode.decision.v1',
    messageType: 'Signal',
    messageId: 'msg-1',
    sessionId: 'session-1',
    sender: 'agent-a',
    timestampUnixMs: Date.now(),
    payload: Buffer.from('{}'),
    ...overrides,
  };
}

describe('EventNormalizerService', () => {
  let service: EventNormalizerService;
  let protoRegistry: jest.Mocked<ProtoRegistryService>;

  beforeEach(() => {
    protoRegistry = {
      decodeKnown: jest.fn().mockReturnValue(undefined),
      getKnownTypeName: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ProtoRegistryService>;

    service = new EventNormalizerService(protoRegistry);
  });

  describe('stream-status events', () => {
    it('should produce session.stream.opened event', () => {
      const raw: RawRuntimeEvent = {
        kind: 'stream-status',
        receivedAt: '2026-01-01T00:00:00.000Z',
        streamStatus: { status: 'opened', detail: 'connected' },
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session.stream.opened');
      expect(events[0].runId).toBe('run-1');
      expect(events[0].subject).toEqual({ kind: 'session', id: 'session-1' });
      expect(events[0].data).toEqual(
        expect.objectContaining({ status: 'opened', detail: 'connected' }),
      );
    });
  });

  describe('session-snapshot events', () => {
    it('should produce session.state.changed with snapshot state', () => {
      const raw: RawRuntimeEvent = {
        kind: 'session-snapshot',
        receivedAt: '2026-01-01T00:00:00.000Z',
        sessionSnapshot: {
          sessionId: 'session-1',
          mode: 'decision',
          state: 'SESSION_STATE_OPEN',
          startedAtUnixMs: 1000,
          expiresAtUnixMs: 31000,
          modeVersion: '1.0.0',
          configurationVersion: '1.0.0',
        },
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session.state.changed');
      expect(events[0].subject).toEqual({ kind: 'session', id: 'session-1' });
      expect(events[0].data).toEqual(
        expect.objectContaining({
          sessionId: 'session-1',
          state: 'SESSION_STATE_OPEN',
          modeName: 'decision',
          modeVersion: '1.0.0',
        }),
      );
    });

    it('should return empty array when session-snapshot has no sessionSnapshot data', () => {
      const raw: RawRuntimeEvent = {
        kind: 'session-snapshot',
        receivedAt: '2026-01-01T00:00:00.000Z',
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events).toHaveLength(0);
    });
  });

  describe('stream-envelope events', () => {
    it('should produce message.received event', () => {
      const envelope = makeEnvelope({ messageType: 'Signal' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext({ knownParticipants: new Set(['agent-a']) });

      const events = service.normalize('run-1', raw, ctx);

      const messageReceived = events.find((e) => e.type === 'message.received');
      expect(messageReceived).toBeDefined();
      expect(messageReceived!.subject).toEqual({ kind: 'message', id: 'msg-1' });
      expect(messageReceived!.data).toEqual(
        expect.objectContaining({
          messageType: 'Signal',
          messageId: 'msg-1',
          sender: 'agent-a',
          sessionId: 'session-1',
        }),
      );
    });

    it('should generate participant.seen event for unknown participant', () => {
      const envelope = makeEnvelope({ sender: 'new-agent' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      const participantSeen = events.find((e) => e.type === 'participant.seen');
      expect(participantSeen).toBeDefined();
      expect(participantSeen!.subject).toEqual({ kind: 'participant', id: 'new-agent' });
      expect(participantSeen!.data).toEqual(
        expect.objectContaining({ participantId: 'new-agent' }),
      );
      expect(ctx.knownParticipants.has('new-agent')).toBe(true);
    });

    it('should NOT generate participant.seen event for already known participant', () => {
      const envelope = makeEnvelope({ sender: 'agent-a' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext({ knownParticipants: new Set(['agent-a']) });

      const events = service.normalize('run-1', raw, ctx);

      const participantSeen = events.find((e) => e.type === 'participant.seen');
      expect(participantSeen).toBeUndefined();
    });

    it('should produce signal.emitted derived event for Signal messageType', () => {
      const envelope = makeEnvelope({ messageType: 'Signal' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext({ knownParticipants: new Set(['agent-a']) });

      const events = service.normalize('run-1', raw, ctx);

      const signalEmitted = events.find((e) => e.type === 'signal.emitted');
      expect(signalEmitted).toBeDefined();
      expect(signalEmitted!.subject).toEqual({ kind: 'signal', id: 'msg-1' });
      expect(signalEmitted!.data).toEqual(
        expect.objectContaining({
          messageType: 'Signal',
          sender: 'agent-a',
        }),
      );
    });

    it('should produce decision.finalized AND session.state.changed for Commitment messageType', () => {
      const decoded = { commitmentId: 'commit-1', action: 'approve' };
      protoRegistry.decodeKnown.mockReturnValue(decoded);

      const envelope = makeEnvelope({ messageType: 'Commitment' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext({ knownParticipants: new Set(['agent-a']) });

      const events = service.normalize('run-1', raw, ctx);

      const decisionFinalized = events.find((e) => e.type === 'decision.finalized');
      expect(decisionFinalized).toBeDefined();
      expect(decisionFinalized!.subject).toEqual({ kind: 'decision', id: 'msg-1' });

      const stateChanged = events.find((e) => e.type === 'session.state.changed');
      expect(stateChanged).toBeDefined();
      expect(stateChanged!.subject).toEqual({ kind: 'session', id: 'session-1' });
      expect(stateChanged!.data).toEqual(
        expect.objectContaining({
          state: 'SESSION_STATE_RESOLVED',
          reason: 'Commitment observed on stream',
          commitmentId: 'commit-1',
          action: 'approve',
        }),
      );
    });

    it('should produce proposal.created derived event for Proposal messageType', () => {
      const envelope = makeEnvelope({ messageType: 'Proposal' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext({ knownParticipants: new Set(['agent-a']) });

      const events = service.normalize('run-1', raw, ctx);

      const proposalCreated = events.find((e) => e.type === 'proposal.created');
      expect(proposalCreated).toBeDefined();
      expect(proposalCreated!.subject).toEqual({ kind: 'proposal', id: 'msg-1' });
    });

    it('should produce proposal.updated for response message types like Evaluation', () => {
      const envelope = makeEnvelope({ messageType: 'Evaluation' });
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
        envelope,
      };
      const ctx = makeContext({ knownParticipants: new Set(['agent-a']) });

      const events = service.normalize('run-1', raw, ctx);

      const proposalUpdated = events.find((e) => e.type === 'proposal.updated');
      expect(proposalUpdated).toBeDefined();
      expect(proposalUpdated!.subject).toEqual({ kind: 'proposal', id: 'msg-1' });
    });
  });

  describe('unknown event kinds', () => {
    it('should produce message.sent for send-ack kind', () => {
      const raw: RawRuntimeEvent = {
        kind: 'send-ack',
        receivedAt: '2026-01-01T00:00:00.000Z',
        ack: {
          ok: true,
          duplicate: false,
          messageId: 'msg-1',
          sessionId: 'session-1',
          acceptedAtUnixMs: Date.now(),
          sessionState: 'SESSION_STATE_OPEN',
        },
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message.sent');
      expect(events[0].data.messageId).toBe('msg-1');
    });

    it('should return empty array for stream-envelope without envelope data', () => {
      const raw: RawRuntimeEvent = {
        kind: 'stream-envelope',
        receivedAt: '2026-01-01T00:00:00.000Z',
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events).toHaveLength(0);
    });
  });

  describe('event structure', () => {
    it('should set source to runtime with rawType', () => {
      const raw: RawRuntimeEvent = {
        kind: 'stream-status',
        receivedAt: '2026-01-01T00:00:00.000Z',
        streamStatus: { status: 'opened' },
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events[0].source).toEqual({
        kind: 'runtime',
        name: 'rust-runtime',
        rawType: 'stream-status',
      });
    });

    it('should set ts from rawEvent.receivedAt', () => {
      const ts = '2026-03-18T12:00:00.000Z';
      const raw: RawRuntimeEvent = {
        kind: 'stream-status',
        receivedAt: ts,
        streamStatus: { status: 'opened' },
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events[0].ts).toBe(ts);
    });

    it('should include a unique id and seq 0 on each event', () => {
      const raw: RawRuntimeEvent = {
        kind: 'stream-status',
        receivedAt: '2026-01-01T00:00:00.000Z',
        streamStatus: { status: 'opened' },
      };
      const ctx = makeContext();

      const events = service.normalize('run-1', raw, ctx);

      expect(events[0].id).toBeDefined();
      expect(typeof events[0].id).toBe('string');
      expect(events[0].seq).toBe(0);
    });
  });
});
