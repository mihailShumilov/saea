import { PublicKey } from "@solana/web3.js";

export interface AgentConfig {
  rpcUrl: string;
  programId: PublicKey;
  walletPath: string;
  populationSize: number;
  genomeLenght: number;
  generationsToRun: number;
  roundsPerGeneration: number;
  mutationRateBps: number;
  minFitnessThreshold: number;
  maxAgents: number;
  elitismCount: number;
  tournamentSize: number;
  crossoverRate: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export const DEFAULT_CONFIG: AgentConfig = {
  rpcUrl: process.env.RPC_URL || "http://localhost:8899",
  programId: new PublicKey(
    process.env.PROGRAM_ID || "6tqMXifGhxp5WXY1XMdjHnhUguzgcLvTMuE3ijfdRJ4R"
  ),
  walletPath:
    process.env.WALLET_PATH ||
    `${process.env.HOME}/.config/solana/id.json`,
  populationSize: 8,
  genomeLenght: 16,
  generationsToRun: 5,
  roundsPerGeneration: 2,
  mutationRateBps: 3000,
  minFitnessThreshold: 500,
  maxAgents: 64,
  elitismCount: 2,
  tournamentSize: 3,
  crossoverRate: 0.7,
  logLevel: "info",
};
