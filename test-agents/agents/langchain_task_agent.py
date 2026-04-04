"""LangChain agent for MACP Task Mode integration testing.

Worker agent: listens for TaskRequest, accepts, sends progress, completes.
Deterministic — uses rule-based logic, not LLM calls.
"""

from __future__ import annotations

from typing import Any

from ..harness.base_agent import AgentRule, BaseAgent
from ..harness.macp_client import MACPClient


class LangChainTaskWorker(BaseAgent):
    """LangChain-based worker agent for Task Mode.

    Follows a scripted flow:
    1. Receives TaskRequest -> sends TaskAccept
    2. After accepting -> sends TaskUpdate with progress
    3. After update -> sends TaskComplete
    """

    def __init__(self, client: MACPClient):
        super().__init__(client, participant_id="worker", role="worker")
        self._accepted = False

    def get_rules(self) -> list[AgentRule]:
        return [
            AgentRule(
                event_type="message.received",
                message_type="TaskRequest",
                response_message_type="TaskAccept",
                response_payload=lambda ev: {
                    "taskId": ev.get("data", {}).get("taskId", "task-1"),
                    "acceptedAt": "2026-01-01T00:00:00Z",
                },
                response_to=["requester"],
                delay_ms=100,
            ),
            # After seeing our own TaskAccept echoed back, send update
            AgentRule(
                event_type="message.sent",
                message_type="TaskAccept",
                response_message_type="TaskUpdate",
                response_payload={
                    "taskId": "task-1",
                    "progress": 0.5,
                    "message": "LangChain worker processing...",
                },
                response_to=["requester"],
                delay_ms=200,
            ),
            # After TaskUpdate echoed, send complete
            AgentRule(
                event_type="message.sent",
                message_type="TaskUpdate",
                response_message_type="TaskComplete",
                response_payload={
                    "taskId": "task-1",
                    "output": {
                        "result": "success",
                        "processedBy": "langchain-worker",
                    },
                },
                response_to=["requester"],
                delay_ms=200,
            ),
        ]


def create_langchain_task_worker(client: MACPClient) -> LangChainTaskWorker:
    """Factory for creating a LangChain task worker agent."""
    return LangChainTaskWorker(client)
