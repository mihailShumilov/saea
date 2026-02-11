use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("6tqMXifGhxp5WXY1XMdjHnhUguzgcLvTMuE3ijfdRJ4R");

#[program]
pub mod saea {
    use super::*;

    pub fn initialize_arena(
        ctx: Context<InitializeArena>,
        max_agents: u64,
        min_fitness_threshold: u64,
        mutation_rate_bps: u16,
    ) -> Result<()> {
        instructions::initialize_arena::handle_initialize_arena(
            ctx,
            max_agents,
            min_fitness_threshold,
            mutation_rate_bps,
        )
    }

    pub fn register_agent(ctx: Context<RegisterAgent>, genome: Vec<u8>) -> Result<()> {
        instructions::register_agent::handle_register_agent(ctx, genome)
    }

    pub fn submit_genome(
        ctx: Context<SubmitGenome>,
        new_genome: Vec<u8>,
        parent_key: Pubkey,
    ) -> Result<()> {
        instructions::submit_genome::handle_submit_genome(ctx, new_genome, parent_key)
    }

    pub fn run_round(ctx: Context<RunRound>) -> Result<()> {
        instructions::run_round::handle_run_round(ctx)
    }

    pub fn score_agent(ctx: Context<ScoreAgent>) -> Result<()> {
        instructions::run_round::score_agent_handler(ctx)
    }

    pub fn complete_round(ctx: Context<CompleteRound>) -> Result<()> {
        instructions::run_round::complete_round_handler(ctx)
    }

    pub fn prune_agent(ctx: Context<PruneAgent>) -> Result<()> {
        instructions::prune_agent::handle_prune_agent(ctx)
    }

    pub fn advance_generation(ctx: Context<AdvanceGeneration>) -> Result<()> {
        instructions::advance_generation::handle_advance_generation(ctx)
    }
}
