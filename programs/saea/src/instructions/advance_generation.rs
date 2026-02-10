use anchor_lang::prelude::*;
use crate::state::Arena;
use crate::errors::SaeaError;
use crate::events::GenerationAdvanced;

#[derive(Accounts)]
pub struct AdvanceGeneration<'info> {
    #[account(
        mut,
        seeds = [Arena::SEED],
        bump = arena.bump,
        constraint = arena.is_active @ SaeaError::ArenaNotActive,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        constraint = authority.key() == arena.authority @ SaeaError::Unauthorized,
    )]
    pub authority: Signer<'info>,
}

pub fn handle_advance_generation(ctx: Context<AdvanceGeneration>) -> Result<()> {
    let arena = &mut ctx.accounts.arena;
    let old_generation = arena.current_generation;
    arena.current_generation = old_generation.checked_add(1).ok_or(SaeaError::ArithmeticOverflow)?;

    emit!(GenerationAdvanced {
        old_generation,
        new_generation: arena.current_generation,
        active_agents: arena.active_agents,
    });

    msg!("Generation advanced: {} -> {}, active_agents={}",
        old_generation, arena.current_generation, arena.active_agents);
    Ok(())
}
