#!/usr/bin/env bash
# Run MACP Control Plane E2E tests with Python agents (LangChain + CrewAI).
#
# Usage:
#   ./scripts/run-e2e.sh                     # Run all agent E2E tests
#   ./scripts/run-e2e.sh decision            # Run only decision flow tests
#   ./scripts/run-e2e.sh task                # Run only task flow tests
#   ./scripts/run-e2e.sh crewai              # Run only CrewAI tests
#   ./scripts/run-e2e.sh mixed               # Run mixed-framework test
#   ./scripts/run-e2e.sh integration         # Run TypeScript integration tests
#
# Prerequisites:
#   1. Copy .env.example to .env and configure (DATABASE_URL, etc.)
#   2. pip install -r test-agents/requirements.txt
#   3. Docker running (for test database): docker compose -f docker-compose.test.yml up -d

set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env if present (without overriding existing env vars)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "Loaded .env"
fi

case "${1:-all}" in
  integration)
    echo "Running TypeScript integration tests (mock runtime)..."
    echo "═══════════════════════════════════════════════════════"
    npm run test:integration
    ;;

  decision)
    echo "Running LangChain Decision Mode E2E tests..."
    echo "═══════════════════════════════════════════════════════"
    cd test-agents
    python -m pytest scenarios/test_decision_flow.py -v --tb=short
    ;;

  task)
    echo "Running LangChain Task Mode E2E tests..."
    echo "═══════════════════════════════════════════════════════"
    cd test-agents
    python -m pytest scenarios/test_task_flow.py -v --tb=short
    ;;

  crewai)
    echo "Running CrewAI E2E tests..."
    echo "═══════════════════════════════════════════════════════"
    cd test-agents
    python -m pytest scenarios/test_crewai_decision.py scenarios/test_crewai_task.py -v --tb=short
    ;;

  mixed)
    echo "Running Mixed Agent (LangChain + CrewAI) E2E tests..."
    echo "═══════════════════════════════════════════════════════"
    cd test-agents
    python -m pytest scenarios/test_mixed_agents.py -v --tb=short
    ;;

  all)
    echo "Running ALL agent E2E tests..."
    echo "═══════════════════════════════════════════════════════"
    cd test-agents
    python -m pytest scenarios/ -v --tb=short
    ;;

  *)
    echo "Unknown option: $1"
    echo "Usage: $0 [integration|decision|task|crewai|mixed|all]"
    exit 1
    ;;
esac
