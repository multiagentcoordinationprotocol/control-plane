export type ExecutionMode = 'live' | 'replay' | 'sandbox';

export type PayloadEncoding = 'json' | 'text' | 'base64' | 'proto';

export interface ProtoPayload {
  typeName: string;
  value: Record<string, unknown>;
}

export interface PayloadEnvelopeInput {
  encoding: PayloadEncoding;
  mediaType?: string;
  json?: Record<string, unknown>;
  text?: string;
  base64?: string;
  proto?: ProtoPayload;
}

export interface RootRef {
  uri: string;
  name?: string;
}

export interface ParticipantRef {
  id: string;
  role?: string;
  transportIdentity?: string;
  metadata?: Record<string, unknown>;
}

export interface KickoffMessage {
  from: string;
  to: string[];
  kind: 'request' | 'broadcast' | 'proposal' | 'context';
  messageType: string;
  payload?: Record<string, unknown>;
  payloadEnvelope?: PayloadEnvelopeInput;
  metadata?: Record<string, unknown>;
}

export interface ExecutionRequester {
  actorId?: string;
  actorType?: 'user' | 'service' | 'system';
}

export interface ExecutionRequest {
  mode: ExecutionMode;
  runtime: {
    kind: string;
    version?: string;
  };
  session: {
    modeName: string;
    modeVersion: string;
    configurationVersion: string;
    policyVersion?: string;
    ttlMs: number;
    initiatorParticipantId?: string;
    participants: ParticipantRef[];
    roots?: RootRef[];
    context?: Record<string, unknown>;
    contextEnvelope?: PayloadEnvelopeInput;
    metadata?: Record<string, unknown>;
  };
  kickoff?: KickoffMessage[];
  execution?: {
    idempotencyKey?: string;
    tags?: string[];
    requester?: ExecutionRequester;
  };
}

export type RunStatus =
  | 'queued'
  | 'starting'
  | 'binding_session'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SessionState =
  | 'SESSION_STATE_UNSPECIFIED'
  | 'SESSION_STATE_OPEN'
  | 'SESSION_STATE_RESOLVED'
  | 'SESSION_STATE_EXPIRED';

export interface Run {
  id: string;
  status: RunStatus;
  runtimeKind: string;
  runtimeVersion?: string;
  runtimeSessionId?: string;
  traceId?: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  tags?: string[];
  source?: {
    kind?: string;
    ref?: string;
  };
  metadata?: Record<string, unknown>;
}

export type CanonicalEventType =
  | 'run.created'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'session.bound'
  | 'session.stream.opened'
  | 'session.state.changed'
  | 'participant.seen'
  | 'message.sent'
  | 'message.received'
  | 'signal.emitted'
  | 'proposal.created'
  | 'proposal.updated'
  | 'decision.proposed'
  | 'decision.finalized'
  | 'tool.called'
  | 'tool.completed'
  | 'artifact.created';

export interface CanonicalEvent {
  id: string;
  runId: string;
  seq: number;
  ts: string;
  type: CanonicalEventType | string;
  subject?: {
    kind:
      | 'run'
      | 'session'
      | 'participant'
      | 'message'
      | 'signal'
      | 'proposal'
      | 'decision'
      | 'tool'
      | 'artifact'
      | 'trace';
    id: string;
  };
  source: {
    kind: 'runtime' | 'control-plane' | 'replay';
    name: string;
    rawType?: string;
  };
  trace?: {
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
  };
  data: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  runId: string;
  kind: 'trace' | 'json' | 'report' | 'log' | 'bundle';
  label: string;
  uri?: string;
  inline?: Record<string, unknown>;
  createdAt: string;
}

export interface RunSummaryProjection {
  runId: string;
  status: RunStatus;
  runtimeSessionId?: string;
  startedAt?: string;
  endedAt?: string;
  traceId?: string;
  modeName?: string;
}

export interface ParticipantProjection {
  participantId: string;
  role?: string;
  status: 'idle' | 'active' | 'waiting' | 'completed' | 'failed';
  latestActivityAt?: string;
  latestSummary?: string;
}

export interface GraphProjection {
  nodes: Array<{ id: string; kind: string; status: string }>;
  edges: Array<{ from: string; to: string; kind: string; ts: string }>;
}

export interface DecisionProjection {
  current?: {
    action: string;
    confidence?: number;
    reasons?: string[];
    finalized: boolean;
    proposalId?: string;
  };
}

export interface SignalProjection {
  signals: Array<{
    id: string;
    name: string;
    severity?: string;
    sourceParticipantId?: string;
    ts: string;
    confidence?: number;
  }>;
}

export interface TimelineProjection {
  latestSeq: number;
  totalEvents: number;
  recent: Array<Pick<CanonicalEvent, 'id' | 'seq' | 'ts' | 'type' | 'subject'>>;
}

export interface TraceSummary {
  traceId?: string;
  spanCount: number;
  lastSpanId?: string;
  linkedArtifacts: string[];
}

export interface RunStateProjection {
  run: RunSummaryProjection;
  participants: ParticipantProjection[];
  graph: GraphProjection;
  decision: DecisionProjection;
  signals: SignalProjection;
  timeline: TimelineProjection;
  trace: TraceSummary;
}

export interface ReplayRequest {
  mode: 'instant' | 'timed' | 'step';
  speed?: number;
  fromSeq?: number;
  toSeq?: number;
}

export interface MetricsSummary {
  runId: string;
  eventCount: number;
  messageCount: number;
  signalCount: number;
  proposalCount: number;
  toolCallCount: number;
  decisionCount: number;
  streamReconnectCount: number;
  firstEventAt?: string;
  lastEventAt?: string;
  durationMs?: number;
  sessionState?: SessionState;
}
