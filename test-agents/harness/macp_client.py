"""HTTP client for the MACP Control Plane REST API."""

from __future__ import annotations

import os
from typing import Any

import httpx


class MACPClient:
    """Synchronous HTTP client for the MACP Control Plane."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 30.0,
    ):
        self.base_url = (
            base_url or os.environ.get("CONTROL_PLANE_URL", "http://localhost:3001")
        )
        self.api_key = api_key or os.environ.get("CONTROL_PLANE_API_KEY", "")
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            headers=self._build_headers(),
        )

    def _build_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    # ── Run Lifecycle ─────────────────────────────────────────────

    def create_run(self, request: dict[str, Any]) -> dict[str, Any]:
        """POST /runs — create and launch a new execution."""
        resp = self._client.post("/runs", json=request)
        resp.raise_for_status()
        return resp.json()

    def get_run(self, run_id: str) -> dict[str, Any]:
        """GET /runs/:id — fetch run record."""
        resp = self._client.get(f"/runs/{run_id}")
        resp.raise_for_status()
        return resp.json()

    def get_state(self, run_id: str) -> dict[str, Any]:
        """GET /runs/:id/state — projected run state."""
        resp = self._client.get(f"/runs/{run_id}/state")
        resp.raise_for_status()
        return resp.json()

    def list_runs(self, **params: Any) -> dict[str, Any]:
        """GET /runs — list runs with filtering."""
        resp = self._client.get("/runs", params=params)
        resp.raise_for_status()
        return resp.json()

    def cancel_run(self, run_id: str, reason: str | None = None) -> dict[str, Any]:
        """POST /runs/:id/cancel — cancel running session."""
        body = {"reason": reason} if reason else {}
        resp = self._client.post(f"/runs/{run_id}/cancel", json=body)
        resp.raise_for_status()
        return resp.json()

    # ── Messaging ─────────────────────────────────────────────────

    def send_message(
        self,
        run_id: str,
        from_participant: str,
        message_type: str,
        payload: dict[str, Any] | None = None,
        to: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """POST /runs/:id/messages — send a session-bound MACP message."""
        body: dict[str, Any] = {
            "from": from_participant,
            "messageType": message_type,
        }
        if payload is not None:
            body["payload"] = payload
        if to is not None:
            body["to"] = to
        if metadata is not None:
            body["metadata"] = metadata

        resp = self._client.post(f"/runs/{run_id}/messages", json=body)
        resp.raise_for_status()
        return resp.json()

    def send_signal(
        self,
        run_id: str,
        from_participant: str,
        message_type: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """POST /runs/:id/signal — send a signal."""
        body: dict[str, Any] = {
            "from": from_participant,
            "messageType": message_type,
        }
        if payload is not None:
            body["payload"] = payload

        resp = self._client.post(f"/runs/{run_id}/signal", json=body)
        resp.raise_for_status()
        return resp.json()

    # ── Events ────────────────────────────────────────────────────

    def list_events(
        self, run_id: str, after_seq: int | None = None
    ) -> list[dict[str, Any]]:
        """GET /runs/:id/events — list canonical events."""
        params = {}
        if after_seq is not None:
            params["afterSeq"] = after_seq
        resp = self._client.get(f"/runs/{run_id}/events", params=params)
        resp.raise_for_status()
        return resp.json()

    # ── Validation ────────────────────────────────────────────────

    def validate_run(self, request: dict[str, Any]) -> dict[str, Any]:
        """POST /runs/validate — preflight validation."""
        resp = self._client.post("/runs/validate", json=request)
        resp.raise_for_status()
        return resp.json()

    # ── Health ────────────────────────────────────────────────────

    def healthz(self) -> dict[str, Any]:
        """GET /healthz — liveness probe."""
        resp = self._client.get("/healthz")
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "MACPClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
