#!/bin/bash
set -e

echo "=== SAEA Agent Runner ==="
echo ""

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Check if validator is running
if ! solana cluster-version 2>/dev/null; then
    echo "Starting local validator..."
    solana-test-validator --reset &
    VALIDATOR_PID=$!
    sleep 5
    echo "Validator started (PID: $VALIDATOR_PID)"
fi

# Airdrop SOL
echo "Requesting SOL airdrop..."
solana airdrop 20 2>/dev/null || true

# Deploy program
echo "Deploying program..."
anchor deploy 2>/dev/null || echo "Program may already be deployed"

# Run the agent
echo ""
echo "Starting autonomous evolution agent..."
echo ""
GENERATIONS=${GENERATIONS:-5} \
POPULATION_SIZE=${POPULATION_SIZE:-8} \
ROUNDS_PER_GEN=${ROUNDS_PER_GEN:-2} \
LOG_LEVEL=${LOG_LEVEL:-info} \
yarn agent

# Cleanup
if [ -n "$VALIDATOR_PID" ]; then
    echo "Stopping validator..."
    kill $VALIDATOR_PID 2>/dev/null || true
fi
