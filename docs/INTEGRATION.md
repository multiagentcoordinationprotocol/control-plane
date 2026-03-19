# MACP Control Plane — Integration Guide

## Adding a Runtime Provider

1. Implement the `RuntimeProvider` interface from `src/contracts/runtime.ts`
2. Register it as a NestJS provider in `app.module.ts`
3. Add it to `RuntimeProviderRegistry` so it can be looked up by `kind`

## Consuming SSE Streams

```bash
# Subscribe to live events
curl -N http://localhost:3001/runs/{id}/stream

# Events are sent as SSE with types:
# - snapshot: Full projected state
# - canonical_event: Individual event
```

## Using the Replay API

```bash
# Create replay descriptor
curl -X POST http://localhost:3001/runs/{id}/replay \
  -H 'Content-Type: application/json' \
  -d '{"mode": "timed", "speed": 2}'

# Stream replay
curl -N "http://localhost:3001/runs/{id}/replay/stream?mode=timed&speed=2"

# Get state at sequence
curl http://localhost:3001/runs/{id}/replay/state?seq=42
```

Replay modes:
- `timed`: Replays events with proportional timing (adjustable via `speed`)
- `step`: Emits all events immediately (for scrubber UIs)
- `instant`: Emits all events with no delay

## Adding Coordination Modes

1. Add proto definitions under `proto/macp/modes/{mode}/v1/`
2. Update `MESSAGE_TYPE_MAP` in `ProtoRegistryService`
3. Update `deriveEventType()` in `EventNormalizerService` for new message types

## Environment Variables

See `.env.example` for all configurable variables with descriptions and defaults.
