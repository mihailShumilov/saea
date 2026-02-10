use anchor_lang::prelude::*;

#[error_code]
pub enum SaeaError {
    #[msg("Arena is not active")]
    ArenaNotActive,
    #[msg("Arena is already initialized")]
    ArenaAlreadyInitialized,
    #[msg("Maximum number of agents reached")]
    MaxAgentsReached,
    #[msg("Agent is not active")]
    AgentNotActive,
    #[msg("Agent is already active")]
    AgentAlreadyActive,
    #[msg("Invalid genome length (must be 1-32 bytes)")]
    InvalidGenomeLength,
    #[msg("Round is already complete")]
    RoundAlreadyComplete,
    #[msg("Round is not complete")]
    RoundNotComplete,
    #[msg("Agent already participated in this round")]
    AlreadyParticipated,
    #[msg("Unauthorized: caller is not the owner")]
    Unauthorized,
    #[msg("Mutation rate must be between 0 and 10000 basis points")]
    InvalidMutationRate,
    #[msg("Fitness threshold must be positive")]
    InvalidFitnessThreshold,
    #[msg("Max agents must be at least 2")]
    InvalidMaxAgents,
    #[msg("No agents to prune")]
    NoAgentsToPrune,
    #[msg("Agent fitness is above pruning threshold")]
    AgentAboveThreshold,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
