# MACP Control Plane — Architecture

## System Context

The MACP Control Plane is a NestJS service that orchestrates multi-agent coordination sessions. It sits between UI clients and a runtime (currently Rust via gRPC), managing the lifecycle of coordination runs.

```
┌──────────┐     HTTP/SSE      ┌─────────────────┐      gRPC       ┌──────────────┐
│ UI Client├───────────────────►│  Control Plane   ├────────────────►│ MACP Runtime │
│          │◄───────────────────┤  (NestJS)        │◄────────────────┤ (Rust)       │
└──────────┘                   └────────┬─────────┘                └──────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │  PostgreSQL   │
                                 └──────────────┘
```

## Request Flow

```
POST /runs
  → RunsController
    → RunExecutorService.launch()
      → RunManagerService.createRun()        [status: queued]
      → async execute():
        → markStarted()                      [status: starting]
        → provider.initialize()              [gRPC]
        → provider.startSession()            [gRPC]
        → bindSession()                      [status: binding_session]
        → send kickoff messages              [gRPC]
        → markRunning()                      [status: running]
        → StreamConsumerService.start()      [begins event loop]
```

## Event Pipeline

```
Runtime gRPC stream
  → StreamConsumerService (consumption loop + reconnection)
    → EventNormalizerService (raw → canonical)
      → RunEventService (sequence allocation + persistence)
        → EventRepository.appendRaw/appendCanonical
        → ProjectionService.applyAndPersist
        → MetricsService.recordEvents
        → StreamHubService.publishEvent (SSE → UI)
```

## Layer Map

| Layer | Directory | Responsibility |
|-------|-----------|---------------|
| Controllers | `src/controllers/` | HTTP endpoints — runs CRUD, runtime discovery, observability, health |
| Run Orchestration | `src/runs/` | RunManager (state machine), RunExecutor (coordination), StreamConsumer (event loop) |
| Runtime Abstraction | `src/runtime/` | `RuntimeProvider` interface, `RustRuntimeProvider` (gRPC), proto registry |
| Events | `src/events/` | Normalization, persistence pipeline, SSE publishing |
| Projection | `src/projection/` | Applies canonical events to build UI read models |
| Storage | `src/storage/` | Drizzle repository per entity |
| DB | `src/db/` | Drizzle client as `@Global` NestJS module |
| Contracts | `src/contracts/` | TypeScript interfaces |
| DTOs | `src/dto/` | Request/response validation |
| Errors | `src/errors/` | Error codes, exception classes, global filter |

## Run State Machine

```
queued → starting → binding_session → running → completed
  │         │              │             │
  └────┬────┘──────┬───────┘─────┬───────┘
       ▼           ▼             ▼
     failed     cancelled
```

Terminal states: `completed`, `failed`, `cancelled` (no outgoing transitions).

## Database Schema

7 tables: `runs`, `runtime_sessions`, `run_events_raw`, `run_events_canonical`, `run_projections`, `run_artifacts`, `run_metrics`.

Key relationships:
- All tables reference `runs.id` with `ON DELETE CASCADE`
- Events use `(run_id, seq)` unique indexes for ordering
- Projections use run_id as primary key (one projection per run)
- Metrics use run_id as primary key (one metrics row per run)

## Key Design Decisions

1. **Scenario-agnostic**: The control plane accepts only fully resolved `ExecutionRequest` — no scenario resolution happens here.
2. **Three-layer event pipeline**: Raw events → canonical events → projections. Raw events preserve the original runtime data; canonical events provide a normalized, typed view.
3. **StreamSession first frame**: A subscription envelope (`SessionWatch`) is sent as the first message to the gRPC stream.
4. **Transactional event persistence**: Sequence allocation + event persistence happen within a single database transaction to prevent gaps.
5. **Exponential backoff with jitter**: Stream reconnection uses exponential backoff capped at 30s with 20% random jitter.
