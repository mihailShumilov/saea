# Security Review

## Account Validation Checks

### Arena Account
- Initialized via `init` constraint — cannot be re-initialized
- Protected by PDA seeds `["arena"]` — deterministic address
- Authority field is set once during initialization
- All state-modifying instructions check `arena.is_active`

### Agent Account
- Initialized via `init` constraint with PDA seeds `["agent", arena, owner, index]`
- Owner field is set during registration and verified on genome submission
- `is_active` flag is checked before scoring and mutation
- Genome length is validated (1-32 bytes)

### Round Account
- Initialized via `init` constraint with PDA seeds `["round", arena, round_number]`
- `is_complete` flag prevents double-completion
- Participants are tracked to prevent double-scoring

## Reinitialization Protection

- **Arena**: Uses Anchor's `init` constraint which fails if the account already exists. The `init` constraint checks the account discriminator.
- **Agent**: PDA includes the arena key, owner, and index — each combination can only be initialized once.
- **Round**: PDA includes the arena key and round number — each round number can only be initialized once.

There is no `close` instruction, so accounts cannot be closed and re-initialized.

## PDA Collision Considerations

- **Arena PDA**: `["arena"]` — single global arena per program deployment. No collision possible.
- **Agent PDA**: `["agent", arena_key, owner_key, index_bytes]` — the index is derived from `arena.total_agents` which monotonically increases. Collision requires identical arena + owner + index, which cannot occur.
- **Round PDA**: `["round", arena_key, round_bytes]` — round number monotonically increases. Collision impossible.

## Privilege Escalation Review

### Authority Checks
The following instructions require the arena authority:
- `run_round` — only authority can start rounds
- `score_agent` — only authority can trigger scoring
- `complete_round` — only authority can finalize rounds
- `prune_agent` — only authority can prune agents
- `advance_generation` — only authority can advance generations

### Owner Checks
- `submit_genome` — requires the agent's owner to sign

### No Privilege Escalation Paths
- Authority is set during arena initialization and never modified
- Agent owner is set during registration and never modified
- No instruction allows transferring authority or ownership

## Replay Attack Analysis

### Transaction Replay
Solana's built-in transaction replay protection (blockhash expiry) prevents replaying signed transactions.

### Round Replay
- Each round has a unique PDA derived from its round number
- The `arena.current_round` is incremented atomically during `run_round`
- A round cannot be created with a past or future number

### Scoring Replay
- `agent.last_round` is checked against `round.round_number`
- An agent cannot be scored twice in the same round
- `round.is_complete` prevents scoring after round completion

## Mutation Manipulation Risk

### Genome Submission
- Only the agent's owner can submit a new genome
- The program does not validate genome content (any byte pattern is valid)
- This is by design: the fitness function determines which genomes are "good"

### Fitness Manipulation
- Fitness is computed entirely onchain by the `compute_fitness` function
- The round seed is deterministic: `hash(arena_key + round_number + generation + timestamp)`
- No external input can influence the fitness calculation after the round seed is set
- The timestamp component adds unpredictability between rounds but is fixed once the round starts

### Potential Risk: Authority Centralization
- The authority can choose which agents to score and when to advance generations
- **Mitigation**: The scoring function is deterministic. Even if the authority selects scoring order, the fitness values cannot be manipulated.
- **Improvement**: A future version could use a permissionless round mechanism where any participant can trigger scoring.

## Trust Assumptions

1. **Authority is honest**: The authority controls round timing and agent scoring order. While scores themselves are deterministic, the authority could delay or skip scoring certain agents.

2. **Clock sysvar is accurate**: The round seed includes `clock.unix_timestamp`. Validators could theoretically manipulate this within the allowed drift window (~1-2 seconds), but this has negligible impact on the hash-based seed.

3. **Program is correctly deployed**: Users must verify the deployed program matches the source code. The program ID in `declare_id!` must match the deployed program.

4. **No economic incentives for manipulation**: In the current design, there are no token rewards. If token rewards were added, additional security measures would be needed (e.g., timelock withdrawals, multi-sig authority).

## Recommendations for Production

1. Add a timelock or multi-sig for authority operations
2. Implement permissionless round execution with automatic triggers
3. Add rate limiting for genome submissions
4. Consider adding onchain verification that genomes actually changed during mutation
5. If adding token rewards, implement withdrawal timelock and audit the reward distribution logic
