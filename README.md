# MACP Control Plane (NestJS)

A scenario-agnostic control plane for the MACP runtime.

This service is the backend that a Next.js UI talks to for run lifecycle, live stream projection, replay, traces, metrics, and artifacts.

## Boundary

The control plane intentionally does **not** own scenario definitions.

- **UI**: browse scenarios, launch runs, render graphs and traces
- **Scenario Registry**: scenario packs, templates, validation, scenario-to-execution request creation
- **Control Plane**: run lifecycle, runtime execution, session streaming, event normalization, replay, traces, artifacts
- **Runtime**: actual MACP orchestration and mode semantics

## Why this repo is generic

This service only accepts a fully resolved `ExecutionRequest`.
It does not accept `scenarioId`, interpret fraud/business meaning, or infer domain semantics.

It only knows:

- how to validate execution-plan structure
- how to start a runtime session
- how to stream runtime events
- how to normalize them for the UI
- how to persist projections and replay data

## Important contract additions

To make the request truly runtime-safe, this implementation adds three fields beyond the original sketch:

1. `session.initiatorParticipantId`
   - MACP session start needs a sender identity.
   - If omitted, the control plane falls back to the first kickoff sender, then the requester, then the first participant.

2. `kickoff[].messageType`
   - The runtime envelope needs an exact MACP `message_type`.
   - A generic `kind = "request"` is not enough to build a runtime envelope.

3. `payloadEnvelope` / `contextEnvelope`
   - The runtime uses raw `bytes` payloads.
   - JSON is supported for convenience, but this repo also supports:
     - `json`
     - `text`
     - `base64`
     - `proto` (fully-qualified protobuf type name + value)

These additions keep the API scenario-agnostic while making it executable against the runtime.

## Runtime integration notes

This repo vendors the runtime protobuf files under `proto/` and uses `@grpc/grpc-js` + `@grpc/proto-loader` at runtime.

The current runtime protobuf surface supports:

- `Initialize`
- `Send`
- `StreamSession`
- `GetSession`
- `CancelSession`
- `GetManifest`
- `ListModes`
- `ListRoots`

### StreamSession assumption

The uploaded runtime currently disables `StreamSession`, but your target design says it will be added.

This repo therefore introduces one explicit runtime-facing assumption:

- the control plane opens `StreamSession`
- the first outbound streaming frame is a subscription envelope
- the subscription `messageType` defaults to `SessionWatch`
- the payload defaults to `{ "sessionId": "..." }`

That behavior is isolated in `RustRuntimeProvider` so you can update it the moment the runtime finalizes the stream-subscription contract.

## Endpoints

### Runs

- `POST /runs`
- `GET /runs/:id`
- `GET /runs/:id/state`
- `GET /runs/:id/events`
- `GET /runs/:id/stream` (SSE)
- `POST /runs/:id/cancel`
- `POST /runs/:id/replay`
- `GET /runs/:id/replay/stream` (SSE)
- `GET /runs/:id/replay/state`

### Runtime discovery

- `GET /runtime/manifest`
- `GET /runtime/modes`
- `GET /runtime/roots`
- `GET /runtime/health`

### Observability

- `GET /runs/:id/traces`
- `GET /runs/:id/artifacts`
- `GET /runs/:id/metrics`

### Ops

- `GET /healthz`
- `GET /readyz`
- `GET /docs`

## Database tables

- `runs`
- `runtime_sessions`
- `run_events_raw`
- `run_events_canonical`
- `run_projections`
- `run_artifacts`
- `run_metrics`

## Local development

```bash
cp .env.example .env
npm install
npm run drizzle:migrate
npm run start:dev
```

Make sure the runtime is running and accessible at `RUNTIME_ADDRESS`.

For local development against the current reference runtime profile:

```bash
export MACP_ALLOW_INSECURE=1
export MACP_ALLOW_DEV_SENDER_HEADER=1
cargo run
```

Then set:

```bash
RUNTIME_ALLOW_INSECURE=true
RUNTIME_USE_DEV_HEADER=true
RUNTIME_DEV_AGENT_ID=control-plane
```

## Example execution request

```json
{
  "mode": "live",
  "runtime": { "kind": "rust", "version": "v1" },
  "session": {
    "modeName": "macp.mode.decision.v1",
    "modeVersion": "1.0.0",
    "configurationVersion": "config.default",
    "policyVersion": "policy.default",
    "ttlMs": 600000,
    "initiatorParticipantId": "coordinator",
    "participants": [
      { "id": "fraud-agent", "role": "fraud" },
      { "id": "risk-agent", "role": "risk" },
      { "id": "growth-agent", "role": "growth" },
      { "id": "coordinator", "role": "coordinator" }
    ],
    "context": {
      "transactionAmount": 1800,
      "deviceTrustScore": 0.14
    },
    "metadata": {
      "source": "scenario-registry",
      "sourceRef": "fraud/high-value-new-device@1.0.0",
      "intent": "evaluate transaction"
    }
  },
  "kickoff": [
    {
      "from": "coordinator",
      "to": ["fraud-agent", "risk-agent", "growth-agent"],
      "kind": "proposal",
      "messageType": "Proposal",
      "payloadEnvelope": {
        "encoding": "proto",
        "proto": {
          "typeName": "macp.modes.decision.v1.ProposalPayload",
          "value": {
            "proposal_id": "p1",
            "option": "step_up_verification",
            "rationale": "new device + elevated amount"
          }
        }
      }
    }
  ],
  "execution": {
    "idempotencyKey": "fraud-high-value-new-device-demo-1",
    "tags": ["demo", "fraud"],
    "requester": {
      "actorId": "coordinator",
      "actorType": "service"
    }
  }
}
```

## Repo layout

```text
src/
  controllers/        # NestJS controllers
  runs/               # run manager, executor, stream consumer
  runtime/            # runtime provider registry + Rust provider + proto codec
  events/             # canonical event normalizer + live SSE hub
  projection/         # UI read models
  replay/             # deterministic replay endpoints
  metrics/            # metrics aggregation
  artifacts/          # artifact registration/listing
  storage/            # Drizzle repositories
  db/                 # Drizzle schema + database service
  telemetry/          # OpenTelemetry bootstrap and manual spans
  dto/                # request/response schemas for OpenAPI
  contracts/          # TypeScript interfaces
```
