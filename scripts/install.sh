#!/bin/bash
set -euo pipefail

echo "Installing Aura AI..."

if ! command -v node &>/dev/null; then
  echo "Node.js 18+ is required. Install Node from https://nodejs.org/ and rerun this script." >&2
  exit 1
fi

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18+ is required. Current version: $(node --version)" >&2
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "npm is required to install the published Aura AI package." >&2
  exit 1
fi

echo "Using Node $(node --version)"

# Install Aura AI globally
# If npm reports "install scripts blocked" for bun, rerun as:
#   npm install -g --allow-scripts=bun @tungninh/aura-ai
# (keep sudo if the original install used sudo)
npm install -g @tungninh/aura-ai

if ! command -v aura &>/dev/null; then
  NPM_BIN="$(npm bin -g 2>/dev/null || printf "%s/bin" "$(npm prefix -g)")"
  echo "Aura AI installed, but 'aura' is not on PATH." >&2
  echo "Add your npm global bin directory to PATH, then rerun your shell: $NPM_BIN" >&2
  exit 1
fi

if ! aura help >/dev/null; then
  echo "Aura AI installed, but 'aura help' failed. Check your npm global install and PATH." >&2
  exit 1
fi

echo ""
echo "✅ Aura AI installed! Run 'aura init' to set up."
