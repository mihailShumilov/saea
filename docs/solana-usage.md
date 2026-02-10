# Solana Usage Explanation

## How Solana Is Used

SAEA uses Solana as the backbone of a fully onchain evolutionary computation system. Every aspect of the evolutionary process is recorded, verified, and executed through Solana:

### 1. Onchain Program (Smart Contract)

The core logic runs as an Anchor-based Solana program deployed onchain. It manages:

- **Arena initialization** with configurable parameters
- **Agent registration** with genome data stored onchain
- **Deterministic fitness scoring** computed entirely within the program
- **Round management** with seed generation for reproducibility
- **Agent pruning** based on fitness thresholds
- **Generation advancement** tracking evolutionary progress

### 2. Account Structure

| Account | Purpose | PDA Seeds |
|---------|---------|-----------|
| `Arena` | Global state: generations, rounds, agent counts, configuration | `["arena"]` |
| `AgentAccount` | Per-agent: genome, fitness, lineage, mutation history | `["agent", arena, owner, index]` |
| `Round` | Per-round: seed, statistics, participant data | `["round", arena, round_number]` |

### 3. Program Derived Addresses (PDAs)

PDAs provide deterministic, collision-free account addresses:

- **Arena PDA**: Single global arena derived from `["arena"]` seed
- **Agent PDAs**: Unique per agent, derived from arena key + owner + index. This prevents account collision and allows any party to compute an agent's address
- **Round PDAs**: Derived from arena + round number, ensuring each round has a unique, predictable account

### 4. Events for Transparency

The program emits events for every significant state change:

- `ArenaInitialized` — when the arena is created
- `AgentRegistered` — when a new agent joins
- `GenomeSubmitted` — when a genome is mutated
- `AgentScored` — when an agent receives a fitness score
- `RoundCompleted` — when round statistics are finalized
- `AgentPruned` — when weak agents are removed
- `GenerationAdvanced` — when evolution moves to the next generation

These events create a complete, verifiable audit trail of the entire evolutionary process.

### 5. Deterministic Scoring

The fitness function is entirely deterministic:

1. A round seed is generated from `hash(arena_key + round_number + generation + timestamp)`
2. For each gene position, a target value is derived from `hash(round_seed + position)`
3. Fitness combines four components:
   - **Proximity score**: How close each gene is to its target
   - **Diversity bonus**: Reward for genome variance (prevents convergence to uniform values)
   - **Balance bonus**: Reward for balanced gene distributions
   - **Pattern bonus**: XOR-based pattern matching with the seed

Given the same genome and round seed, the fitness score is always identical. This is verified by running the same computation onchain.

## Why Onchain Storage Matters

1. **Verifiable Lineage**: Every mutation, parent reference, and genome hash is stored onchain. Anyone can trace an agent's evolutionary history from genesis to current generation.

2. **Tamper-Proof Records**: Fitness scores cannot be manipulated after the fact. The deterministic scoring function ensures that scores are reproducible.

3. **Transparent Competition**: All participants see the same leaderboard, genome data, and round results. No hidden information.

4. **Immutable History**: Round seeds, participant counts, and statistics are permanently recorded, creating a complete history of the evolutionary process.

## Why This Could Not Exist Without Solana

1. **Trust-minimized verification**: Without a blockchain, participants would need to trust a centralized server to compute scores honestly. Solana's onchain execution ensures scores are computed by the program itself.

2. **Deterministic execution environment**: Solana's runtime provides a deterministic execution environment where the same inputs always produce the same outputs.

3. **Permissionless participation**: Any agent can register and compete without permission from a central authority.

4. **Permanent record**: Evolutionary history is stored permanently onchain, not in a database that could be altered or deleted.

5. **Composability**: Other programs could read agent fitness data, create derivative competitions, or build additional mechanics on top of the arena.

## Transaction Flow

```
Agent Registration:
  [Owner Wallet] → register_agent(genome) → [AgentAccount PDA created]

Round Execution:
  [Authority] → run_round() → [Round PDA created with seed]
  [Authority] → score_agent(agent) × N → [Fitness computed + stored]
  [Authority] → complete_round() → [Statistics finalized]

Evolution:
  [Agent reads onchain state] → selects parents → crossover → mutate
  [Agent] → submit_genome(new_genome) → [Genome updated onchain]
  [Authority] → advance_generation() → [Generation counter incremented]

Pruning:
  [Authority] → prune_agent(weak_agent) → [Agent deactivated]
```

## Data Sizes

- Arena account: ~130 bytes
- Agent account: ~250 bytes
- Round account: ~170 bytes

For a population of 64 agents over 10 generations with 2 rounds each, total onchain storage is approximately:
- 1 Arena + 64 Agents + 20 Rounds = ~17 KB

This is extremely efficient for the amount of verifiable evolutionary data stored.
