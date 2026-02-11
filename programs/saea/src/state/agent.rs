use anchor_lang::prelude::*;

/// Maximum genome length: 32 parameters encoded as u8 values.
/// Each parameter represents a strategy weight in range [0, 255].
pub const MAX_GENOME_LEN: usize = 32;

#[account]
#[derive(InitSpace)]
pub struct AgentAccount {
    pub owner: Pubkey,
    #[max_len(32)]
    pub genome: Vec<u8>,
    pub fitness: u64,
    pub generation: u64,
    pub parent: Pubkey,               // Pubkey::default() if genesis
    pub parent_genome_hash: [u8; 32], // SHA256 of parent genome for lineage
    pub mutation_count: u64,
    pub rounds_participated: u64,
    pub total_fitness: u64, // cumulative fitness across rounds
    pub is_active: bool,
    pub registered_at: i64,
    pub last_round: u64,
    pub bump: u8,
}

impl AgentAccount {
    pub const SEED: &'static [u8] = b"agent";

    pub fn average_fitness(&self) -> u64 {
        if self.rounds_participated == 0 {
            return 0;
        }
        self.total_fitness / self.rounds_participated
    }
}
