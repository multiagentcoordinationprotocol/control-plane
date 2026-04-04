"""Abstract base class for rule-based test agents."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable

from .macp_client import MACPClient
from .sse_listener import SSEListener


@dataclass
class AgentRule:
    """A rule that maps incoming events to outgoing messages."""

    # Match conditions
    event_type: str | None = None
    message_type: str | None = None
    from_participant: str | None = None

    # Response action
    response_message_type: str = ""
    response_payload: dict[str, Any] | Callable[[dict[str, Any]], dict[str, Any]] = field(
        default_factory=dict
    )
    response_to: list[str] | None = None
    delay_ms: int = 0


class BaseAgent(ABC):
    """Abstract base agent for MACP integration testing.

    Subclasses implement get_rules() to define behavior.
    The agent loop: listen to SSE events, match rules, send messages.
    All deterministic — no LLM calls.
    """

    def __init__(
        self,
        client: MACPClient,
        participant_id: str,
        role: str = "agent",
    ):
        self.client = client
        self.participant_id = participant_id
        self.role = role
        self.actions_performed: list[dict[str, Any]] = []
        self._running = False

    @abstractmethod
    def get_rules(self) -> list[AgentRule]:
        """Return the list of rules this agent follows."""
        ...

    def run(self, run_id: str, timeout_s: float = 30.0) -> None:
        """Execute the agent loop for the given run.

        Subscribes to SSE events and sends messages based on matching rules.
        Stops when the run reaches a terminal state or timeout expires.
        """
        self._running = True
        rules = self.get_rules()

        listener = SSEListener(
            base_url=self.client.base_url,
            api_key=self.client.api_key,
        )
        listener.connect(run_id, include_snapshot=True)

        processed_count = 0
        deadline = time.time() + timeout_s

        try:
            while self._running and time.time() < deadline:
                # Process new events
                new_events = listener.events[processed_count:]
                processed_count = len(listener.events)

                for event in new_events:
                    # Check for terminal state
                    if event.type == "snapshot" and isinstance(event.data, dict):
                        run_data = event.data.get("run", {})
                        status = run_data.get("status", "")
                        if status in ("completed", "failed", "cancelled"):
                            self._running = False
                            return

                    # Match canonical events against rules
                    if event.type == "canonical_event" and isinstance(event.data, dict):
                        self._process_event(run_id, event.data, rules)

                time.sleep(0.1)
        finally:
            listener.close()

    def stop(self) -> None:
        """Stop the agent loop."""
        self._running = False

    def _process_event(
        self,
        run_id: str,
        canonical: dict[str, Any],
        rules: list[AgentRule],
    ) -> None:
        """Check event against rules and send responses."""
        event_type = canonical.get("type", "")
        data = canonical.get("data", {})

        for rule in rules:
            if not self._matches(event_type, data, rule):
                continue

            if rule.delay_ms > 0:
                time.sleep(rule.delay_ms / 1000.0)

            payload = (
                rule.response_payload(canonical)
                if callable(rule.response_payload)
                else rule.response_payload
            )

            try:
                result = self.client.send_message(
                    run_id=run_id,
                    from_participant=self.participant_id,
                    message_type=rule.response_message_type,
                    payload=payload,
                    to=rule.response_to,
                )
                self.actions_performed.append(
                    {
                        "rule": rule.response_message_type,
                        "event": canonical,
                        "result": result,
                    }
                )
            except Exception as e:
                if self._running:
                    print(
                        f"Agent {self.participant_id} failed to send "
                        f"{rule.response_message_type}: {e}"
                    )

            # Only fire first matching rule
            break

    def _matches(
        self,
        event_type: str,
        data: dict[str, Any],
        rule: AgentRule,
    ) -> bool:
        """Check if an event matches a rule's conditions."""
        if rule.event_type and event_type != rule.event_type:
            return False
        if rule.message_type:
            msg_type = data.get("messageType", "")
            if msg_type != rule.message_type:
                return False
        if rule.from_participant:
            sender = data.get("sender", "") or data.get("from", "")
            if sender != rule.from_participant:
                return False
        return True
