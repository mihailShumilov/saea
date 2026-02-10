import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  Connection,
  SystemProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import { Logger } from "./logger";

// We'll load the IDL at runtime
let idl: any;

export interface ArenaState {
  authority: PublicKey;
  currentRound: number;
  currentGeneration: number;
  totalAgents: number;
  activeAgents: number;
  maxAgents: number;
  minFitnessThreshold: number;
  mutationRateBps: number;
  isActive: boolean;
  rewardPool: number;
  bump: number;
}

export interface AgentState {
  publicKey: PublicKey;
  owner: PublicKey;
  genome: number[];
  fitness: number;
  generation: number;
  parent: PublicKey;
  parentGenomeHash: number[];
  mutationCount: number;
  roundsParticipated: number;
  totalFitness: number;
  isActive: boolean;
  registeredAt: number;
  lastRound: number;
  bump: number;
}

export interface RoundState {
  arena: PublicKey;
  roundNumber: number;
  generation: number;
  participants: number;
  bestFitness: number;
  worstFitness: number;
  averageFitness: number;
  totalFitness: number;
  seed: number[];
  startedAt: number;
  completedAt: number;
  isComplete: boolean;
  bump: number;
}

export class ChainInteractor {
  private connection: Connection;
  private provider: AnchorProvider;
  private program: Program;
  private wallet: Keypair;
  private logger: Logger;

  constructor(
    rpcUrl: string,
    walletPath: string,
    programId: PublicKey,
    logger: Logger
  ) {
    this.logger = logger;

    // Load wallet
    const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    this.wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    this.connection = new Connection(rpcUrl, "confirmed");
    const wallet = new Wallet(this.wallet);
    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(this.provider);

    // Load IDL from the target directory
    const idlPath = `${process.cwd()}/target/idl/saea.json`;
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    this.program = new Program(idl, this.provider);
    this.logger.info(`Chain interactor initialized. Wallet: ${this.wallet.publicKey.toBase58()}`);
    this.logger.info(`Program ID: ${programId.toBase58()}`);
  }

