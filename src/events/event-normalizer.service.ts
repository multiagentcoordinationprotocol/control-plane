import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CanonicalEvent, CanonicalEventType } from '../contracts/control-plane';
import { EventNormalizer, NormalizeContext, RawRuntimeEvent } from '../contracts/runtime';
import { PROJECTION_SCHEMA_VERSION } from '../projection/projection.service';
import { ProtoRegistryService } from '../runtime/proto-registry.service';

@Injectable()
export class EventNormalizerService implements EventNormalizer {
  constructor(private readonly protoRegistry: ProtoRegistryService) {}

  normalize(runId: string, rawEvent: RawRuntimeEvent, ctx: NormalizeContext): CanonicalEvent[] {
    const ts = rawEvent.receivedAt;
    if (rawEvent.kind === 'stream-status') {
      return [
        this.makeEvent(runId, ts, 'session.stream.opened', {
          kind: 'session',
          id: ctx.runtimeSessionId
        }, {
          status: rawEvent.streamStatus?.status,
          detail: rawEvent.streamStatus?.detail
        }, 'stream-status')
      ];
    }

    if (rawEvent.kind === 'session-snapshot' && rawEvent.sessionSnapshot) {
      return [
        this.makeEvent(
          runId,
          ts,
          'session.state.changed',
          { kind: 'session', id: rawEvent.sessionSnapshot.sessionId },
          {
            sessionId: rawEvent.sessionSnapshot.sessionId,
            state: rawEvent.sessionSnapshot.state,
            startedAtUnixMs: rawEvent.sessionSnapshot.startedAtUnixMs,
            expiresAtUnixMs: rawEvent.sessionSnapshot.expiresAtUnixMs,
            modeName: rawEvent.sessionSnapshot.mode,
            modeVersion: rawEvent.sessionSnapshot.modeVersion,
            configurationVersion: rawEvent.sessionSnapshot.configurationVersion,
            policyVersion: rawEvent.sessionSnapshot.policyVersion
          },
          'session-snapshot'
        )
      ];
    }

    if (rawEvent.kind === 'send-ack' && rawEvent.ack) {
      return [
        this.makeEvent(
          runId,
          ts,
          'message.sent',
          { kind: 'message', id: rawEvent.ack.messageId },
          {
            messageId: rawEvent.ack.messageId,
            sessionId: rawEvent.ack.sessionId,
            ok: rawEvent.ack.ok,
            duplicate: rawEvent.ack.duplicate,
            sessionState: rawEvent.ack.sessionState,
            acceptedAtUnixMs: rawEvent.ack.acceptedAtUnixMs
          },
          'send-ack'
        )
      ];
    }

    if (rawEvent.kind !== 'stream-envelope' || !rawEvent.envelope) {
      return [];
    }

    const envelope = rawEvent.envelope;
    const decoded = this.protoRegistry.decodeKnown(envelope.mode, envelope.messageType, envelope.payload);
    const canonical: CanonicalEvent[] = [];

    if (!ctx.knownParticipants.has(envelope.sender)) {
      ctx.knownParticipants.add(envelope.sender);
      canonical.push(
        this.makeEvent(
          runId,
          ts,
          'participant.seen',
          { kind: 'participant', id: envelope.sender },
          { participantId: envelope.sender },
          envelope.messageType
        )
      );
    }

    canonical.push(
      this.makeEvent(
        runId,
        ts,
        'message.received',
        { kind: 'message', id: envelope.messageId },
        {
          modeName: envelope.mode,
          messageType: envelope.messageType,
          messageId: envelope.messageId,
          sessionId: envelope.sessionId,
          sender: envelope.sender,
          payload: decoded ?? { payloadBase64: envelope.payload.toString('base64') }
        },
        envelope.messageType
      )
    );

    const derivedType = this.deriveEventType(envelope.messageType);
    if (derivedType) {
      canonical.push(
        this.makeEvent(
          runId,
          ts,
          derivedType,
          this.deriveSubject(derivedType, envelope, decoded),
          {
            modeName: envelope.mode,
            messageType: envelope.messageType,
            messageId: envelope.messageId,
            sessionId: envelope.sessionId,
            sender: envelope.sender,
            decodedPayload: decoded,
            payloadTypeName: this.protoRegistry.getKnownTypeName(envelope.mode, envelope.messageType)
          },
          envelope.messageType
        )
      );
    }

    if (envelope.messageType === 'Commitment') {
      const commitment = decoded ?? {};
      canonical.push(
        this.makeEvent(
          runId,
          ts,
          'session.state.changed',
          { kind: 'session', id: envelope.sessionId },
          {
            state: 'SESSION_STATE_RESOLVED',
            reason: 'Commitment observed on stream',
            commitmentId: commitment.commitmentId,
            action: commitment.action
          },
          envelope.messageType
        )
      );
    }

    return canonical;
  }

