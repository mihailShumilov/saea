use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use crate::state::{Arena, AgentAccount, MAX_GENOME_LEN};
use crate::errors::SaeaError;
use crate::events::AgentRegistered;

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        mut,
        seeds = [Arena::SEED],
        bump = arena.bump,
        constraint = arena.is_active @ SaeaError::ArenaNotActive,
        constraint = arena.active_agents < arena.max_agents @ SaeaError::MaxAgentsReached,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        init,
        payer = owner,
        space = 8 + AgentAccount::INIT_SPACE,
        seeds = [AgentAccount::SEED, arena.key().as_ref(), owner.key().as_ref(), &arena.total_agents.to_le_bytes()],
        bump,
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_agent(ctx: Context<RegisterAgent>, genome: Vec<u8>) -> Result<()> {
    require!(
        !genome.is_empty() && genome.len() <= MAX_GENOME_LEN,
        SaeaError::InvalidGenomeLength
    );

    let arena = &mut ctx.accounts.arena;
    let agent = &mut ctx.accounts.agent;
    let clock = Clock::get()?;

    let genome_hash = hash(&genome).to_bytes();

    agent.owner = ctx.accounts.owner.key();
    agent.genome = genome;
    agent.fitness = 0;
    agent.generation = arena.current_generation;
    agent.parent = Pubkey::default();
    agent.parent_genome_hash = [0u8; 32];
    agent.mutation_count = 0;
    agent.rounds_participated = 0;
    agent.total_fitness = 0;
    agent.is_active = true;
    agent.registered_at = clock.unix_timestamp;
    agent.last_round = 0;
    agent.bump = ctx.bumps.agent;

    arena.total_agents = arena.total_agents.checked_add(1).ok_or(SaeaError::ArithmeticOverflow)?;
    arena.active_agents = arena.active_agents.checked_add(1).ok_or(SaeaError::ArithmeticOverflow)?;

    emit!(AgentRegistered {
        agent: agent.key(),
        owner: agent.owner,
        genome_hash,
        generation: agent.generation,
    });

    msg!("Agent registered: gen={}, genome_len={}", agent.generation, agent.genome.len());
    Ok(())
}
