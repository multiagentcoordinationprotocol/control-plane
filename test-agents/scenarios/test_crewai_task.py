"""E2E test: CrewAI agent in Task Mode.

Tests the full task flow with a CrewAI worker agent.
"""

from __future__ import annotations

import threading
import time

import pytest

from ..agents.crewai_task_agent import create_crewai_task_worker
from ..harness.macp_client import MACPClient
from .conftest import make_task_request


class TestCrewAITaskFlow:
    """Test CrewAI agent participating in a Task Mode session."""

    def test_crewai_task_happy_path(self, macp_client: MACPClient) -> None:
        """Full task flow with CrewAI worker."""
        result = macp_client.create_run(make_task_request())
        run_id = result["runId"]
        assert run_id

        time.sleep(1.0)

        worker = create_crewai_task_worker(macp_client)

        thread = threading.Thread(target=worker.run, args=(run_id, 20.0))
        thread.start()
        thread.join(timeout=25.0)
        worker.stop()

        # Verify
        state = macp_client.get_state(run_id)
        assert state["run"]["runId"] == run_id

        events = macp_client.list_events(run_id)
        assert len(events) > 0
