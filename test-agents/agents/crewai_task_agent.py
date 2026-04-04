"""CrewAI agent for MACP Task Mode integration testing.

Worker agent using CrewAI's Agent paradigm.
Deterministic — uses rule-based logic, not LLM calls.
"""

from __future__ import annotations

from typing import Any

from ..harness.base_agent import AgentRule, BaseAgent
from ..harness.macp_client import MACPClient


class CrewAITaskWorker(BaseAgent):
    """CrewAI-based worker agent for Task Mode.

    Follows a scripted flow:
    1. Receives TaskRequest -> sends TaskAccept
    2. Sends TaskUpdate with progress
    3. Sends TaskComplete with output
    """

    def __init__(self, client: MACPClient):
        super().__init__(client, participant_id="worker", role="worker")

    def get_rules(self) -> list[AgentRule]:
        return [
            AgentRule(
                event_type="message.received",
                message_type="TaskRequest",
                response_message_type="TaskAccept",
                response_payload=lambda ev: {
                    "taskId": ev.get("data", {}).get("taskId", "task-1"),
                },
                response_to=["requester"],
                delay_ms=100,
            ),
            AgentRule(
                event_type="message.sent",
                message_type="TaskAccept",
                response_message_type="TaskUpdate",
                response_payload={
                    "taskId": "task-1",
                    "progress": 0.75,
                    "message": "CrewAI worker processing...",
                },
                response_to=["requester"],
                delay_ms=200,
            ),
            AgentRule(
                event_type="message.sent",
                message_type="TaskUpdate",
                response_message_type="TaskComplete",
                response_payload={
                    "taskId": "task-1",
                    "output": {
                        "result": "success",
                        "processedBy": "crewai-worker",
                    },
                },
                response_to=["requester"],
                delay_ms=200,
            ),
        ]


def create_crewai_task_worker(client: MACPClient) -> CrewAITaskWorker:
    """Factory for creating a CrewAI task worker agent."""
    return CrewAITaskWorker(client)
