use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, TokenAccount, Transfer};
use merkle_rewards::program::MerkleRewards;
use merkle_rewards::MerkleTree;
use merkle_rewards::cpi::accounts::Claim;

declare_id!("AqpXhZpaTaWbcDawvWrTsstmi7Bf8XY3bLH97wXg6ipS");

#[program]
pub mod minter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let emissions_account = &mut ctx.accounts.emissions_account;

        // Initialize emissions account
        emissions_account.initial_emissions = 3_000_000_000; // Start with 3 billion tokens
        emissions_account.decay_factor = 0.8705505633;
        emissions_account.current_month = 0;
        emissions_account.current_emissions = 3_000_000_000; // Start with 3 billion tokens for the first month

        // Initialize the loot raffle pool PDA
        emissions_account.loot_raffle_pool = ctx.accounts.loot_raffle_pool.key();
        emissions_account.loot_raffle_amount = 50_000_000; // Start with 50 million tokens each month
        emissions_account.loot_raffle_total = 50_000_000;

        // Initialize the global tapping pool PDA
        emissions_account.global_tapping_pool = ctx.accounts.global_tapping_pool.key();
        emissions_account.global_tapping_amount = 1_000_000_000; // Start with 1 billion tokens each month
        emissions_account.global_tapping_total = 1_000_000_000;

        Ok(())
    }

    pub fn calculate_and_mint(ctx: Context<CalculateAndMint>) -> Result<()> {
        let emissions_account = &mut ctx.accounts.emissions_account;

        // Calculate monthly emissions based on decay, starting from the second month
        if emissions_account.current_month > 0 {
            emissions_account.current_emissions = (emissions_account.current_emissions as f64
                * emissions_account.decay_factor) as u64;
        }
        msg!("New emissions after decay: {}", emissions_account.current_emissions);

        // Minting tokens, adjusted for decimals
        let mint_amount = emissions_account.current_emissions * 100_000; // Adjust for decimals
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_context, mint_amount)?;

        // Reset the global tapping pool amount each month
        emissions_account.global_tapping_amount = 1_000_000_000;
        emissions_account.global_tapping_total = 1_000_000_000;

        // Calculate the new loot raffle amount based on decay factor
        if emissions_account.current_month > 0 {
            emissions_account.loot_raffle_amount = (emissions_account.loot_raffle_amount as f64
                * emissions_account.decay_factor) as u64;
        }
        emissions_account.loot_raffle_total = emissions_account.loot_raffle_amount;

        // Increment month after minting
        emissions_account.current_month += 1;

        Ok(())
    }

    pub fn claim_rewards(ctx: Context<ClaimRewards>, amount: u64, pool_type: PoolType, user_address: Pubkey, proof: Vec<[u8; 32]>) -> Result<()> {
        let emissions_account = &mut ctx.accounts.emissions_account;

        // CPI call to the Merkle Rewards program to claim the rewards
        let cpi_ctx = CpiContext::new(
            ctx.accounts.merkle_program.to_account_info(),
            Claim {
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
                user: ctx.accounts.user.to_account_info()
            }
        );
        let res = merkle_rewards::cpi::claim(cpi_ctx, user_address, amount, proof);

        // Return an error if the CPI call failed
        if res.is_ok() {
        } else {
            return err!(CustomError::CPIToMerkleFailed);
        }

        // Ensure that the amount is valid and within limits
        require!(amount > 0, CustomError::InvalidAmount);

        match pool_type {
            PoolType::LootRaffle => {
                // Ensure there are enough tokens in the loot raffle pool
                require!(amount <= emissions_account.loot_raffle_amount, CustomError::InsufficientFunds);
                // Update the loot raffle pool amount
                emissions_account.loot_raffle_amount = emissions_account
                    .loot_raffle_amount
                    .checked_sub(amount)
                    .ok_or(CustomError::Overflow)?;
            }
            PoolType::GlobalTapping => {
                // Ensure there are enough tokens in the global tapping pool
                require!(amount <= emissions_account.global_tapping_amount, CustomError::InsufficientFunds);
                // Update the global tapping pool amount
                emissions_account.global_tapping_amount = emissions_account
                    .global_tapping_amount
                    .checked_sub(amount)
                    .ok_or(CustomError::Overflow)?;
            }
        }

        // Log token account information for debugging
        msg!("Associated Token Account: {}", ctx.accounts.associated_token_account.key());
        msg!("User Token Account: {}", ctx.accounts.user_token_account.key());
        msg!("Authority: {}", ctx.accounts.authority.key());
        msg!("Token Program: {}", ctx.accounts.token_program.key());

        // Transfer tokens from the associated token account to the user's token account
        let cpi_accounts = Transfer {
            from: ctx.accounts.associated_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_context, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds = [b"emissions_account"], bump, payer = user, space = 8 + 32 + 32 + 32 + 32 + 8 + 32 + 8 + 32 + 8 + 8 + 8)]
    pub emissions_account: Account<'info, EmissionsAccount>,
    #[account(init, payer = user, space = 8 + 32 + 32, seeds = [b"loot_raffle_pool"], bump)]
    pub loot_raffle_pool: Account<'info, LootRafflePool>,
    #[account(init, payer = user, space = 8 + 32 + 32, seeds = [b"global_tapping_pool"], bump)]
    pub global_tapping_pool: Account<'info, GlobalTappingPool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CalculateAndMint<'info> {
    #[account(mut)]
    pub emissions_account: Account<'info, EmissionsAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub emissions_account: Account<'info, EmissionsAccount>,
    #[account(mut)]
    pub associated_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    pub user: Signer<'info>,
    #[account(mut)]
    pub merkle_tree: Account<'info, MerkleTree>,
    pub merkle_program: Program<'info, MerkleRewards>,
}

#[account]
pub struct EmissionsAccount {
    pub initial_emissions: u64,
    pub decay_factor: f64,
    pub current_month: u64,
    pub current_emissions: u64,
    pub loot_raffle_pool: Pubkey,
    pub loot_raffle_amount: u64,
    pub loot_raffle_total: u64,
    pub global_tapping_pool: Pubkey,
    pub global_tapping_amount: u64,
    pub global_tapping_total: u64,
}

#[account]
pub struct LootRafflePool {
    pub pool_id: Pubkey,
    pub amount: u64,
}

#[account]
pub struct GlobalTappingPool {
    pub pool_id: Pubkey,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum PoolType {
    LootRaffle,
    GlobalTapping,
}

#[error_code]
pub enum CustomError {
    #[msg("Invalid amount specified.")]
    InvalidAmount,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Insufficient funds in the pool.")]
    InsufficientFunds,
    #[msg("CPI to Merkle Rewards failed.")]
    CPIToMerkleFailed,
}
