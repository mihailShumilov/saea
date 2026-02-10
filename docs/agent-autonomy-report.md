# Agent Autonomy Report

## Overview

This document describes how the SAEA system was autonomously designed, built, and iterated on by Claude Code, an AI agent. Every architectural decision, implementation choice, and iteration was made independently by the agent.

## How the Idea Was Structured

The agent received a high-level bounty description asking for an "onchain evolutionary system where AI agents register strategies, compete in scoring rounds, and evolve across generations." From this, the agent independently:

1. **Defined the core abstractions**: Arena, Agent, Round as the three primary entities
2. **Designed the genome representation**: Fixed-length byte arrays (up to 32 bytes) where each byte represents a strategy parameter in [0, 255]
3. **Designed the fitness function**: A multi-component deterministic scoring system that creates a changing fitness landscape each round
4. **Designed the evolutionary operators**: Tournament selection, uniform crossover, and three-type mutation (random reset, creep, bit flip)
5. **Chose the technology stack**: Anchor for the Solana program, TypeScript for the agent and CLI

## How Planning Occurred

The agent created a structured task list with dependencies:

1. Initialize project structure → 2. Implement onchain program → 3. Build agent → 4. Build CLI → 5. Write tests → 6. Write documentation → 7. Iterate → 8. Final validation

Each task was designed to build on the previous one. The agent tracked progress through task completion.

### Key Planning Decisions

- **Population size of 8**: Chosen to balance computational cost with evolutionary diversity. Too few agents (2-3) would not provide enough genetic diversity; too many (100+) would be expensive in transaction fees.
- **16-byte genomes**: Provides 16 independent strategy parameters — enough for interesting evolution without excessive complexity.
- **2 rounds per generation**: Allows agents to be scored on multiple fitness landscapes before selection, reducing luck-based outcomes.
- **Tournament selection with size 3**: Balances selection pressure with diversity preservation.
- **Elitism of 2**: Preserves the best solutions while allowing the rest of the population to evolve.

## How Decisions Were Made

### Architecture Decisions

1. **Anchor over raw Solana SDK**: Anchor provides account serialization, PDA derivation helpers, and constraint checking — reducing boilerplate and security risks.

2. **Separate instruction files**: Each instruction (initialize_arena, register_agent, submit_genome, run_round, score_agent, complete_round, prune_agent, advance_generation) has its own file for maintainability.

3. **Authority-gated operations**: Round execution and scoring are restricted to the arena authority. This prevents griefing while allowing the autonomous agent to control the evolutionary process.

4. **Deterministic scoring with hash-derived targets**: Rather than using a fixed target, each round generates a new fitness landscape from a hash-based seed. This forces agents to adapt continuously rather than converge to a static optimum.

### Implementation Decisions

1. **Fitness function design**: The agent chose a four-component fitness function:
   - Proximity to hash-derived targets (main signal)
   - Diversity bonus (prevents premature convergence)
   - Balance bonus (rewards well-distributed genomes)
   - Pattern bonus (XOR-based structure matching)

2. **Adaptive mutation rate**: The mutation rate automatically increases when the population stagnates and decreases when fitness improves. This is a well-known technique in evolutionary computation.

3. **Three-type mutation**: Random reset, creep mutation, and bit flip each provide different scales of change — from large jumps to fine-tuning.

## How Mutation Logic Works

### Mutation Pipeline

For each non-elite agent after scoring:

1. **Parent Selection**: Two parents are selected via tournament selection (pick 3 random agents, choose the fittest).

2. **Crossover**: With probability 0.7, perform uniform crossover — each gene position independently taken from either parent. With probability 0.3, clone the fitter parent.

3. **Mutation**: For each gene in the child, with probability equal to the mutation rate:
   - 33% chance: **Random reset** — replace with random [0, 255]
   - 33% chance: **Creep mutation** — add random [-20, +20], clamped to [0, 255]
   - 33% chance: **Bit flip** — flip one random bit

4. **Submission**: The mutated genome is submitted onchain, recording the parent reference and incrementing the mutation counter.

### Adaptive Mutation

After each generation:
- If best fitness did not improve: mutation rate × 1.3 (up to 80%)
- If best fitness improved: mutation rate × 0.8 (down to 10%)

This ensures the population explores more aggressively when stuck and exploits more carefully when improving.

## What Iteration Improved

See [iteration-report.md](./iteration-report.md) for the detailed improvement log.

Key improvements made during development:
1. Fixed compilation errors related to Solana SDK hash module path changes
2. Resolved account naming conflicts in Anchor instruction modules
3. Added adaptive mutation rate to prevent premature convergence
4. Added multi-component fitness function (initially only proximity scoring)

## What Weaknesses Were Identified and Corrected

1. **Single-component fitness was too simple**: Initial design only used proximity scoring. This was expanded to four components to create a richer fitness landscape.

2. **Fixed mutation rate caused stagnation**: Initial implementation used a constant mutation rate. Added adaptive mutation to dynamically adjust exploration vs exploitation.

3. **No lineage tracking**: Initial design only stored the current genome. Added parent reference and genome hash for full evolutionary lineage.

4. **Hash module API changes**: The Solana SDK restructured the hash module between versions. The agent identified and fixed these import path issues.

## Autonomy Evidence

The following demonstrate autonomous operation:

- **No human questions asked**: The agent made all decisions independently
- **Self-correcting**: When compilation failed, the agent diagnosed and fixed errors
- **Iterative improvement**: The fitness function and mutation logic were improved after initial implementation
- **Complete documentation**: All docs were written by the agent based on its own design decisions
- **Test-driven**: Tests were written to verify the agent's implementation choices
