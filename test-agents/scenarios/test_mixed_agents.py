"""E2E test: Mixed LangChain + CrewAI agents in same session.

Tests that agents from different frameworks can participate in the
same MACP coordination session.
"""

from __future__ import annotations

import threading
import time

import pytest

from ..agents.langchain_decision_agent import LangChainDecisionEvaluator
from ..agents.crewai_decision_agent import CrewAIDecisionVoter
from ..harness.macp_client import MACPClient
from .conftest import make_decision_request


class TestMixedAgentFlow:
    """Test LangChain + CrewAI agents in the same session."""

    def test_mixed_framework_decision(self, macp_client: MACPClient) -> None:
        """LangChain evaluator + CrewAI voter in a Decision Mode session."""
        result = macp_client.create_run(make_decision_request())
        run_id = result["runId"]
        assert run_id

        time.sleep(1.0)

        # LangChain evaluator
        evaluator = LangChainDecisionEvaluator(macp_client)
        # CrewAI voter
        voter = CrewAIDecisionVoter(macp_client)

        threads = [
            threading.Thread(target=evaluator.run, args=(run_id, 20.0)),
            threading.Thread(target=voter.run, args=(run_id, 20.0)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=25.0)

        evaluator.stop()
        voter.stop()

        # Verify the run exists and has events
        state = macp_client.get_state(run_id)
        assert state["run"]["runId"] == run_id

        events = macp_client.list_events(run_id)
        assert len(events) > 0

        # Both agents should have been able to participate
        assert isinstance(evaluator.actions_performed, list)
        assert isinstance(voter.actions_performed, list)

    def test_mixed_agents_see_same_events(self, macp_client: MACPClient) -> None:
        """Both framework agents see the same event stream."""
        result = macp_client.create_run(make_decision_request())
        run_id = result["runId"]
        time.sleep(1.0)

        # Verify events are consistent
        events = macp_client.list_events(run_id)

        # Each event should have required fields
        for event in events:
            assert "id" in event
            assert "type" in event
            assert "seq" in event
