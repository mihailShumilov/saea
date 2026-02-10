#!/bin/bash
set -e

echo "=== SAEA Bootstrap Script ==="
echo ""

# Check Rust
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo "Rust: $(rustc --version)"

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi
echo "Solana: $(solana --version)"

# Check Anchor
if ! command -v anchor &> /dev/null; then
    echo "Installing Anchor..."
    cargo install --git https://github.com/coral-xyz/anchor avm --force
    avm install 0.32.1
    avm use 0.32.1
fi
echo "Anchor: $(anchor --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required. Install from https://nodejs.org/"
    exit 1
fi
echo "Node: $(node --version)"

# Setup Solana keypair if needed
if [ ! -f "$HOME/.config/solana/id.json" ]; then
    echo "Generating Solana keypair..."
    solana-keygen new --no-bip39-passphrase --force
fi

# Configure for localhost
solana config set --url localhost

# Install Node dependencies
echo ""
echo "Installing Node.js dependencies..."
yarn install

# Build the program
echo ""
echo "Building Solana program..."
anchor build

echo ""
echo "=== Bootstrap complete! ==="
echo ""
echo "Next steps:"
echo "  1. Start local validator:  solana-test-validator"
echo "  2. Run tests:              anchor test"
echo "  3. Run agent:              yarn agent"
echo "  4. Use CLI:                yarn cli arena"
