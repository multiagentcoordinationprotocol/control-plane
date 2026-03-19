# MACP Control Plane — API Reference

The generated OpenAPI schema is exposed at `/docs` (Swagger UI) and `/docs-json` (raw schema).

## Endpoints

### Runs

#### `GET /runs`
List runs with optional filtering and pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | Filter by run status |
| `tags` | string | — | Comma-separated tag filter |
| `createdAfter` | ISO date | — | Filter runs created after |
| `createdBefore` | ISO date | — | Filter runs created before |
| `limit` | number | 50 | Max results (1-200) |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | string | createdAt | Sort field: `createdAt` or `updatedAt` |
| `sortOrder` | string | desc | Sort order: `asc` or `desc` |

#### `POST /runs`
Create and launch a runtime execution run.

```bash
curl -X POST http://localhost:3001/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "live",
    "runtime": { "kind": "rust" },
    "session": {
      "modeName": "macp.mode.decision.v1",
      "modeVersion": "1.0.0",
      "configurationVersion": "config.default",
      "ttlMs": 60000,
      "participants": [{ "id": "agent-1" }, { "id": "agent-2" }]
    }
  }'
```

**Response:** `{ "runId": "uuid", "status": "queued", "traceId": "..." }`

#### `GET /runs/:id`
Fetch the run record.

#### `GET /runs/:id/state`
Fetch the projected run state for UI rendering.

#### `GET /runs/:id/events`
List canonical events for a run.

**Query Parameters:** `afterSeq` (default 0), `limit` (default 200)

#### `GET /runs/:id/stream`
Subscribe to normalized live run events over SSE.

**SSE Event Types:**
- `snapshot` — Full projected state (sent on connect)
- `canonical_event` — Individual canonical event

#### `POST /runs/:id/cancel`
Cancel a running session. Body: `{ "reason": "optional" }`

### Replay

#### `POST /runs/:id/replay`
Create a replay descriptor.

Body: `{ "mode": "timed", "speed": 2, "fromSeq": 1, "toSeq": 100 }`

#### `GET /runs/:id/replay/stream`
Stream replayed canonical events. Query params: `mode`, `speed`, `fromSeq`, `toSeq`

**Replay Modes:**
- `instant` — All events emitted immediately
- `timed` — Events emitted with proportional timing (speed multiplier)
- `step` — All events emitted without delay (for scrubber UIs)

#### `GET /runs/:id/replay/state`
Project run state at a specific event sequence. Query param: `seq`

### Observability

#### `GET /runs/:id/traces`
Fetch trace summary for a run.

#### `GET /runs/:id/artifacts`
List artifacts linked to a run.

#### `POST /runs/:id/artifacts`
Create an artifact linked to a run.

Body: `{ "kind": "json", "label": "My Artifact", "inline": { ... } }`

#### `GET /runs/:id/metrics`
Fetch metrics summary for a run.

### Runtime

#### `GET /runtime/manifest`
Fetch runtime capabilities manifest.

### Health

#### `GET /healthz`
Liveness probe. Returns `{ "ok": true/false, "service": "macp-control-plane" }`

#### `GET /readyz`
Readiness probe checking database, runtime, and stream consumer health.

## Canonical Event Model

Each live/replay event includes:

```json
{
  "id": "uuid",
  "runId": "uuid",
  "seq": 1,
  "ts": "2024-01-01T00:00:00.000Z",
  "type": "message.received",
  "subject": { "kind": "message", "id": "msg-uuid" },
  "source": { "kind": "runtime", "name": "rust-runtime", "rawType": "Proposal" },
  "trace": { "traceId": "...", "spanId": "..." },
  "data": { ... }
}
```

This is the stable product contract for the UI.

## Error Response Format

```json
{
  "statusCode": 409,
  "errorCode": "INVALID_STATE_TRANSITION",
  "message": "cannot transition run from 'completed' to 'running'"
}
```

See `src/errors/error-codes.ts` for the full list of error codes.

## Rate Limiting

The API applies global rate limiting: 100 requests per 60 seconds per client.
Request payload size is limited to 1MB.
