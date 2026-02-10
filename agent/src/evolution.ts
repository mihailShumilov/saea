import { PublicKey } from "@solana/web3.js";
import { ChainInteractor, AgentState } from "./chain";
import {
  randomGenome,
  mutateGenome,
  crossover,
  tournamentSelect,
  genomeHash,
  adaptMutationRate,
} from "./genome";
import { AgentConfig } from "./config";
import { Logger } from "./logger";

export interface GenerationReport {
  generation: number;
  roundsRun: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  bestGenomeHash: string;
  agentsPruned: number;
  agentsMutated: number;
  mutationRate: number;
  decisions: string[];
}

export class EvolutionEngine {
  private chain: ChainInteractor;
  private config: AgentConfig;
  private logger: Logger;
  private agentPdas: PublicKey[] = [];
  private currentMutationRate: number;
  private generationReports: GenerationReport[] = [];
  private previousBestFitness: number = 0;

  constructor(chain: ChainInteractor, config: AgentConfig, logger: Logger) {
    this.chain = chain;
    this.config = config;
    this.logger = logger;
    this.currentMutationRate = config.mutationRateBps;
  }

  getReports(): GenerationReport[] {
    return this.generationReports;
  }

  async initialize(): Promise<void> {
    this.logger.info("=== PHASE 1: PLANNING ===");
    this.logger.info(`Population size: ${this.config.populationSize}`);
    this.logger.info(`Genome length: ${this.config.genomeLenght}`);
    this.logger.info(`Generations to run: ${this.config.generationsToRun}`);
    this.logger.info(`Rounds per generation: ${this.config.roundsPerGeneration}`);
    this.logger.info(`Initial mutation rate: ${this.config.mutationRateBps} bps`);
    this.logger.info(`Elitism count: ${this.config.elitismCount}`);
    this.logger.info(`Tournament size: ${this.config.tournamentSize}`);
    this.logger.info(`Crossover rate: ${this.config.crossoverRate}`);

    // Ensure we have SOL for transactions
    try {
      await this.chain.requestAirdrop(20);
    } catch (e) {
      this.logger.warn(`Airdrop failed (may already have SOL): ${e}`);
    }

    // Check if arena already exists
    const existingArena = await this.chain.getArena();
    if (existingArena) {
      this.logger.info("Arena already exists, reusing...");
      return;
    }

    // Initialize the arena
    await this.chain.initializeArena(
      this.config.maxAgents,
      this.config.minFitnessThreshold,
      this.config.mutationRateBps
    );
    this.logger.info("Arena initialized successfully");
  }

  async registerPopulation(): Promise<void> {
    this.logger.info("=== PHASE 2: REGISTERING INITIAL POPULATION ===");

    const arena = await this.chain.getArena();
    if (!arena) throw new Error("Arena not found");

    const startIndex = arena.totalAgents;

    for (let i = 0; i < this.config.populationSize; i++) {
      const genome = randomGenome(this.config.genomeLenght);
      const idx = startIndex + i;
      const { agentPda } = await this.chain.registerAgent(genome, idx);
      this.agentPdas.push(agentPda);
      this.logger.info(
        `Agent ${i} registered: ${agentPda.toBase58().slice(0, 12)}... genome=${genomeHash(genome).slice(0, 12)}...`
      );
    }

    this.logger.info(`${this.config.populationSize} agents registered`);
  }

