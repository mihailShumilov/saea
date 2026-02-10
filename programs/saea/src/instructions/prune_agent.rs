use anchor_lang::prelude::*;
use crate::state::{Arena, AgentAccount};
use crate::errors::SaeaError;
use crate::events::AgentPruned;

#[derive(Accounts)]
pub struct PruneAgent<'info> {
    #[account(
        mut,
        seeds = [Arena::SEED],
        bump = arena.bump,
        constraint = arena.is_active @ SaeaError::ArenaNotActive,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        mut,
        constraint = agent.is_active @ SaeaError::AgentNotActive,
        constraint = agent.fitness < arena.min_fitness_threshold @ SaeaError::AgentAboveThreshold,
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(
        constraint = authority.key() == arena.authority @ SaeaError::Unauthorized,
    )]
    pub authority: Signer<'info>,
}

pub fn handle_prune_agent(ctx: Context<PruneAgent>) -> Result<()> {
    let arena = &mut ctx.accounts.arena;
    let agent = &mut ctx.accounts.agent;

    agent.is_active = false;
    arena.active_agents = arena.active_agents.checked_sub(1).ok_or(SaeaError::ArithmeticOverflow)?;

    emit!(AgentPruned {
        agent: agent.key(),
        fitness: agent.fitness,
        generation: agent.generation,
    });

    msg!("Agent pruned: fitness={}, gen={}", agent.fitness, agent.generation);
    Ok(())
}
