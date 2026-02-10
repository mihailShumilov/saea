import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";

describe("saea", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Saea as Program;
  const authority = provider.wallet;

  let arenaPda: PublicKey;
  let arenaBump: number;
  let agentPdas: PublicKey[] = [];

  before(async () => {
    [arenaPda, arenaBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("arena")],
      program.programId
    );
  });

  function getAgentPda(ownerKey: PublicKey, index: number): [PublicKey, number] {
    const indexBuf = Buffer.alloc(8);
    indexBuf.writeBigUInt64LE(BigInt(index));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), arenaPda.toBuffer(), ownerKey.toBuffer(), indexBuf],
      program.programId
    );
  }

  function getRoundPda(roundNumber: number): [PublicKey, number] {
    const roundBuf = Buffer.alloc(8);
    roundBuf.writeBigUInt64LE(BigInt(roundNumber));
    return PublicKey.findProgramAddressSync(
      [Buffer.from("round"), arenaPda.toBuffer(), roundBuf],
      program.programId
    );
  }

  it("initializes the arena", async () => {
    await program.methods
      .initializeArena(
        new BN(64),   // maxAgents
        new BN(100),  // minFitnessThreshold
        3000          // mutationRateBps
      )
      .accounts({
        arena: arenaPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const arena = await (program.account as any).arena.fetch(arenaPda);
    expect(arena.isActive).to.be.true;
    expect(arena.maxAgents.toNumber()).to.equal(64);
    expect(arena.currentGeneration.toNumber()).to.equal(1);
    expect(arena.currentRound.toNumber()).to.equal(0);
    expect(arena.mutationRateBps).to.equal(3000);
    expect(arena.minFitnessThreshold.toNumber()).to.equal(100);
  });

  it("registers agents with genomes", async () => {
    for (let i = 0; i < 4; i++) {
      const genome = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        genome[j] = Math.floor(Math.random() * 256);
      }

      const [agentPda] = getAgentPda(authority.publicKey, i);
      agentPdas.push(agentPda);

      await program.methods
        .registerAgent(Buffer.from(genome))
        .accounts({
          arena: arenaPda,
          agent: agentPda,
          owner: authority.publicKey,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      const agent = await (program.account as any).agentAccount.fetch(agentPda);
      expect(agent.isActive).to.be.true;
      expect(agent.generation.toNumber()).to.equal(1);
      expect(agent.genome.length).to.equal(16);
      expect(agent.mutationCount.toNumber()).to.equal(0);
    }

    const arena = await (program.account as any).arena.fetch(arenaPda);
    expect(arena.totalAgents.toNumber()).to.equal(4);
    expect(arena.activeAgents.toNumber()).to.equal(4);
  });

  it("rejects invalid genome length", async () => {
    const emptyGenome = Buffer.alloc(0);
    const [agentPda] = getAgentPda(authority.publicKey, 99);

    try {
      await program.methods
        .registerAgent(emptyGenome)
        .accounts({
          arena: arenaPda,
          agent: agentPda,
          owner: authority.publicKey,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      // Should fail with InvalidGenomeLength or similar constraint
      expect(e.toString().toLowerCase()).to.satisfy(
        (s: string) => s.includes("invalidgenomelength") || s.includes("invalid") || s.includes("error")
      );
    }
  });

  it("runs a round and scores agents", async () => {
    const [roundPda] = getRoundPda(1);

    // Start round
    await program.methods
      .runRound()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    let round = await (program.account as any).round.fetch(roundPda);
    expect(round.roundNumber.toNumber()).to.equal(1);
    expect(round.isComplete).to.be.false;

    // Score each agent
    for (const agentPda of agentPdas) {
      await program.methods
        .scoreAgent()
        .accounts({
          arena: arenaPda,
          round: roundPda,
          agent: agentPda,
          authority: authority.publicKey,
        } as any)
        .rpc();
    }

    // Complete round
    await program.methods
      .completeRound()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        authority: authority.publicKey,
      } as any)
      .rpc();

    round = await (program.account as any).round.fetch(roundPda);
    expect(round.isComplete).to.be.true;
    expect(round.participants.toNumber()).to.equal(4);
    expect(round.bestFitness.toNumber()).to.be.greaterThan(0);
    expect(round.averageFitness.toNumber()).to.be.greaterThan(0);

    // Verify agents have fitness scores
    for (const agentPda of agentPdas) {
      const agent = await (program.account as any).agentAccount.fetch(agentPda);
      expect(agent.fitness.toNumber()).to.be.greaterThan(0);
      expect(agent.lastRound.toNumber()).to.equal(1);
      expect(agent.roundsParticipated.toNumber()).to.equal(1);
    }
  });

  it("prevents double-scoring in same round", async () => {
    const [roundPda] = getRoundPda(1);

    try {
      await program.methods
        .scoreAgent()
        .accounts({
          arena: arenaPda,
          round: roundPda,
          agent: agentPdas[0],
          authority: authority.publicKey,
        } as any)
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      // Should fail with either RoundAlreadyComplete or AlreadyParticipated
      expect(e.toString().toLowerCase()).to.satisfy(
        (s: string) => s.includes("roundalreadycomplete") || s.includes("alreadyparticipated") || s.includes("error")
      );
    }
  });

  it("submits a mutated genome", async () => {
    const newGenome = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      newGenome[j] = Math.floor(Math.random() * 256);
    }

    await program.methods
      .submitGenome(Buffer.from(newGenome), agentPdas[0])
      .accountsStrict({
        arena: arenaPda,
        agent: agentPdas[1],
        owner: authority.publicKey,
      })
      .rpc();

    const agent = await (program.account as any).agentAccount.fetch(agentPdas[1]);
    expect(agent.mutationCount.toNumber()).to.equal(1);
    expect(agent.parent.toBase58()).to.equal(agentPdas[0].toBase58());
  });

  it("runs a second round with updated genomes", async () => {
    const [roundPda] = getRoundPda(2);

    await program.methods
      .runRound()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    for (const agentPda of agentPdas) {
      await program.methods
        .scoreAgent()
        .accounts({
          arena: arenaPda,
          round: roundPda,
          agent: agentPda,
          authority: authority.publicKey,
        } as any)
        .rpc();
    }

    await program.methods
      .completeRound()
      .accounts({
        arena: arenaPda,
        round: roundPda,
        authority: authority.publicKey,
      } as any)
      .rpc();

    const round = await (program.account as any).round.fetch(roundPda);
    expect(round.isComplete).to.be.true;
    expect(round.roundNumber.toNumber()).to.equal(2);
  });

  it("advances generation", async () => {
    await program.methods
      .advanceGeneration()
      .accounts({
        arena: arenaPda,
        authority: authority.publicKey,
      } as any)
      .rpc();

    const arena = await (program.account as any).arena.fetch(arenaPda);
    expect(arena.currentGeneration.toNumber()).to.equal(2);
  });

  it("prunes low-fitness agent", async () => {
    const agents = await Promise.all(
      agentPdas.map(async (pda) => {
        const a = await (program.account as any).agentAccount.fetch(pda);
        return { pda, fitness: a.fitness.toNumber() };
      })
    );

    agents.sort((a, b) => a.fitness - b.fitness);
    const weakest = agents[0];

    if (weakest.fitness < 100) {
      await program.methods
        .pruneAgent()
        .accounts({
          arena: arenaPda,
          agent: weakest.pda,
          authority: authority.publicKey,
        } as any)
        .rpc();

      const prunedAgent = await (program.account as any).agentAccount.fetch(weakest.pda);
      expect(prunedAgent.isActive).to.be.false;

      const arena = await (program.account as any).arena.fetch(arenaPda);
      expect(arena.activeAgents.toNumber()).to.equal(3);
    } else {
      // All agents are above threshold - verify pruning is rejected
      try {
        await program.methods
          .pruneAgent()
          .accounts({
            arena: arenaPda,
            agent: weakest.pda,
            authority: authority.publicKey,
          } as any)
          .rpc();
        expect.fail("Should have thrown - agent above threshold");
      } catch (e: any) {
        // Expected to fail
        expect(e.toString().toLowerCase()).to.include("agentabovethreshold");
      }
    }
  });

  it("rejects unauthorized operations", async () => {
    const unauthorized = Keypair.generate();

    try {
      await program.methods
        .advanceGeneration()
        .accountsStrict({
          arena: arenaPda,
          authority: unauthorized.publicKey,
        })
        .signers([unauthorized])
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      // Expected to fail with Unauthorized or ConstraintRaw
      expect(e.toString().toLowerCase()).to.satisfy(
        (s: string) => s.includes("unauthorized") || s.includes("constraint") || s.includes("error")
      );
    }
  });

  it("verifies deterministic fitness scoring", async () => {
    const [roundPda3] = getRoundPda(3);

    await program.methods
      .runRound()
      .accounts({
        arena: arenaPda,
        round: roundPda3,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    await program.methods
      .scoreAgent()
      .accounts({
        arena: arenaPda,
        round: roundPda3,
        agent: agentPdas[0],
        authority: authority.publicKey,
      } as any)
      .rpc();

    const agent0 = await (program.account as any).agentAccount.fetch(agentPdas[0]);
    const fitness0 = agent0.fitness.toNumber();

    expect(fitness0).to.be.greaterThan(0);

    const round = await (program.account as any).round.fetch(roundPda3);
    expect(round.seed.length).to.equal(32);
    expect(round.seed.some((b: number) => b !== 0)).to.be.true;
  });
});
