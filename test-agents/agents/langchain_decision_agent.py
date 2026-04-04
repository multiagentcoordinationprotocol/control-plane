"""LangChain agent for MACP Decision Mode integration testing.

Uses LangChain tools to interact with the MACP Control Plane.
Deterministic — uses rule-based logic, not LLM calls.
"""

from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool

from ..harness.base_agent import AgentRule, BaseAgent
from ..harness.macp_client import MACPClient


class MACPSendMessageTool(BaseTool):
    """LangChain tool for sending MACP messages."""

    name: str = "send_macp_message"
    description: str = "Send an MACP protocol message to the coordination session"
    client: Any = None  # MACPClient
    run_id: str = ""
    participant_id: str = ""

    def _run(
        self,
        message_type: str,
        payload: str = "{}",
        to: str = "",
    ) -> str:
        """Send a message via the control plane API."""
        import json

        payload_dict = json.loads(payload) if isinstance(payload, str) else payload
        to_list = [t.strip() for t in to.split(",") if t.strip()] if to else None

        result = self.client.send_message(
            run_id=self.run_id,
            from_participant=self.participant_id,
            message_type=message_type,
            payload=payload_dict,
            to=to_list,
        )
        return json.dumps(result)


class LangChainDecisionEvaluator(BaseAgent):
    """LangChain-based evaluator agent for Decision Mode.

    Listens for Proposal events, sends Evaluation with APPROVE.
    """

    def __init__(self, client: MACPClient):
        super().__init__(client, participant_id="evaluator", role="evaluator")
        self.send_tool = MACPSendMessageTool(
            client=client, participant_id="evaluator"
        )

    def get_rules(self) -> list[AgentRule]:
        return [
            AgentRule(
                event_type="message.received",
                message_type="Proposal",
                response_message_type="Evaluation",
                response_payload={
                    "recommendation": "APPROVE",
                    "rationale": "LangChain agent approves this proposal",
                },
                response_to=["proposer"],
                delay_ms=100,
            ),
        ]


class LangChainDecisionVoter(BaseAgent):
    """LangChain-based voter agent for Decision Mode.

    Listens for Evaluation events, sends Vote with approve.
    """

    def __init__(self, client: MACPClient):
        super().__init__(client, participant_id="voter", role="voter")
        self.send_tool = MACPSendMessageTool(
            client=client, participant_id="voter"
        )

    def get_rules(self) -> list[AgentRule]:
        return [
            AgentRule(
                event_type="message.received",
                message_type="Evaluation",
                response_message_type="Vote",
                response_payload={
                    "vote": "approve",
                    "rationale": "LangChain voter approves",
                },
                response_to=["proposer"],
                delay_ms=100,
            ),
        ]


def create_langchain_decision_agents(
    client: MACPClient,
) -> tuple[LangChainDecisionEvaluator, LangChainDecisionVoter]:
    """Factory for creating a pair of LangChain decision agents."""
    return LangChainDecisionEvaluator(client), LangChainDecisionVoter(client)
