use crate::errors::SaeaError;
use crate::events::{AgentScored, RoundCompleted};
use crate::state::{AgentAccount, Arena, Round};
use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

#[derive(Accounts)]
pub struct RunRound<'info> {
    #[account(
        mut,
        seeds = [Arena::SEED],
        bump = arena.bump,
        constraint = arena.is_active @ SaeaError::ArenaNotActive,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        init,
        payer = authority,
        space = 8 + Round::INIT_SPACE,
        seeds = [Round::SEED, arena.key().as_ref(), &(arena.current_round + 1).to_le_bytes()],
        bump,
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        constraint = authority.key() == arena.authority @ SaeaError::Unauthorized,
    )]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Deterministic scoring function (v2 — improved with sequence bonus).
///
/// The fitness of a genome is computed from five components:
/// 1. Target proximity: closeness of each gene to a hash-derived target
/// 2. Diversity bonus: reward for genome variance
/// 3. Balance bonus: reward for centered gene distributions
/// 4. Pattern bonus: XOR-based structural matching
/// 5. Sequence bonus (NEW): reward for inter-gene relationships
///
/// The sequence bonus rewards consecutive gene pairs that match a
/// seed-derived ordering (ascending or descending). This creates a
/// richer fitness landscape that rewards structural patterns, not
/// just individual gene values.
pub fn compute_fitness(genome: &[u8], round_seed: &[u8; 32]) -> u64 {
    let genome_len = genome.len() as u64;
    if genome_len == 0 {
        return 0;
    }

    // Component 1: Target proximity score
    let mut proximity_score: u64 = 0;
    for (i, &gene) in genome.iter().enumerate() {
        let target_hash = hashv(&[round_seed.as_ref(), &[i as u8]]);
        let target = target_hash.to_bytes()[0];
        let diff = gene.abs_diff(target);
        proximity_score += (255 - diff as u64) as u64;
    }

    // Component 2: Diversity bonus
    let mean = genome.iter().map(|&g| g as u64).sum::<u64>() / genome_len;
    let variance: u64 = genome
        .iter()
        .map(|&g| {
            let diff = (g as u64).abs_diff(mean);
            diff * diff
        })
        .sum::<u64>()
        / genome_len;
    let diversity_bonus = std::cmp::min(variance / 10, 500);

    // Component 3: Balance bonus
    let total: u64 = genome.iter().map(|&g| g as u64).sum();
    let midpoint = 128 * genome_len;
    let balance_diff = total.abs_diff(midpoint);
    let max_balance_diff = 128 * genome_len;
    let balance_bonus = if max_balance_diff > 0 {
        (500 * (max_balance_diff - balance_diff)) / max_balance_diff
    } else {
        0
    };

    // Component 4: Pattern bonus
    let mut pattern_score: u64 = 0;
    for (i, &gene) in genome.iter().enumerate() {
        let seed_byte = round_seed[i % 32];
        let xor_result = gene ^ seed_byte;
        pattern_score += (xor_result.count_ones() as u64) * 10;
    }

    // Component 5: Sequence bonus (v2 improvement)
    // Reward consecutive gene pairs that follow seed-derived ordering.
    // For each pair (genome[i], genome[i+1]), check if the ordering
    // matches the direction implied by the seed.
    let mut sequence_score: u64 = 0;
    if genome.len() > 1 {
        for i in 0..genome.len() - 1 {
            let direction_hash = hashv(&[round_seed.as_ref(), &[i as u8], &[0xFF]]);
            let should_ascend = direction_hash.to_bytes()[0] > 127;
            let is_ascending = genome[i + 1] >= genome[i];
            if should_ascend == is_ascending {
                // Bonus proportional to how strongly the ordering holds
                let gap = if is_ascending {
                    genome[i + 1] as u64 - genome[i] as u64
                } else {
                    genome[i] as u64 - genome[i + 1] as u64
                };
                sequence_score += std::cmp::min(gap, 30);
            }
        }
    }

    proximity_score + diversity_bonus + balance_bonus + pattern_score + sequence_score
}

