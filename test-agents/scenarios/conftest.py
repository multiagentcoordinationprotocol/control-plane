"""Pytest fixtures for MACP agent integration tests."""

from __future__ import annotations

import os
import time

import pytest

from ..harness.macp_client import MACPClient


@pytest.fixture(scope="session")
def control_plane_url() -> str:
    """URL of the running MACP control plane."""
    return os.environ.get("CONTROL_PLANE_URL", "http://localhost:3001")


@pytest.fixture(scope="session")
def api_key() -> str:
    """API key for authenticating with the control plane."""
    return os.environ.get("CONTROL_PLANE_API_KEY", "test-key-integration")


@pytest.fixture(scope="session")
def macp_client(control_plane_url: str, api_key: str) -> MACPClient:
    """Shared MACP HTTP client."""
    client = MACPClient(base_url=control_plane_url, api_key=api_key)

    # Wait for the control plane to be healthy
    retries = 30
    while retries > 0:
        try:
            result = client.healthz()
            if result.get("status") == "ok":
                break
        except Exception:
            pass
        retries -= 1
        time.sleep(1)

    if retries == 0:
        pytest.skip("Control plane not reachable")

    yield client
    client.close()


def make_decision_request(
    runtime_kind: str = "scripted-mock",
) -> dict:
    """Create a Decision Mode execution request."""
    return {
        "mode": "sandbox",
        "runtime": {"kind": runtime_kind},
        "session": {
            "modeName": "macp.mode.decision.v1",
            "modeVersion": "1.0.0",
            "configurationVersion": "1.0.0",
            "ttlMs": 60000,
            "participants": [
                {"id": "proposer", "role": "proposer"},
                {"id": "evaluator", "role": "evaluator"},
                {"id": "voter", "role": "voter"},
            ],
        },
        "kickoff": [
            {
                "from": "proposer",
                "to": ["evaluator", "voter"],
                "kind": "proposal",
                "messageType": "Proposal",
                "payload": {
                    "proposalId": "prop-1",
                    "option": "Deploy feature X",
                    "rationale": "Agent test proposal",
                },
            }
        ],
        "execution": {"tags": ["agent-e2e-test", "decision-mode"]},
    }


def make_task_request(runtime_kind: str = "scripted-mock") -> dict:
    """Create a Task Mode execution request."""
    return {
        "mode": "sandbox",
        "runtime": {"kind": runtime_kind},
        "session": {
            "modeName": "macp.mode.task.v1",
            "modeVersion": "1.0.0",
            "configurationVersion": "1.0.0",
            "ttlMs": 60000,
            "participants": [
                {"id": "requester", "role": "requester"},
                {"id": "worker", "role": "worker"},
            ],
        },
        "kickoff": [
            {
                "from": "requester",
                "to": ["worker"],
                "kind": "request",
                "messageType": "TaskRequest",
                "payload": {
                    "taskId": "task-1",
                    "description": "Process agent test data",
                },
            }
        ],
        "execution": {"tags": ["agent-e2e-test", "task-mode"]},
    }
