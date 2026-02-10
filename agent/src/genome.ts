import { createHash } from "crypto";

/**
 * Genome mutation and crossover utilities.
 *
 * Mutation strategy: For each gene, with probability mutationRate,
 * apply one of three mutation types:
 * 1. Random reset: replace with a random value [0-255]
 * 2. Creep mutation: add/subtract small random delta
 * 3. Bit flip: flip a random bit
 *
 * Crossover strategy: Uniform crossover between two parents.
 * Each gene is independently taken from one parent or the other.
 *
 * Selection: Tournament selection with configurable tournament size.
 */

export function randomGenome(length: number): Buffer {
  const genome = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    genome[i] = Math.floor(Math.random() * 256);
  }
  return genome;
}

export function mutateGenome(
  genome: Buffer,
  mutationRateBps: number
): Buffer {
  const mutated = Buffer.from(genome);
  const rate = mutationRateBps / 10000;

  for (let i = 0; i < mutated.length; i++) {
    if (Math.random() < rate) {
      const mutationType = Math.random();
      if (mutationType < 0.33) {
        // Random reset
        mutated[i] = Math.floor(Math.random() * 256);
      } else if (mutationType < 0.66) {
        // Creep mutation: add/subtract [-20, 20]
        const delta = Math.floor(Math.random() * 41) - 20;
        mutated[i] = Math.max(0, Math.min(255, mutated[i] + delta));
      } else {
        // Bit flip
        const bit = 1 << Math.floor(Math.random() * 8);
        mutated[i] = mutated[i] ^ bit;
      }
    }
  }
  return mutated;
}

export function crossover(
  parent1: Buffer,
  parent2: Buffer,
  crossoverRate: number
): Buffer {
  const length = Math.min(parent1.length, parent2.length);
  const child = Buffer.alloc(length);

  if (Math.random() < crossoverRate) {
    // Two-point crossover (v2 improvement over uniform crossover)
    // Preserves contiguous segments from parents, maintaining sequence patterns
    const point1 = Math.floor(Math.random() * length);
    const point2 = Math.floor(Math.random() * length);
    const start = Math.min(point1, point2);
    const end = Math.max(point1, point2);

    for (let i = 0; i < length; i++) {
      child[i] = i >= start && i <= end ? parent2[i] : parent1[i];
    }
  } else {
    parent1.copy(child, 0, 0, length);
  }

  return child;
}

export function tournamentSelect(
  population: { genome: Buffer; fitness: number }[],
  tournamentSize: number
): { genome: Buffer; fitness: number } {
  let best: { genome: Buffer; fitness: number } | null = null;

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    const candidate = population[idx];
    if (best === null || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }

  return best!;
}

export function genomeHash(genome: Buffer): string {
  return createHash("sha256").update(genome).digest("hex");
}

/**
 * Adaptive mutation: increase mutation rate for stagnating populations,
 * decrease for improving ones.
 */
export function adaptMutationRate(
  currentRate: number,
  previousBestFitness: number,
  currentBestFitness: number
): number {
  if (currentBestFitness <= previousBestFitness) {
    // Stagnation: increase mutation rate (up to 80%)
    return Math.min(8000, Math.floor(currentRate * 1.3));
  } else {
    // Improvement: decrease mutation rate (down to 10%)
    return Math.max(1000, Math.floor(currentRate * 0.8));
  }
}
