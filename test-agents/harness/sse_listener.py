"""SSE stream consumer for MACP Control Plane events."""

from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import dataclass, field
from queue import Empty, Queue
from typing import Any

import httpx
from httpx_sse import connect_sse


@dataclass
class SSEEvent:
    """Parsed SSE event."""

    type: str
    data: Any
    id: str | None = None
    raw: str = ""


class SSEListener:
    """Background SSE stream consumer.

    Connects to GET /runs/:id/stream and pushes events to a queue.
    Runs in a background thread for non-blocking operation.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
    ):
        self.base_url = (
            base_url or os.environ.get("CONTROL_PLANE_URL", "http://localhost:3001")
        )
        self.api_key = api_key or os.environ.get("CONTROL_PLANE_API_KEY", "")
        self.events: list[SSEEvent] = []
        self.queue: Queue[SSEEvent] = Queue()
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def connect(
        self,
        run_id: str,
        include_snapshot: bool = True,
        after_seq: int | None = None,
    ) -> None:
        """Start listening to SSE events in a background thread."""
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._listen,
            args=(run_id, include_snapshot, after_seq),
            daemon=True,
        )
        self._thread.start()

    def _listen(
        self,
        run_id: str,
        include_snapshot: bool,
        after_seq: int | None,
    ) -> None:
        """Background thread: connect to SSE and consume events."""
        headers = {"Accept": "text/event-stream"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        params: dict[str, Any] = {"includeSnapshot": str(include_snapshot).lower()}
        if after_seq is not None:
            params["afterSeq"] = after_seq

        try:
            with httpx.Client(
                base_url=self.base_url, timeout=60.0, headers=headers
            ) as client:
                with connect_sse(
                    client, "GET", f"/runs/{run_id}/stream", params=params
                ) as sse:
                    for event in sse.iter_sse():
                        if self._stop_event.is_set():
                            break

                        parsed_data: Any
                        try:
                            parsed_data = json.loads(event.data)
                        except (json.JSONDecodeError, TypeError):
                            parsed_data = event.data

                        sse_event = SSEEvent(
                            type=event.event or "message",
                            data=parsed_data,
                            id=event.id,
                            raw=event.data,
                        )
                        self.events.append(sse_event)
                        self.queue.put(sse_event)
        except Exception as e:
            # Push error as a special event
            error_event = SSEEvent(
                type="error",
                data={"error": str(e)},
            )
            self.events.append(error_event)
            self.queue.put(error_event)

    def wait_for_event(
        self, event_type: str, timeout_s: float = 30.0
    ) -> SSEEvent | None:
        """Wait for an event of the given type."""
        # Check already-received events
        for ev in self.events:
            if ev.type == event_type:
                return ev

        # Wait for new events
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            try:
                event = self.queue.get(timeout=0.5)
                if event.type == event_type:
                    return event
            except Empty:
                continue
        return None

    def wait_for_status(
        self, target_status: str, timeout_s: float = 30.0
    ) -> SSEEvent | None:
        """Wait for a snapshot event showing the target run status."""
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            for ev in self.events:
                if ev.type == "snapshot" and isinstance(ev.data, dict):
                    run = ev.data.get("run", {})
                    if run.get("status") == target_status:
                        return ev

            try:
                event = self.queue.get(timeout=0.5)
                if event.type == "snapshot" and isinstance(event.data, dict):
                    run = event.data.get("run", {})
                    if run.get("status") == target_status:
                        return event
            except Empty:
                continue
        return None

    def get_events_by_type(self, event_type: str) -> list[SSEEvent]:
        """Return all events of the given type."""
        return [ev for ev in self.events if ev.type == event_type]

    def close(self) -> None:
        """Stop the background listener."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    def __enter__(self) -> "SSEListener":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
