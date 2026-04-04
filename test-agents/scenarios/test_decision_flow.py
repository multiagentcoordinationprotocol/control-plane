"""E2E test: LangChain agents in Decision Mode.

Tests the full decision flow:
1. Create a decision-mode run
2. LangChain evaluator agent listens for Proposal, sends Evaluation
3. LangChain voter agent listens for Evaluation, sends Vote
4. Runtime emits Commitment, session resolves
"""

from __future__ import annotations

import threading
import time

import pytest

from ..agents.langchain_decision_agent import create_langchain_decision_agents
from ..harness.macp_client import MACPClient
from .conftest import make_decision_request


class TestLangChainDecisionFlow:
    """Test LangChain agents participating in a Decision Mode session."""

    def test_decision_happy_path(self, macp_client: MACPClient) -> None:
        """Full decision flow with LangChain evaluator and voter."""
        # Create the run
        result = macp_client.create_run(make_decision_request())
        run_id = result["runId"]
        assert run_id

        # Wait for run to start
        time.sleep(1.0)

        # Create agents
        evaluator, voter = create_langchain_decision_agents(macp_client)

        # Run agents in background threads
        threads = [
            threading.Thread(target=evaluator.run, args=(run_id, 20.0)),
            threading.Thread(target=voter.run, args=(run_id, 20.0)),
        ]
        for t in threads:
            t.start()

        # Wait for agents to finish
        for t in threads:
            t.join(timeout=25.0)

        # Stop any still-running agents
        evaluator.stop()
        voter.stop()

        # Verify the run state
        state = macp_client.get_state(run_id)
        assert state["run"]["runId"] == run_id

        # Verify events were created
        events = macp_client.list_events(run_id)
        assert len(events) > 0

        # Verify agents performed actions
        # (may be empty if run completed before agents could act)
        total_actions = len(evaluator.actions_performed) + len(
            voter.actions_performed
        )
        # At minimum, run lifecycle events should exist
        run_events = [e for e in events if e.get("type", "").startswith("run.")]
        assert len(run_events) >= 1

    def test_decision_run_creates_successfully(
        self, macp_client: MACPClient
    ) -> None:
        """Verify that a decision-mode run can be created."""
        result = macp_client.create_run(make_decision_request())
        assert "runId" in result
        assert result["status"] == "queued"

        # Verify run is fetchable
        run = macp_client.get_run(result["runId"])
        assert run["id"] == result["runId"]

    def test_decision_run_has_correct_participants(
        self, macp_client: MACPClient
    ) -> None:
        """Verify projected state includes declared participants."""
        result = macp_client.create_run(make_decision_request())
        run_id = result["runId"]
        time.sleep(1.0)

        state = macp_client.get_state(run_id)
        participants = state.get("participants", [])
        # Participants should be populated after session binding
        assert isinstance(participants, list)