  get walletPublicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  getArenaPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("arena")],
      this.program.programId
    );
  }

  getAgentPda(
    arenaKey: PublicKey,
    ownerKey: PublicKey,
    agentIndex: number
  ): [PublicKey, number] {
    const indexBuf = Buffer.alloc(8);
    indexBuf.writeBigUInt64LE(BigInt(agentIndex));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), arenaKey.toBuffer(), ownerKey.toBuffer(), indexBuf],
      this.program.programId
    );
  }

  getRoundPda(arenaKey: PublicKey, roundNumber: number): [PublicKey, number] {
    const roundBuf = Buffer.alloc(8);
    roundBuf.writeBigUInt64LE(BigInt(roundNumber));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("round"), arenaKey.toBuffer(), roundBuf],
      this.program.programId
    );
  }

  async initializeArena(
    maxAgents: number,
    minFitnessThreshold: number,
    mutationRateBps: number
  ): Promise<string> {
    const [arenaPda] = this.getArenaPda();
    this.logger.info(`Initializing arena at ${arenaPda.toBase58()}...`);

    const tx = await this.program.methods
      .initializeArena(
        new anchor.BN(maxAgents),
        new anchor.BN(minFitnessThreshold),
        mutationRateBps
      )
      .accounts({
        arena: arenaPda,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    this.logger.info(`Arena initialized. TX: ${tx}`);
    return tx;
  }

  async registerAgent(genome: Buffer, agentIndex: number): Promise<{ tx: string; agentPda: PublicKey }> {
    const [arenaPda] = this.getArenaPda();
    const [agentPda] = this.getAgentPda(arenaPda, this.wallet.publicKey, agentIndex);

    this.logger.debug(`Registering agent ${agentIndex} at ${agentPda.toBase58()}...`);

    const tx = await this.program.methods
      .registerAgent(Buffer.from(genome))
      .accounts({
        arena: arenaPda,
        agent: agentPda,
        owner: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    this.logger.debug(`Agent registered. TX: ${tx}`);
    return { tx, agentPda };
  }

  async submitGenome(
    agentPda: PublicKey,
    newGenome: Buffer,
    parentKey: PublicKey
  ): Promise<string> {
    const [arenaPda] = this.getArenaPda();

    const tx = await this.program.methods
      .submitGenome(Buffer.from(newGenome), parentKey)
      .accounts({
        arena: arenaPda,
        agent: agentPda,
        owner: this.wallet.publicKey,
      } as any)
      .rpc();

    return tx;
  }

  async runRound(roundNumber: number): Promise<string> {
    const [arenaPda] = this.getArenaPda();
    const [roundPda] = this.getRoundPda(arenaPda, roundNumber);

    this.logger.info(`Starting round ${roundNumber}...`);

    const tx = await this.program.methods
      .runRound()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    this.logger.info(`Round ${roundNumber} started. TX: ${tx}`);
    return tx;
  }

  async scoreAgent(
    agentPda: PublicKey,
    roundNumber: number
  ): Promise<string> {
    const [arenaPda] = this.getArenaPda();
    const [roundPda] = this.getRoundPda(arenaPda, roundNumber);

    const tx = await this.program.methods
      .scoreAgent()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        agent: agentPda,
        authority: this.wallet.publicKey,
      } as any)
      .rpc();

    return tx;
  }

  async completeRound(roundNumber: number): Promise<string> {
    const [arenaPda] = this.getArenaPda();
    const [roundPda] = this.getRoundPda(arenaPda, roundNumber);

    const tx = await this.program.methods
      .completeRound()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        authority: this.wallet.publicKey,
      } as any)
      .rpc();

    this.logger.info(`Round ${roundNumber} completed. TX: ${tx}`);
    return tx;
  }

  async pruneAgent(agentPda: PublicKey): Promise<string> {
    const [arenaPda] = this.getArenaPda();

    const tx = await this.program.methods
      .pruneAgent()
      .accounts({
        arena: arenaPda,
        agent: agentPda,
        authority: this.wallet.publicKey,
      } as any)
      .rpc();

    return tx;
  }

  async advanceGeneration(): Promise<string> {
    const [arenaPda] = this.getArenaPda();

    const tx = await this.program.methods
      .advanceGeneration()
      .accounts({
        arena: arenaPda,
        authority: this.wallet.publicKey,
      } as any)
      .rpc();

    this.logger.info(`Generation advanced. TX: ${tx}`);
    return tx;
  }

  async getArena(): Promise<ArenaState | null> {
    try {
      const [arenaPda] = this.getArenaPda();
      const arena = await (this.program.account as any).arena.fetch(arenaPda);
      return {
        authority: arena.authority,
        currentRound: arena.currentRound.toNumber(),
        currentGeneration: arena.currentGeneration.toNumber(),
        totalAgents: arena.totalAgents.toNumber(),
        activeAgents: arena.activeAgents.toNumber(),
        maxAgents: arena.maxAgents.toNumber(),
        minFitnessThreshold: arena.minFitnessThreshold.toNumber(),
        mutationRateBps: arena.mutationRateBps,
        isActive: arena.isActive,
        rewardPool: arena.rewardPool.toNumber(),
        bump: arena.bump,
      };
    } catch {
      return null;
    }
  }

  async getAgent(agentPda: PublicKey): Promise<AgentState | null> {
    try {
      const agent = await (this.program.account as any).agentAccount.fetch(agentPda);
      return {
        publicKey: agentPda,
        owner: agent.owner,
        genome: Array.from(agent.genome),
        fitness: agent.fitness.toNumber(),
        generation: agent.generation.toNumber(),
        parent: agent.parent,
        parentGenomeHash: Array.from(agent.parentGenomeHash),
        mutationCount: agent.mutationCount.toNumber(),
        roundsParticipated: agent.roundsParticipated.toNumber(),
        totalFitness: agent.totalFitness.toNumber(),
        isActive: agent.isActive,
        registeredAt: agent.registeredAt.toNumber(),
        lastRound: agent.lastRound.toNumber(),
        bump: agent.bump,
      };
    } catch {
      return null;
    }
  }

  async getRound(roundNumber: number): Promise<RoundState | null> {
    try {
      const [arenaPda] = this.getArenaPda();
      const [roundPda] = this.getRoundPda(arenaPda, roundNumber);
      const round = await (this.program.account as any).round.fetch(roundPda);
      return {
        arena: round.arena,
        roundNumber: round.roundNumber.toNumber(),
        generation: round.generation.toNumber(),
        participants: round.participants.toNumber(),
        bestFitness: round.bestFitness.toNumber(),
        worstFitness: round.worstFitness.toNumber(),
        averageFitness: round.averageFitness.toNumber(),
        totalFitness: round.totalFitness.toNumber(),
        seed: Array.from(round.seed),
        startedAt: round.startedAt.toNumber(),
        completedAt: round.completedAt.toNumber(),
        isComplete: round.isComplete,
        bump: round.bump,
      };
    } catch {
      return null;
    }
  }

  async getAllAgents(): Promise<AgentState[]> {
    const accounts = await (this.program.account as any).agentAccount.all();
    return accounts.map((a: any) => ({
      publicKey: a.publicKey,
      owner: a.account.owner,
      genome: Array.from(a.account.genome),
      fitness: a.account.fitness.toNumber(),
      generation: a.account.generation.toNumber(),
      parent: a.account.parent,
      parentGenomeHash: Array.from(a.account.parentGenomeHash),
      mutationCount: a.account.mutationCount.toNumber(),
      roundsParticipated: a.account.roundsParticipated.toNumber(),
      totalFitness: a.account.totalFitness.toNumber(),
      isActive: a.account.isActive,
      registeredAt: a.account.registeredAt.toNumber(),
      lastRound: a.account.lastRound.toNumber(),
      bump: a.account.bump,
    }));
  }

  async requestAirdrop(amount: number = 10): Promise<void> {
    const sig = await this.connection.requestAirdrop(
      this.wallet.publicKey,
      amount * 1_000_000_000
    );
    await this.connection.confirmTransaction(sig, "confirmed");
    this.logger.info(`Airdrop of ${amount} SOL confirmed`);
  }
}
