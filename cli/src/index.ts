import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { ChainInteractor } from "../../agent/src/chain";
import { Logger } from "../../agent/src/logger";

const chalk = require("chalk");
const Table = require("cli-table3");

const DEFAULT_RPC = process.env.RPC_URL || "http://localhost:8899";
const DEFAULT_WALLET =
  process.env.WALLET_PATH ||
  `${process.env.HOME}/.config/solana/id.json`;
const DEFAULT_PROGRAM_ID =
  process.env.PROGRAM_ID || "6tqMXifGhxp5WXY1XMdjHnhUguzgcLvTMuE3ijfdRJ4R";

function getChain(options: any): ChainInteractor {
  const logger = new Logger("info");
  return new ChainInteractor(
    options.rpc || DEFAULT_RPC,
    options.wallet || DEFAULT_WALLET,
    new PublicKey(options.programId || DEFAULT_PROGRAM_ID),
    logger
  );
}

const program = new Command();

program
  .name("saea-cli")
  .description("Solana Autonomous Evolution Arena CLI")
  .version("1.0.0")
  .option("--rpc <url>", "Solana RPC URL", DEFAULT_RPC)
  .option("--wallet <path>", "Wallet keypair path", DEFAULT_WALLET)
  .option("--program-id <id>", "Program ID", DEFAULT_PROGRAM_ID);

program
  .command("arena")
  .description("Display arena state")
  .action(async () => {
    const chain = getChain(program.opts());
    const arena = await chain.getArena();
    if (!arena) {
      console.log(chalk.red("Arena not initialized"));
      return;
    }

    console.log(chalk.bold.cyan("\n  SAEA Arena State\n"));
    const table = new Table();
    table.push(
      { "Authority": arena.authority.toBase58() },
      { "Current Round": arena.currentRound },
      { "Current Generation": arena.currentGeneration },
      { "Total Agents": arena.totalAgents },
      { "Active Agents": arena.activeAgents },
      { "Max Agents": arena.maxAgents },
      { "Min Fitness Threshold": arena.minFitnessThreshold },
      { "Mutation Rate (bps)": arena.mutationRateBps },
      { "Active": arena.isActive ? chalk.green("Yes") : chalk.red("No") },
    );
    console.log(table.toString());
  });

program
  .command("leaderboard")
  .description("Display agent leaderboard")
  .option("-n, --top <number>", "Number of top agents to show", "20")
  .action(async (opts) => {
    const chain = getChain(program.opts());
    const agents = await chain.getAllAgents();
    const active = agents
      .filter((a) => a.isActive)
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, parseInt(opts.top));

    console.log(chalk.bold.cyan("\n  SAEA Leaderboard\n"));

    const table = new Table({
      head: [
        chalk.white("Rank"),
        chalk.white("Address"),
        chalk.white("Fitness"),
        chalk.white("Gen"),
        chalk.white("Mutations"),
        chalk.white("Rounds"),
        chalk.white("Avg Fitness"),
      ],
    });

    active.forEach((agent, i) => {
      const avg =
        agent.roundsParticipated > 0
          ? Math.floor(agent.totalFitness / agent.roundsParticipated)
          : 0;
      table.push([
        i + 1,
        agent.publicKey.toBase58().slice(0, 16) + "...",
        agent.fitness,
        agent.generation,
        agent.mutationCount,
        agent.roundsParticipated,
        avg,
      ]);
    });

    console.log(table.toString());
    console.log(`\nTotal agents: ${agents.length}, Active: ${active.length}`);
  });

program
  .command("agent <address>")
  .description("Display detailed agent info")
  .action(async (address) => {
    const chain = getChain(program.opts());
    const agentPda = new PublicKey(address);
    const agent = await chain.getAgent(agentPda);

    if (!agent) {
      console.log(chalk.red("Agent not found"));
      return;
    }

    console.log(chalk.bold.cyan("\n  Agent Details\n"));
    const table = new Table();
    table.push(
      { "Address": agentPda.toBase58() },
      { "Owner": agent.owner.toBase58() },
      { "Fitness": agent.fitness },
      { "Generation": agent.generation },
      { "Mutations": agent.mutationCount },
      { "Rounds": agent.roundsParticipated },
      { "Active": agent.isActive ? chalk.green("Yes") : chalk.red("No") },
      { "Parent": agent.parent.toBase58() },
      { "Genome (hex)": Buffer.from(agent.genome).toString("hex") },
      { "Last Round": agent.lastRound },
    );
    console.log(table.toString());
  });

program
  .command("round <number>")
  .description("Display round details")
  .action(async (number) => {
    const chain = getChain(program.opts());
    const round = await chain.getRound(parseInt(number));

    if (!round) {
      console.log(chalk.red("Round not found"));
      return;
    }

    console.log(chalk.bold.cyan(`\n  Round ${round.roundNumber} Details\n`));
    const table = new Table();
    table.push(
      { "Round": round.roundNumber },
      { "Generation": round.generation },
      { "Participants": round.participants },
      { "Best Fitness": round.bestFitness },
      { "Average Fitness": round.averageFitness },
      { "Worst Fitness": round.worstFitness },
      { "Complete": round.isComplete ? chalk.green("Yes") : chalk.yellow("In Progress") },
      { "Seed (hex)": Buffer.from(round.seed).toString("hex").slice(0, 32) + "..." },
    );
    console.log(table.toString());
  });

program
  .command("generations")
  .description("Display all generation stats")
  .action(async () => {
    const chain = getChain(program.opts());
    const arena = await chain.getArena();

    if (!arena) {
      console.log(chalk.red("Arena not initialized"));
      return;
    }

    console.log(chalk.bold.cyan("\n  Generation History\n"));

    const table = new Table({
      head: [
        chalk.white("Round"),
        chalk.white("Gen"),
        chalk.white("Participants"),
        chalk.white("Best"),
        chalk.white("Average"),
        chalk.white("Worst"),
        chalk.white("Complete"),
      ],
    });

    for (let r = 1; r <= arena.currentRound; r++) {
      const round = await chain.getRound(r);
      if (round) {
        table.push([
          round.roundNumber,
          round.generation,
          round.participants,
          round.bestFitness,
          round.averageFitness,
          round.worstFitness,
          round.isComplete ? chalk.green("Yes") : chalk.yellow("No"),
        ]);
      }
    }

    console.log(table.toString());
  });

program.parse(process.argv);