  async runGeneration(generationNumber: number): Promise<GenerationReport> {
    const decisions: string[] = [];
    const report: GenerationReport = {
      generation: generationNumber,
      roundsRun: 0,
      bestFitness: 0,
      averageFitness: 0,
      worstFitness: Infinity,
      bestGenomeHash: "",
      agentsPruned: 0,
      agentsMutated: 0,
      mutationRate: this.currentMutationRate,
      decisions: [],
    };

    this.logger.info(`\n=== GENERATION ${generationNumber} ===`);
    decisions.push(`Starting generation ${generationNumber}`);

    // Run rounds
    const arena = await this.chain.getArena();
    if (!arena) throw new Error("Arena not found");

    for (let r = 0; r < this.config.roundsPerGeneration; r++) {
      const roundNumber = arena.currentRound + r + 1;
      this.logger.info(`--- Round ${roundNumber} ---`);

      // Start round
      await this.chain.runRound(roundNumber);
      report.roundsRun++;

      // Score all active agents
      for (const agentPda of this.agentPdas) {
        const agent = await this.chain.getAgent(agentPda);
        if (agent && agent.isActive) {
          try {
            await this.chain.scoreAgent(agentPda, roundNumber);
          } catch (e: any) {
            this.logger.warn(`Failed to score agent ${agentPda.toBase58().slice(0, 8)}: ${e.message?.slice(0, 80)}`);
          }
        }
      }

      // Complete round
      await this.chain.completeRound(roundNumber);

      // Read round results
      const round = await this.chain.getRound(roundNumber);
      if (round) {
        this.logger.info(
          `Round ${roundNumber} results: best=${round.bestFitness}, avg=${round.averageFitness}, participants=${round.participants}`
        );
      }
    }

    // Fetch all agents and compute generation statistics
    const agents: AgentState[] = [];
    for (const pda of this.agentPdas) {
      const agent = await this.chain.getAgent(pda);
      if (agent && agent.isActive) {
        agents.push(agent);
      }
    }

    if (agents.length === 0) {
      this.logger.warn("No active agents found!");
      report.decisions = decisions;
      return report;
    }

    // Sort by fitness descending
    agents.sort((a, b) => b.fitness - a.fitness);

    const totalFitness = agents.reduce((s, a) => s + a.fitness, 0);
    report.bestFitness = agents[0].fitness;
    report.worstFitness = agents[agents.length - 1].fitness;
    report.averageFitness = Math.floor(totalFitness / agents.length);
    report.bestGenomeHash = genomeHash(Buffer.from(agents[0].genome));

    this.logger.info(`\nGeneration ${generationNumber} Summary:`);
    this.logger.info(`  Best fitness:  ${report.bestFitness}`);
    this.logger.info(`  Avg fitness:   ${report.averageFitness}`);
    this.logger.info(`  Worst fitness: ${report.worstFitness}`);
    this.logger.info(`  Active agents: ${agents.length}`);

    // AUTONOMOUS DECISION: Adapt mutation rate
    const oldRate = this.currentMutationRate;
    this.currentMutationRate = adaptMutationRate(
      this.currentMutationRate,
      this.previousBestFitness,
      report.bestFitness
    );
    if (this.currentMutationRate !== oldRate) {
      const direction = this.currentMutationRate > oldRate ? "increased" : "decreased";
      decisions.push(
        `Mutation rate ${direction} from ${oldRate} to ${this.currentMutationRate} bps ` +
        `(prev best: ${this.previousBestFitness}, curr best: ${report.bestFitness})`
      );
      this.logger.info(`  Mutation rate ${direction}: ${oldRate} -> ${this.currentMutationRate} bps`);
    }
    report.mutationRate = this.currentMutationRate;
    this.previousBestFitness = report.bestFitness;

    // EVOLUTIONARY STEP: Create next generation
    // Elite agents keep their genomes
    const elites = agents.slice(0, this.config.elitismCount);
    decisions.push(
      `Elitism: preserving top ${this.config.elitismCount} agents (fitness: ${elites.map(e => e.fitness).join(", ")})`
    );

    // Prune weakest agents
    const pruneCandidates = agents.filter(
      (a) => a.fitness < this.config.minFitnessThreshold
    );
    for (const candidate of pruneCandidates) {
      try {
        await this.chain.pruneAgent(candidate.publicKey);
        report.agentsPruned++;
        decisions.push(`Pruned agent ${candidate.publicKey.toBase58().slice(0, 8)} (fitness: ${candidate.fitness})`);
      } catch (e: any) {
        this.logger.debug(`Prune skipped: ${e.message?.slice(0, 60)}`);
      }
    }

    // Mutate non-elite agents
    const populationForSelection = agents.map((a) => ({
      genome: Buffer.from(a.genome),
      fitness: a.fitness,
    }));

    for (let i = this.config.elitismCount; i < agents.length; i++) {
      const agent = agents[i];
      if (!agent.isActive) continue;

      // Tournament selection for two parents
      const parent1 = tournamentSelect(
        populationForSelection,
        this.config.tournamentSize
      );
      const parent2 = tournamentSelect(
        populationForSelection,
        this.config.tournamentSize
      );

      // Crossover
      let childGenome = crossover(
        parent1.genome,
        parent2.genome,
        this.config.crossoverRate
      );

      // Mutation
      childGenome = mutateGenome(childGenome, this.currentMutationRate);

      // Submit new genome onchain
      try {
        await this.chain.submitGenome(
          agent.publicKey,
          childGenome,
          elites[0].publicKey // parent reference is the best agent
        );
        report.agentsMutated++;
        decisions.push(
          `Mutated agent ${agent.publicKey.toBase58().slice(0, 8)}: ` +
          `genome ${genomeHash(Buffer.from(agent.genome)).slice(0, 8)} -> ${genomeHash(childGenome).slice(0, 8)}`
        );
      } catch (e: any) {
        this.logger.warn(`Failed to submit genome for agent ${agent.publicKey.toBase58().slice(0, 8)}: ${e.message?.slice(0, 80)}`);
      }
    }

    this.logger.info(`  Agents mutated: ${report.agentsMutated}`);
    this.logger.info(`  Agents pruned:  ${report.agentsPruned}`);

    // Advance generation onchain
    await this.chain.advanceGeneration();

    report.decisions = decisions;
    this.generationReports.push(report);

    return report;
  }

  async run(): Promise<GenerationReport[]> {
    this.logger.info("========================================");
    this.logger.info("  SOLANA AUTONOMOUS EVOLUTION ARENA");
    this.logger.info("  Autonomous AI Agent Starting...");
    this.logger.info("========================================\n");

    await this.initialize();
    await this.registerPopulation();

    for (let g = 1; g <= this.config.generationsToRun; g++) {
      await this.runGeneration(g);
    }

    // Print final leaderboard
    this.logger.info("\n========================================");
    this.logger.info("  FINAL LEADERBOARD");
    this.logger.info("========================================");

    const allAgents = await this.chain.getAllAgents();
    const active = allAgents
      .filter((a) => a.isActive)
      .sort((a, b) => b.fitness - a.fitness);

    active.forEach((agent, i) => {
      this.logger.info(
        `  #${i + 1} | Fitness: ${agent.fitness} | Gen: ${agent.generation} | ` +
        `Mutations: ${agent.mutationCount} | ${agent.publicKey.toBase58().slice(0, 12)}...`
      );
    });

    this.logger.info("\n========================================");
    this.logger.info("  EVOLUTION SUMMARY");
    this.logger.info("========================================");
    for (const report of this.generationReports) {
      this.logger.info(
        `  Gen ${report.generation}: best=${report.bestFitness}, avg=${report.averageFitness}, ` +
        `mutated=${report.agentsMutated}, pruned=${report.agentsPruned}, rate=${report.mutationRate}bps`
      );
    }

    return this.generationReports;
  }
}