  private deriveEventType(messageType: string): CanonicalEventType | null {
    if (messageType === 'Signal') return 'signal.emitted';
    if (messageType === 'Commitment') return 'decision.finalized';

    if (['Proposal', 'CounterProposal', 'ApprovalRequest', 'TaskRequest', 'HandoffOffer'].includes(messageType)) {
      return 'proposal.created';
    }

    if (
      [
        'Evaluation',
        'Objection',
        'Vote',
        'Accept',
        'Reject',
        'Withdraw',
        'Approve',
        'Abstain',
        'TaskAccept',
        'TaskReject',
        'TaskUpdate',
        'TaskComplete',
        'TaskFail',
        'HandoffContext',
        'HandoffAccept',
        'HandoffDecline'
      ].includes(messageType)
    ) {
      return 'proposal.updated';
    }

    if (messageType === 'Progress') return 'progress.reported';
    if (/^Tool(Call|Request)$/i.test(messageType)) return 'tool.called';
    if (/^Tool(Result|Completed|Output)$/i.test(messageType)) return 'tool.completed';
    return null;
  }

  private deriveSubject(
    type: CanonicalEventType,
    envelope: RawRuntimeEvent['envelope'],
    decoded?: Record<string, unknown> | null
  ): CanonicalEvent['subject'] {
    if (!envelope) return undefined;
    const payload = decoded as Record<string, unknown> | undefined;

    switch (type) {
      case 'signal.emitted':
        return { kind: 'signal', id: envelope.messageId };
      case 'proposal.created':
      case 'proposal.updated': {
        const proposalId = payload?.proposalId ?? payload?.proposal_id ?? payload?.requestId ?? payload?.request_id;
        return { kind: 'proposal', id: String(proposalId ?? envelope.messageId) };
      }
      case 'decision.finalized': {
        const decisionId = payload?.commitmentId ?? payload?.commitment_id ?? payload?.decisionId ?? payload?.decision_id;
        return { kind: 'decision', id: String(decisionId ?? envelope.messageId) };
      }
      case 'tool.called':
      case 'tool.completed': {
        const toolCallId = payload?.toolCallId ?? payload?.tool_call_id ?? payload?.requestId ?? payload?.request_id;
        return { kind: 'tool', id: String(toolCallId ?? envelope.messageId) };
      }
      case 'progress.reported':
        return { kind: 'message', id: envelope.messageId };
      default:
        return { kind: 'message', id: envelope.messageId };
    }
  }

  private makeEvent(
    runId: string,
    ts: string,
    type: CanonicalEventType | string,
    subject: CanonicalEvent['subject'],
    data: Record<string, unknown>,
    rawType: string
  ): CanonicalEvent {
    return {
      id: randomUUID(),
      runId,
      seq: 0,
      ts,
      type,
      schemaVersion: PROJECTION_SCHEMA_VERSION,
      subject,
      source: {
        kind: 'runtime',
        name: 'rust-runtime',
        rawType
      },
      data
    };
  }
}
