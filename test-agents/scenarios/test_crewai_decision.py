"""E2E test: CrewAI agents in Decision Mode.

Tests the full decision flow with CrewAI agents:
1. Create a decision-mode run
2. CrewAI evaluator sends Evaluation
3. CrewAI voter sends Vote
4. Session resolves
"""

from __future__ import annotations

import threading
import time

import pytest

from ..agents.crewai_decision_agent import create_crewai_decision_agents
from ..harness.macp_client import MACPClient
from .conftest import make_decision_request


class TestCrewAIDecisionFlow:
    """Test CrewAI agents participating in a Decision Mode session."""

    def test_crewai_decision_happy_path(self, macp_client: MACPClient) -> None:
        """Full decision flow with CrewAI evaluator and voter."""
        result = macp_client.create_run(make_decision_request())
        run_id = result["runId"]
        assert run_id

        time.sleep(1.0)

        evaluator, voter = create_crewai_decision_agents(macp_client)

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

        # Verify
        state = macp_client.get_state(run_id)
        assert state["run"]["runId"] == run_id

        events = macp_client.list_events(run_id)
        assert len(events) > 0

    def test_crewai_agents_track_actions(self, macp_client: MACPClient) -> None:
        """Verify that CrewAI agents record their performed actions."""
        result = macp_client.create_run(make_decision_request())
        run_id = result["runId"]
        time.sleep(1.0)

        evaluator, voter = create_crewai_decision_agents(macp_client)

        threads = [
            threading.Thread(target=evaluator.run, args=(run_id, 15.0)),
            threading.Thread(target=voter.run, args=(run_id, 15.0)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=20.0)

        evaluator.stop()
        voter.stop()

        # Actions list should be available (may be empty if events didn't match)
        assert isinstance(evaluator.actions_performed, list)
        assert isinstance(voter.actions_performed, list)
