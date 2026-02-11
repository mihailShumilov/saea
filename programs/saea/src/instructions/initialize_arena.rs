use crate::errors::SaeaError;
use crate::events::ArenaInitialized;
use crate::state::Arena;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeArena<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Arena::INIT_SPACE,
        seeds = [Arena::SEED],
        bump,
    )]
    pub arena: Account<'info, Arena>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_arena(
    ctx: Context<InitializeArena>,
    max_agents: u64,
    min_fitness_threshold: u64,
    mutation_rate_bps: u16,
) -> Result<()> {
    require!(max_agents >= 2, SaeaError::InvalidMaxAgents);
    require!(mutation_rate_bps <= 10_000, SaeaError::InvalidMutationRate);

    let arena = &mut ctx.accounts.arena;
    arena.authority = ctx.accounts.authority.key();
    arena.current_round = 0;
    arena.current_generation = 1;
    arena.total_agents = 0;
    arena.active_agents = 0;
    arena.max_agents = max_agents;
    arena.min_fitness_threshold = min_fitness_threshold;
    arena.mutation_rate_bps = mutation_rate_bps;
    arena.is_active = true;
    arena.reward_pool = 0;
    arena.bump = ctx.bumps.arena;

    emit!(ArenaInitialized {
        authority: arena.authority,
        max_agents,
        mutation_rate_bps,
    });

    msg!(
        "Arena initialized: max_agents={}, mutation_rate_bps={}",
        max_agents,
        mutation_rate_bps
    );
    Ok(())
}