pub fn handle_run_round(ctx: Context<RunRound>) -> Result<()> {
    let arena = &mut ctx.accounts.arena;
    let clock = Clock::get()?;

    let new_round_number = arena
        .current_round
        .checked_add(1)
        .ok_or(SaeaError::ArithmeticOverflow)?;

    // Generate deterministic round seed
    let round_seed = hashv(&[
        arena.key().as_ref(),
        &new_round_number.to_le_bytes(),
        &arena.current_generation.to_le_bytes(),
        &clock.unix_timestamp.to_le_bytes(),
    ])
    .to_bytes();

    let round = &mut ctx.accounts.round;
    round.arena = arena.key();
    round.round_number = new_round_number;
    round.generation = arena.current_generation;
    round.participants = 0;
    round.best_fitness = 0;
    round.worst_fitness = u64::MAX;
    round.average_fitness = 0;
    round.total_fitness = 0;
    round.seed = round_seed;
    round.started_at = clock.unix_timestamp;
    round.completed_at = 0;
    round.is_complete = false;
    round.bump = ctx.bumps.round;

    arena.current_round = new_round_number;

    msg!(
        "Round {} started for generation {}",
        new_round_number,
        arena.current_generation
    );
    Ok(())
}

#[derive(Accounts)]
pub struct ScoreAgent<'info> {
    #[account(
        seeds = [Arena::SEED],
        bump = arena.bump,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        mut,
        seeds = [Round::SEED, arena.key().as_ref(), &round.round_number.to_le_bytes()],
        bump = round.bump,
        constraint = !round.is_complete @ SaeaError::RoundAlreadyComplete,
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        constraint = agent.is_active @ SaeaError::AgentNotActive,
        constraint = agent.last_round < round.round_number @ SaeaError::AlreadyParticipated,
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(
        constraint = authority.key() == arena.authority @ SaeaError::Unauthorized,
    )]
    pub authority: Signer<'info>,
}

pub fn score_agent_handler(ctx: Context<ScoreAgent>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let agent = &mut ctx.accounts.agent;

    let fitness = compute_fitness(&agent.genome, &round.seed);

    agent.fitness = fitness;
    agent.last_round = round.round_number;
    agent.rounds_participated = agent
        .rounds_participated
        .checked_add(1)
        .ok_or(SaeaError::ArithmeticOverflow)?;
    agent.total_fitness = agent
        .total_fitness
        .checked_add(fitness)
        .ok_or(SaeaError::ArithmeticOverflow)?;

    round.participants = round
        .participants
        .checked_add(1)
        .ok_or(SaeaError::ArithmeticOverflow)?;
    round.total_fitness = round
        .total_fitness
        .checked_add(fitness)
        .ok_or(SaeaError::ArithmeticOverflow)?;

    if fitness > round.best_fitness {
        round.best_fitness = fitness;
    }
    if fitness < round.worst_fitness {
        round.worst_fitness = fitness;
    }

    let genome_hash = solana_sha256_hasher::hash(&agent.genome).to_bytes();

    emit!(AgentScored {
        agent: agent.key(),
        round_number: round.round_number,
        fitness,
        genome_hash,
    });

    msg!("Agent scored: fitness={}", fitness);
    Ok(())
}

#[derive(Accounts)]
pub struct CompleteRound<'info> {
    #[account(
        seeds = [Arena::SEED],
        bump = arena.bump,
    )]
    pub arena: Account<'info, Arena>,
    #[account(
        mut,
        seeds = [Round::SEED, arena.key().as_ref(), &round.round_number.to_le_bytes()],
        bump = round.bump,
        constraint = !round.is_complete @ SaeaError::RoundAlreadyComplete,
    )]
    pub round: Account<'info, Round>,
    #[account(
        constraint = authority.key() == arena.authority @ SaeaError::Unauthorized,
    )]
    pub authority: Signer<'info>,
}

pub fn complete_round_handler(ctx: Context<CompleteRound>) -> Result<()> {
    let round = &mut ctx.accounts.round;
    let clock = Clock::get()?;

    round.average_fitness = if round.participants > 0 {
        round.total_fitness / round.participants
    } else {
        0
    };
    round.completed_at = clock.unix_timestamp;
    round.is_complete = true;

    if round.worst_fitness == u64::MAX {
        round.worst_fitness = 0;
    }

    emit!(RoundCompleted {
        round_number: round.round_number,
        generation: round.generation,
        participants: round.participants,
        best_fitness: round.best_fitness,
        average_fitness: round.average_fitness,
    });

    msg!(
        "Round {} completed: best={}, avg={}, participants={}",
        round.round_number,
        round.best_fitness,
        round.average_fitness,
        round.participants
    );
    Ok(())
}
