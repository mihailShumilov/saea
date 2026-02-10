# Iteration Report

## Overview

This document describes the improvements made to the SAEA system after the initial implementation. The agent identified weaknesses in the scoring and mutation logic and made targeted improvements.

## Iteration 1: Enhanced Fitness Function (Sequence Bonus)

### Problem Identified
The initial fitness function had four components (proximity, diversity, balance, pattern), but all of them evaluated genes independently. No component considered the **relationships between consecutive genes**. This meant the fitness landscape couldn't distinguish between genomes with the same individual gene values but different structural arrangements.

### Improvement Made
Added a fifth scoring component: **Sequence Bonus**.

For each consecutive pair of genes `(genome[i], genome[i+1])`, the program:
1. Derives a "direction" from the round seed: `hash(seed, i, 0xFF).bytes[0] > 127` determines if the pair should be ascending or descending
2. Checks if the genome matches this expected ordering
3. Awards bonus points proportional to the gap between the genes (capped at 30 per pair)

This creates a richer fitness landscape that rewards structured genome patterns, not just individual gene values matching targets.

### Impact
- Genomes that happen to have correct inter-gene ordering now receive higher fitness
- Evolution now selects for both individual gene accuracy AND sequential structure
- The fitness landscape becomes more nuanced, providing more gradient for the evolutionary algorithm to follow

### Verification
All 11 tests pass after the improvement. The scoring remains fully deterministic.

## Iteration 2: Improved Crossover Operator

### Problem Identified
The initial crossover used **uniform crossover**, where each gene position is independently taken from one parent or the other. This breaks up contiguous segments of the genome, destroying sequential patterns that the new sequence bonus rewards.

### Improvement Made
Replaced uniform crossover with **two-point crossover**:
1. Two random crossover points are selected
2. Genes between the points come from parent 2
3. Genes outside the points come from parent 1

This preserves contiguous segments from both parents, maintaining sequential patterns that contribute to the sequence bonus.

### Impact
- Sequential patterns from fit parents are preserved through crossover
- The crossover operator now works synergistically with the sequence bonus
- Evolution can build on existing structural patterns rather than destroying them

### Verification
All tests pass. The agent's evolutionary loop produces consistent fitness improvements across generations.

## Iteration 3: Adaptive Mutation Rate

### Problem Identified (during initial design)
A fixed mutation rate causes either:
- Too much exploration (high rate) → good solutions are destroyed
- Too little exploration (low rate) → population gets stuck in local optima

### Improvement Made (incorporated during initial implementation)
Implemented adaptive mutation rate that responds to population fitness:
- **Stagnation** (no improvement): rate × 1.3 (up to 80%)
- **Improvement**: rate × 0.8 (down to 10%)

This was designed during the initial implementation phase after recognizing the limitation of fixed rates.

## Summary of Changes

| Component | Before | After | Rationale |
|-----------|--------|-------|-----------|
| Fitness components | 4 (proximity, diversity, balance, pattern) | 5 (+sequence bonus) | Reward inter-gene relationships |
| Crossover | Uniform | Two-point | Preserve contiguous segments |
| Mutation rate | Fixed | Adaptive | Balance exploration/exploitation |
| Fitness landscape complexity | Moderate | High | More gradient for evolution |

## Tests After All Iterations

```
  saea
    ✔ initializes the arena
    ✔ registers agents with genomes
    ✔ rejects invalid genome length
    ✔ runs a round and scores agents
    ✔ prevents double-scoring in same round
    ✔ submits a mutated genome
    ✔ runs a second round with updated genomes
    ✔ advances generation
    ✔ prunes low-fitness agent
    ✔ rejects unauthorized operations
    ✔ verifies deterministic fitness scoring

  11 passing
```

All improvements maintain backward compatibility and deterministic behavior.
