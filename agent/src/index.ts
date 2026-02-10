import { DEFAULT_CONFIG } from "./config";
import { ChainInteractor } from "./chain";
import { EvolutionEngine } from "./evolution";
import { Logger } from "./logger";
import * as fs from "fs";

async function main() {
  const config = { ...DEFAULT_CONFIG };

  // Override from environment
  if (process.env.POPULATION_SIZE) {
    config.populationSize = parseInt(process.env.POPULATION_SIZE, 10);
  }
  if (process.env.GENERATIONS) {
    config.generationsToRun = parseInt(process.env.GENERATIONS, 10);
  }
  if (process.env.ROUNDS_PER_GEN) {
    config.roundsPerGeneration = parseInt(process.env.ROUNDS_PER_GEN, 10);
  }
  if (process.env.LOG_LEVEL) {
    config.logLevel = process.env.LOG_LEVEL as any;
  }

  const logger = new Logger(config.logLevel);
  logger.info("Starting Solana Autonomous Evolution Arena Agent...");

  const chain = new ChainInteractor(
    config.rpcUrl,
    config.walletPath,
    config.programId,
    logger
  );

  const engine = new EvolutionEngine(chain, config, logger);
  const reports = await engine.run();

  // Write reports to file
  const outputPath = `${process.cwd()}/agent-run-report.json`;
  fs.writeFileSync(outputPath, JSON.stringify(reports, null, 2));
  logger.info(`\nFull run report saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Agent fatal error:", err);
  process.exit(1);
});
