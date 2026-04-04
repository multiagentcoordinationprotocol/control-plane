# MACP Control Plane — Integration Guide

## Adding a Runtime Provider

1. Implement the `RuntimeProvider` interface from `src/contracts/runtime.ts`
2. Register it as a NestJS provider in `app.module.ts`
3. Add it to `RuntimeProviderRegistry` so it can be looked up by `kind`

Key methods to implement:
- `initialize()` — protocol version negotiation
- `openSession()` — bidirectional session stream (preferred)
- `send()` — unary message send with ack
- `getSession()` / `cancelSession()` — session management
- `getManifest()` / `listModes()` — metadata

## Sending Messages from External Agents

Agents communicate with active runs via HTTP:

```bash
# Send an Evaluation (JSON payload — for mock runtime)
curl -X POST http://localhost:3001/runs/{runId}/messages \
  -H 'Authorization: Bearer <key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "evaluator",
    "to": ["proposer"],
    "messageType": "Evaluation",
    "payload": { "recommendation": "APPROVE", "confidence": 0.95 }
  }'

# Send an Evaluation (proto-encoded — required by real Rust runtime)
curl -X POST http://localhost:3001/runs/{runId}/messages \
  -H 'Authorization: Bearer <key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "evaluator",
    "to": ["proposer"],
    "messageType": "Evaluation",
    "payloadEnvelope": {
      "encoding": "proto",
      "proto": {
        "typeName": "macp.modes.decision.v1.EvaluationPayload",
        "value": {
          "proposalId": "p-1",
          "recommendation": "APPROVE",
          "confidence": 0.95,
          "reason": "Meets all criteria"
        }
      }
    }
  }'
```

## Sending Signals (Ambient Plane)

Signals are non-binding, non-session-bound messages for observability:

```bash
curl -X POST http://localhost:3001/runs/{runId}/signal \
  -H 'Authorization: Bearer <key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "evaluator",
    "to": ["proposer"],
    "messageType": "Signal",
    "payload": {
      "signalType": "progress",
      "data": "Starting analysis",
      "confidence": 0.0
    }
  }'
```

Signals use empty `sessionId` and `modeName` at the gRPC level. They do NOT enter session history but appear as `signal.emitted` canonical events when echoed by the runtime.

## Consuming SSE Streams

```bash
# Subscribe to live events (with initial state snapshot)
curl -N -H 'Authorization: Bearer <key>' \
  'http://localhost:3001/runs/{id}/stream?includeSnapshot=true'

# Resume from a specific sequence
curl -N -H 'Authorization: Bearer <key>' \
  -H 'Last-Event-Id: 42' \
  'http://localhost:3001/runs/{id}/stream'
```

SSE event types:
- `snapshot` — full `RunStateProjection` at connection time
- `canonical_event` — individual event (id = sequence number for resume)
- `heartbeat` — keep-alive every 15s (configurable)

## Using the Replay API

```bash
# Create replay descriptor
curl -X POST http://localhost:3001/runs/{id}/replay \
  -H 'Content-Type: application/json' \
  -d '{"mode": "timed", "speed": 2}'

# Stream replay
curl -N "http://localhost:3001/runs/{id}/replay/stream?mode=timed&speed=2"

# Get state at specific sequence (for timeline scrubber)
curl http://localhost:3001/runs/{id}/replay/state?seq=42
```

Replay modes: `timed` (proportional timing), `step` (all at once), `instant` (no delay).

## Adding Coordination Modes

1. Add proto definitions under `proto/macp/modes/{mode}/v1/`
2. Update `MESSAGE_TYPE_MAP` in `src/runtime/proto-registry.service.ts`
3. Update `deriveEventType()` in `src/events/event-normalizer.service.ts` for new message types
4. Add mode to `src/runtime/mock-runtime.provider.ts` supported modes list

## Webhooks

Register webhooks for run lifecycle events:

```bash
# Create webhook
curl -X POST http://localhost:3001/webhooks \
  -H 'Content-Type: application/json' \
  -d '{ "url": "https://example.com/webhook", "events": ["run.completed"], "secret": "my-hmac-secret" }'

# Update webhook
curl -X PATCH http://localhost:3001/webhooks/{id} \
  -H 'Content-Type: application/json' \
  -d '{ "active": false }'
```

Webhook deliveries include `X-MACP-Signature` (HMAC-SHA256) and `X-MACP-Event` headers.

## Running Integration Tests

```bash
# Mock runtime (fast, no external dependencies)
npm run test:integration

# Real Rust runtime (needs runtime on port 50051)
INTEGRATION_RUNTIME=remote RUNTIME_ADDRESS=127.0.0.1:50051 npm run test:integration

# Python agent E2E tests (LangChain + CrewAI)
./scripts/run-e2e.sh decision
```

See `test/` for TypeScript integration tests and `test-agents/` for Python agent harnesses.

## Environment Variables

See `.env.example` for all configurable variables with descriptions and defaults.
