# Solana Autonomous Evolution Arena (SAEA)

An onchain evolutionary computation system where AI agents register strategies (genomes) on Solana, compete in deterministic scoring rounds, mutate strategies autonomously based on onchain results, and evolve across generations — all with publicly verifiable lineage and fitness history.

## Why It's Novel

SAEA demonstrates a new paradigm: **autonomous AI agents that evolve strategies entirely onchain**. Unlike traditional evolutionary algorithms that run in private memory, every genome, mutation, fitness score, and lineage relationship is permanently recorded on Solana. This creates a transparent, tamper-proof evolutionary process that anyone can verify and audit.

The system combines:
- **Deterministic onchain scoring** — fitness is computed by the Solana program, not by the agent
- **Verifiable lineage** — every mutation stores parent references and genome hashes
- **Adaptive evolution** — mutation rates adjust automatically based on population fitness trends
- **Multi-component fitness landscapes** — five scoring components create rich optimization challenges

## How Solana Is Used

SAEA uses Solana as the backbone for transparent, trustless evolutionary computation:

- **Onchain program** (Anchor/Rust) manages all arena state, agent registration, scoring, and evolution
- **PDA-based accounts** provide deterministic, collision-free identities for arenas, agents, and rounds
- **Deterministic fitness function** runs entirely onchain — given the same genome and round seed, the score is always identical
- **Events** emit a complete audit trail of every evolutionary action
- **Immutable history** ensures no fitness score or genome can be retroactively modified

See [docs/solana-usage.md](docs/solana-usage.md) for detailed Solana usage explanation.

## How the AI Agent Operated Autonomously

This entire project was autonomously designed, built, and iterated on by Claude Code. The agent:

1. **Planned** the architecture: chose Anchor for the program, TypeScript for the agent, designed the fitness function and evolutionary operators
2. **Implemented** the complete system: onchain program, autonomous offchain agent, CLI client, tests
3. **Debugged** compilation errors independently (Solana SDK API changes, Anchor module structure)
4. **Iterated** on the fitness function (added sequence bonus) and crossover operator (uniform → two-point) after identifying weaknesses
5. **Documented** every decision and improvement

See [docs/agent-autonomy-report.md](docs/agent-autonomy-report.md) for the full autonomy explanation.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Solana Blockchain                │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Arena    │  │ AgentAccount │  │   Round   │  │
│  │  (PDA)   │  │    (PDA)     │  │   (PDA)   │  │
│  └──────────┘  └──────────────┘  └───────────┘  │
│                                                   │
│  Instructions: initialize_arena, register_agent,  │
│  submit_genome, run_round, score_agent,           │
│  complete_round, prune_agent, advance_generation  │
└───────────────────────┬─────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
   ┌────────▼────────┐    ┌────────▼────────┐
   │  Autonomous AI   │    │    CLI Client    │
   │     Agent        │    │                  │
   │                  │    │  - View arena    │
   │  - Plan          │    │  - Leaderboard   │
   │  - Monitor state │    │  - Agent details │
   │  - Select parents│    │  - Round history │
   │  - Mutate genomes│    │                  │
   │  - Submit TXs    │    │                  │
   │  - Log decisions │    │                  │
   └──────────────────┘    └──────────────────┘
```

## Instructions to Run Locally

### Prerequisites

- Rust (stable)
- Node.js 18+
- Yarn

### Quick Start

```bash
# 1. Clone and bootstrap
git clone <repo-url>
cd saea
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh

# 2. Run tests
anchor test

# 3. Run the autonomous agent
# Start a local validator in a separate terminal:
solana-test-validator --reset

# In another terminal:
solana airdrop 20
anchor deploy
yarn agent

# 4. Use the CLI
yarn cli arena
yarn cli leaderboard
yarn cli generations
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_URL` | `http://localhost:8899` | Solana RPC endpoint |
| `WALLET_PATH` | `~/.config/solana/id.json` | Path to wallet keypair |
| `PROGRAM_ID` | (from declare_id!) | Deployed program ID |
| `GENERATIONS` | `5` | Number of generations to run |
| `POPULATION_SIZE` | `8` | Number of agents per generation |
| `ROUNDS_PER_GEN` | `2` | Rounds per generation |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

### Running with Custom Settings

```bash
GENERATIONS=10 POPULATION_SIZE=16 LOG_LEVEL=debug yarn agent
```

## Instructions to Deploy

### Devnet

```bash
# Configure for devnet
solana config set --url devnet

# Get devnet SOL
solana airdrop 5

# Build and deploy
anchor build
anchor deploy --provider.cluster devnet

# Update Anchor.toml cluster to devnet
# Run agent against devnet
RPC_URL=https://api.devnet.solana.com yarn agent
```

### Mainnet

Not recommended without thorough security audit. See [docs/security-review.md](docs/security-review.md).

## Project Structure

```
├── programs/saea/          # Anchor Solana program
│   └── src/
│       ├── lib.rs          # Program entrypoint
│       ├── state/          # Account definitions
│       ├── instructions/   # Instruction handlers
│       ├── errors.rs       # Error types
│       └── events.rs       # Event definitions
├── agent/src/              # Autonomous AI agent
│   ├── index.ts            # Entry point
│   ├── evolution.ts        # Evolution engine
│   ├── chain.ts            # Chain interaction
│   ├── genome.ts           # Mutation/crossover
│   ├── config.ts           # Configuration
│   └── logger.ts           # Logging
├── cli/src/                # CLI client
│   └── index.ts            # CLI commands
├── tests/                  # Integration tests
├── docs/                   # Documentation
│   ├── agent-autonomy-report.md
│   ├── iteration-report.md
│   ├── solana-usage.md
│   └── security-review.md
├── scripts/                # Helper scripts
└── .github/workflows/      # CI configuration
```

## Documentation

- [Agent Autonomy Report](docs/agent-autonomy-report.md) — How autonomous decisions were made
- [Iteration Report](docs/iteration-report.md) — What was improved and why
- [Solana Usage](docs/solana-usage.md) — How and why Solana is used
- [Security Review](docs/security-review.md) — Security analysis and recommendations

## License

MIT License — see [LICENSE](LICENSE)

## Attribution

This project was autonomously designed, built, and iterated on by Claude Code.
