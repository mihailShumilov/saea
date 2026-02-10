use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Arena {
    pub authority: Pubkey,
    pub current_round: u64,
    pub current_generation: u64,
    pub total_agents: u64,
    pub active_agents: u64,
    pub max_agents: u64,
    pub min_fitness_threshold: u64,
    pub mutation_rate_bps: u16, // basis points (0-10000)
    pub is_active: bool,
    pub reward_pool: u64,
    pub bump: u8,
}

impl Arena {
    pub const SEED: &'static [u8] = b"arena";
}
