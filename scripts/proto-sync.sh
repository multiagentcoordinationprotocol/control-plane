#!/usr/bin/env bash
# Sync proto files from the runtime's authoritative protos to the control plane.
# Usage: npm run proto:sync
#
# Assumes the runtime repo is at ../runtime relative to the control plane root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_ROOT="${RUNTIME_PROTO_DIR:-$CP_ROOT/../runtime}"

if [ ! -d "$RUNTIME_ROOT/proto" ]; then
  echo "ERROR: Runtime proto directory not found at $RUNTIME_ROOT/proto"
  echo "Set RUNTIME_PROTO_DIR to the runtime repo root, or place it at ../runtime"
  exit 1
fi

echo "Syncing protos from $RUNTIME_ROOT/proto → $CP_ROOT/proto"
rsync -av --delete "$RUNTIME_ROOT/proto/" "$CP_ROOT/proto/"
echo "Proto sync complete."
