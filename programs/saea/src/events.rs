use anchor_lang::prelude::*;

#[event]
pub struct ArenaInitialized {
    pub authority: Pubkey,
    pub max_agents: u64,
    pub mutation_rate_bps: u16,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub genome_hash: [u8; 32],
    pub generation: u64,
}

#[event]
pub struct GenomeSubmitted {
    pub agent: Pubkey,
    pub genome_hash: [u8; 32],
    pub generation: u64,
    pub mutation_count: u64,
    pub parent: Pubkey,
}

#[event]
pub struct RoundCompleted {
    pub round_number: u64,
    pub generation: u64,
    pub participants: u64,
    pub best_fitness: u64,
    pub average_fitness: u64,
}

#[event]
pub struct AgentScored {
    pub agent: Pubkey,
    pub round_number: u64,
    pub fitness: u64,
    pub genome_hash: [u8; 32],
}

#[event]
pub struct AgentPruned {
    pub agent: Pubkey,
    pub fitness: u64,
    pub generation: u64,
}

#[event]
pub struct GenerationAdvanced {
    pub old_generation: u64,
    pub new_generation: u64,
    pub active_agents: u64,
}
