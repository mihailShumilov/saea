use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub arena: Pubkey,
    pub round_number: u64,
    pub generation: u64,
    pub participants: u64,
    pub best_fitness: u64,
    pub worst_fitness: u64,
    pub average_fitness: u64,
    pub total_fitness: u64,
    pub seed: [u8; 32], // deterministic seed for this round
    pub started_at: i64,
    pub completed_at: i64,
    pub is_complete: bool,
    pub bump: u8,
}

impl Round {
    pub const SEED: &'static [u8] = b"round";
}
