use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use crate::state::{Arena, AgentAccount, MAX_GENOME_LEN};
use crate::errors::SaeaError;
use crate::events::GenomeSubmitted;

#[derive(Accounts)]
pub struct SubmitGenome<'info> {
    #[account(
        seeds = [Arena::SEED],
        bump = arena.bump,
        constraint = arena.is_active @ SaeaError::ArenaNotActive,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        mut,
        constraint = agent.owner == owner.key() @ SaeaError::Unauthorized,
        constraint = agent.is_active @ SaeaError::AgentNotActive,
    )]
    pub agent: Account<'info, AgentAccount>,
    pub owner: Signer<'info>,
}

pub fn handle_submit_genome(ctx: Context<SubmitGenome>, new_genome: Vec<u8>, parent_key: Pubkey) -> Result<()> {
    require!(
        !new_genome.is_empty() && new_genome.len() <= MAX_GENOME_LEN,
        SaeaError::InvalidGenomeLength
    );

    let agent = &mut ctx.accounts.agent;

    // Store the hash of the old genome as parent lineage
    let old_genome_hash = hash(&agent.genome).to_bytes();
    let new_genome_hash = hash(&new_genome).to_bytes();

    agent.parent_genome_hash = old_genome_hash;
    agent.parent = parent_key;
    agent.genome = new_genome;
    agent.mutation_count = agent.mutation_count.checked_add(1).ok_or(SaeaError::ArithmeticOverflow)?;
    agent.generation = ctx.accounts.arena.current_generation;

    emit!(GenomeSubmitted {
        agent: agent.key(),
        genome_hash: new_genome_hash,
        generation: agent.generation,
        mutation_count: agent.mutation_count,
        parent: agent.parent,
    });

    msg!("Genome submitted: mutation_count={}, gen={}", agent.mutation_count, agent.generation);
    Ok(())
}
