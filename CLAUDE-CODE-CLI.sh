#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# CLAUDE CODE CLI - NGHIMMO (Linux)
# ============================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo
echo "============================================================"
echo "          CLAUDE CODE CLI - POWERED BY NGHIMMO"
echo "============================================================"
echo
echo "  Server : https://api.xpiki.com/v1"
echo "  Check  : https://api.nghimmo.com/check"
echo
echo "============================================================"
echo

# Move into folder containing script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load NVM (important for claude installed via nvm)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
fi

# Ask for API key (hidden input)
read -rsp "Enter your API Key (sk-...): " APIKEY
echo

if [ -z "$APIKEY" ]; then
    echo
    echo -e "${RED}[ERROR] You did not enter an API Key.${NC}"
    exit 1
fi

# Session-only environment variables
export ANTHROPIC_BASE_URL="https://api.xpiki.com/v1"
export ANTHROPIC_AUTH_TOKEN="$APIKEY"
export ANTHROPIC_API_KEY="$APIKEY"
export ANTHROPIC_MODEL="kr/claude-opus-4.8"
export ANTHROPIC_SMALL_FAST_MODEL="kr/claude-sonnet-4.6"

echo
echo -e "${GREEN}[OK] Configuration complete.${NC}"
echo "Opening Claude Code in:"
echo "  $(pwd)"
echo

# Detect Claude
CLAUDE_BIN=""

if command -v claude >/dev/null 2>&1; then
    CLAUDE_BIN="$(command -v claude)"
else
    for candidate in "$HOME"/.nvm/versions/node/*/bin/claude; do
        if [ -x "$candidate" ]; then
            CLAUDE_BIN="$candidate"
            break
        fi
    done
fi

if [ -z "$CLAUDE_BIN" ]; then
    echo -e "${RED}[ERROR] Claude CLI not found.${NC}"
    echo
    echo "Install using:"
    echo "npm install -g @anthropic-ai/claude-code"
    exit 1
fi

# Launch Claude
"$CLAUDE_BIN"

echo
echo "============================================================"
echo "Claude Code has closed."
echo "============================================================"
read -n 1 -s -r -p "Press any key to exit..."
echo
