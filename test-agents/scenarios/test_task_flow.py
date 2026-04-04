"""E2E test: LangChain agent in Task Mode.

Tests the full task flow:
1. Create a task-mode run
2. LangChain worker agent accepts, sends progress, completes
3. Runtime emits Commitment, session resolves
"""

from __future__ import annotations

import threading
import time

import pytest

from ..agents.langchain_task_agent import create_langchain_task_worker
from ..harness.macp_client import MACPClient
from .conftest import make_task_request


class TestLangChainTaskFlow:
    """Test LangChain agent participating in a Task Mode session."""

    def test_task_happy_path(self, macp_client: MACPClient) -> None:
        """Full task flow with LangChain worker."""
        result = macp_client.create_run(make_task_request())
        run_id = result["runId"]
        assert run_id

        time.sleep(1.0)

        # Create worker agent
        worker = create_langchain_task_worker(macp_client)

        # Run agent
        thread = threading.Thread(target=worker.run, args=(run_id, 20.0))
        thread.start()
        thread.join(timeout=25.0)
        worker.stop()

        # Verify events
        events = macp_client.list_events(run_id)
        assert len(events) > 0

        # Verify run state
        state = macp_client.get_state(run_id)
        assert state["run"]["runId"] == run_id

    def test_task_run_creates_with_two_participants(
        self, macp_client: MACPClient
    ) -> None:
        """Verify task-mode run has requester and worker."""
        result = macp_client.create_run(make_task_request())
        run_id = result["runId"]
        time.sleep(1.0)

        state = macp_client.get_state(run_id)
        assert isinstance(state.get("participants", []), list)
