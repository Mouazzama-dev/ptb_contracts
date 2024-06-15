# Minter Program

## Introduction

This Solana program, written in Rust using the Anchor framework, handles the minting and distribution of tokens with a decay factor applied to emissions over time. The program includes the functionality to initialize the emissions account, calculate and mint tokens each month, and allow users to claim rewards from different pools.

## Program Flow

1. **Initialize**:
   - Creates and initializes the emissions account and two pools: loot raffle and global tapping.
   - Sets the initial emissions, decay factor, and monthly emission amounts.

2. **Calculate and Mint**:
   - Calculates the new emissions amount for the month based on the decay factor.
   - Mints the new emissions tokens and updates the global tapping pool and loot raffle pool amounts.

3. **Claim Rewards**:
   - Allows users to claim tokens from either the loot raffle pool or the global tapping pool.
   - Ensures the claimed amount is valid and updates the respective pool amounts.

## Accounts

- **EmissionsAccount**: Stores all the data related to emissions, including current and initial emissions, decay factor, and pool details.
- **LootRafflePool**: Represents the loot raffle pool with a unique identifier and the amount of tokens.
- **GlobalTappingPool**: Represents the global tapping pool with a unique identifier and the amount of tokens.
- **Mint**: The token mint account used for creating new tokens.
- **TokenAccount**: The token account where minted tokens are stored.
- **Signer**: The authority account for performing actions like minting.

## PDA (Program Derived Addresses)

PDAs are used for creating accounts with predictable addresses that are unique to the program. This ensures security and avoids collisions with other accounts. PDAs are used for the emissions account, loot raffle pool, and global tapping pool in this program.

## Instructions

### 1. Initialize

The `initialize` function sets up the emissions account and two pools with initial values.

- **Initial Emissions**: Start with 3 billion tokens.
- **Decay Factor**: Set to 0.8705505633.
- **Loot Raffle Pool**: Start with 50 million tokens each month.
- **Global Tapping Pool**: Start with 1 billion tokens each month.

### 2. Calculate and Mint

The `calculate_and_mint` function calculates the new emissions for the month based on the decay factor and mints the tokens.

- **Emissions Calculation**: 
  - The initial emissions are set to 3 billion tokens.
  - Each month, emissions reduce by the decay factor (approximately 13%).
  - Example: 
    - Month 1: 3,000,000,000 tokens
    - Month 2: 3,000,000,000 * 0.8705505633 ≈ 2,611,651,690 tokens
    - This continues each month, reducing by the decay factor.

- **Minting Tokens**: 
  - The calculated emissions for the month are minted.
  - The global tapping pool is reset to 1 billion tokens each month.
  - The loot raffle pool amount is recalculated based on the decay factor.

### 3. Claim Rewards

The `claim_rewards` function allows users to claim tokens from either the loot raffle pool or the global tapping pool.

- **Claiming Process**:
  - Ensure the claimed amount is valid and within the pool limits.
  - Update the respective pool amounts after the claim.
  - Transfer the claimed tokens to the user's account.

## Error Codes

- **Invalid Amount**: When an invalid amount is specified for claiming rewards.
- **Overflow**: When arithmetic operations result in overflow.
- **Insufficient Funds**: When there are not enough tokens in the pool for the claim.
