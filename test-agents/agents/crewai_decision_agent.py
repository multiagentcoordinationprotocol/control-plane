"""CrewAI agents for MACP Decision Mode integration testing.

Each participant is a CrewAI Agent with MACP tools.
Deterministic — uses rule-based logic, not LLM calls.
"""

from __future__ import annotations

from typing import Any

from ..harness.base_agent import AgentRule, BaseAgent
from ..harness.macp_client import MACPClient


class CrewAIDecisionEvaluator(BaseAgent):
    """CrewAI-based evaluator agent for Decision Mode.

    Wraps the MACP interaction in CrewAI's Agent/Task/Crew paradigm.
    For deterministic testing, bypasses the LLM and uses rules directly.
    """

    def __init__(self, client: MACPClient):
        super().__init__(client, participant_id="evaluator", role="evaluator")

    def get_rules(self) -> list[AgentRule]:
        return [
            AgentRule(
                event_type="message.received",
                message_type="Proposal",
                response_message_type="Evaluation",
                response_payload={
                    "recommendation": "APPROVE",
                    "rationale": "CrewAI evaluator approves this proposal",
                    "confidence": 0.95,
                },
                response_to=["proposer"],
                delay_ms=150,
            ),
        ]


class CrewAIDecisionVoter(BaseAgent):
    """CrewAI-based voter agent for Decision Mode."""

    def __init__(self, client: MACPClient):
        super().__init__(client, participant_id="voter", role="voter")

    def get_rules(self) -> list[AgentRule]:
        return [
            AgentRule(
                event_type="message.received",
                message_type="Evaluation",
                response_message_type="Vote",
                response_payload={
                    "vote": "approve",
                    "rationale": "CrewAI voter concurs with evaluation",
                },
                response_to=["proposer"],
                delay_ms=150,
            ),
        ]


def create_crewai_decision_agents(
    client: MACPClient,
) -> tuple[CrewAIDecisionEvaluator, CrewAIDecisionVoter]:
    """Factory for creating CrewAI decision agents."""
    return CrewAIDecisionEvaluator(client), CrewAIDecisionVoter(client)
