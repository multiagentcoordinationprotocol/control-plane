# MACP Control Plane — Troubleshooting

## Runtime Connection Failures

**Symptom:** `readyz` returns `runtime.ok: false`

**Checks:**
1. Verify runtime is running: `grpcurl -plaintext 127.0.0.1:50051 list`
2. Check `RUNTIME_ADDRESS` env var matches the runtime's listen address
3. If using TLS, ensure `RUNTIME_TLS=true` and certificates are valid
4. Check `RUNTIME_REQUEST_TIMEOUT_MS` (default 30s) — increase if runtime is slow to respond

## Migration Issues

**Symptom:** Application fails to start with database errors

**Steps:**
1. Ensure PostgreSQL is running and accessible via `DATABASE_URL`
2. Run migrations: `npm run drizzle:migrate`
3. Check `drizzle/` directory for migration files
4. Use `npm run drizzle:studio` to inspect database state

## Stuck Runs

**Symptom:** Runs stay in `starting` or `running` state indefinitely

**Steps:**
1. Check stream consumer logs for reconnection errors
2. Verify runtime session state: `GET /readyz`
3. Check `STREAM_MAX_RETRIES` (default 5) and `STREAM_IDLE_TIMEOUT_MS` (default 120s)
4. Manually cancel the run: `POST /runs/{id}/cancel`

## High Memory Usage

**Causes:**
- Too many active SSE subscribers — StreamHub cleans up idle subjects after 60s
- Large replay queries — replay now uses cursor-based pagination (batch size configurable via `REPLAY_BATCH_SIZE`)
- Database connection pool exhaustion — check `DB_POOL_MAX` (default 20)

## Common Error Codes

| Code | Meaning |
|------|---------|
| `RUN_NOT_FOUND` | The specified run ID does not exist |
| `INVALID_STATE_TRANSITION` | Cannot transition the run to the requested state |
| `RUNTIME_UNAVAILABLE` | Cannot connect to the gRPC runtime |
| `RUNTIME_TIMEOUT` | gRPC call exceeded deadline |
| `STREAM_EXHAUSTED` | Max retries reached for stream reconnection |
| `SESSION_EXPIRED` | Runtime session has expired |
| `KICKOFF_FAILED` | A kickoff message failed to send |
