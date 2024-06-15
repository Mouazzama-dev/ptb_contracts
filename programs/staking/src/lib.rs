use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use std::str::FromStr;

declare_id!("ADrM2jnS2kFVfQYqjGmnXU9bZom89eKZKpJBf4FjDg45");

const ADMIN_WALLET: &str = "AofwKSrDSzPULMWZy9CoJYWDPABLR6nHuqwxhqJ55FM3";
const ADMIN_TOKEN_ACCOUNT: &str = "3X2MKFhhHkcRE1FT9fUHvutMTfPRLkh5BgUcm2jb8AWa";

#[program]
mod staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let staking_account = &mut ctx.accounts.staking_account;
        staking_account.total_staked = 0;
        staking_account.total_staking_score = 0;
        Ok(())
    }

    pub fn stake_tokens(ctx: Context<StakeTokens>, amount: u64, lock_period: u64) -> Result<()> {
        ctx.accounts.validate()?;

        let time_multiplier = match lock_period {
            1 => 1.0,
            3 => 1.4,
            6 => 2.0,
            _ => return Err(ErrorCode::InvalidLockPeriod.into()),
        };

        let staking_score = (amount as f64 * time_multiplier) as u64;

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info().clone(),
            to: ctx.accounts.admin_token_account.to_account_info().clone(),
            authority: ctx.accounts.user.to_account_info().clone(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info().clone();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, amount)?;

        let staking_account = &mut ctx.accounts.staking_account;
        staking_account.total_staked += amount;
        staking_account.total_staking_score += staking_score;

        let user_stake_info = &mut ctx.accounts.user_stake_info;
        user_stake_info.amount_staked += amount;
        user_stake_info.staking_score += staking_score;

        Ok(())
    }

    pub fn create_pools(ctx: Context<CreatePools>, total_amount: u64) -> Result<()> {
        let staking_account = &mut ctx.accounts.staking_account;
        
        // Calculate pool allocations
        let burn_pool_amount = (total_amount as f64 * 0.30) as u64;
        let team_pool_amount = (total_amount as f64 * 0.30) as u64;
        let game_dst_pool_amount = (total_amount as f64 * 0.40) as u64;

        // Calculate sub-pool allocations from the Game Distribution Pool
        let staking_pool_amount = (game_dst_pool_amount as f64 * 0.25) as u64; // 10% of total_amount
        let last_push_pool_amount = (game_dst_pool_amount as f64 * 0.25) as u64; // 10% of total_amount
        let premium_packs_amount = (game_dst_pool_amount as f64 * 0.50) as u64; // 20% of total_amount

        // Initialize the pool accounts with the allocated amounts
        let burn_pool = &mut ctx.accounts.burn_pool;
        burn_pool.amount = burn_pool_amount;

        let team_pool = &mut ctx.accounts.team_pool;
        team_pool.amount = team_pool_amount;

        let game_dst_pool = &mut ctx.accounts.game_dst_pool;
        game_dst_pool.amount = game_dst_pool_amount;

        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.amount = staking_pool_amount;

        let last_push_pool = &mut ctx.accounts.last_push_pool;
        last_push_pool.amount = last_push_pool_amount;

        let premium_packs_pool = &mut ctx.accounts.premium_packs_pool;
        premium_packs_pool.amount = premium_packs_amount;

        // Store pool public keys in the staking account
        staking_account.burn_pool = ctx.accounts.burn_pool.key();
        staking_account.team_pool = ctx.accounts.team_pool.key();
        staking_account.game_dst_pool = ctx.accounts.game_dst_pool.key();
        staking_account.staking_pool = ctx.accounts.staking_pool.key();
        staking_account.last_push_pool = ctx.accounts.last_push_pool.key();
        staking_account.premium_packs_pool = ctx.accounts.premium_packs_pool.key();

        Ok(())
    }

    pub fn calculate_rewards(ctx: Context<CalculateRewards>) -> Result<()> {
        let staking_account = &ctx.accounts.staking_account;
        let user_stake_info = &ctx.accounts.user_stake_info;

        require!(staking_account.total_staking_score > 0, ErrorCode::NoStakingScore);

        let user_rewards = (user_stake_info.staking_score as f64 / staking_account.total_staking_score as f64) * staking_account.staking_pool_amount as f64;
        
        let user_rewards_amount = user_rewards as u64;

        // Transfer tokens from the admin token account to the user's token account
        let cpi_accounts = Transfer {
            from: ctx.accounts.admin_token_account.to_account_info().clone(),
            to: ctx.accounts.user_token_account.to_account_info().clone(),
            authority: ctx.accounts.admin.to_account_info().clone(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info().clone();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::transfer(cpi_ctx, user_rewards_amount)?;

        Ok(())
    }
}

#[account]
pub struct StakingAccount {
    pub total_staked: u64,
    pub total_staking_score: u64,
    pub burn_pool_amount: u64,
    pub team_pool_amount: u64,
    pub game_dst_pool_amount: u64,
    pub staking_pool_amount: u64,
    pub last_push_pool_amount: u64,
    pub premium_packs_amount: u64,
    pub burn_pool: Pubkey,
    pub team_pool: Pubkey,
    pub game_dst_pool: Pubkey,
    pub staking_pool: Pubkey,
    pub last_push_pool: Pubkey,
    pub premium_packs_pool: Pubkey,
}

#[account]
pub struct UserStakeInfo {
    pub amount_staked: u64,
    pub staking_score: u64,
}

#[account]
pub struct Pool {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 6 * 8 + 8 + 6 * 32)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(mut)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(init, payer = user, space = 8 + 8 + 8, seeds = [user.key().as_ref()], bump)]
    pub user_stake_info: Account<'info, UserStakeInfo>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePools<'info> {
    #[account(mut)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(init, seeds = [b"burn_pool"], bump, payer = user, space = 8 + 8)]
    pub burn_pool: Account<'info, Pool>,
    #[account(init, seeds = [b"team_pool"], bump, payer = user, space = 8 + 8)]
    pub team_pool: Account<'info, Pool>,
    #[account(init, seeds = [b"game_dst_pool"], bump, payer = user, space = 8 + 8)]
    pub game_dst_pool: Account<'info, Pool>,
    #[account(init, seeds = [b"staking_pool"], bump, payer = user, space = 8 + 8)]
    pub staking_pool: Account<'info, Pool>,
    #[account(init, seeds = [b"last_push_pool"], bump, payer = user, space = 8 + 8)]
    pub last_push_pool: Account<'info, Pool>,
    #[account(init, seeds = [b"premium_packs_pool"], bump, payer = user, space = 8 + 8)]
    pub premium_packs_pool: Account<'info, Pool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CalculateRewards<'info> {
    #[account(mut)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut, seeds = [user.key().as_ref()], bump)]
    pub user_stake_info: Account<'info, UserStakeInfo>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl<'info> StakeTokens<'info> {
    fn validate(&self) -> Result<()> {
        let admin_pubkey =
            Pubkey::from_str(ADMIN_WALLET).map_err(|_| ErrorCode::InvalidAdminWallet)?;
        let admin_token_pubkey = Pubkey::from_str(ADMIN_TOKEN_ACCOUNT)
            .map_err(|_| ErrorCode::InvalidAdminTokenAccount)?;

        if self.admin_token_account.owner != admin_pubkey {
            return Err(ErrorCode::InvalidAdminWallet.into());
        }

        if self.admin_token_account.to_account_info().key != &admin_token_pubkey {
            return Err(ErrorCode::InvalidAdminTokenAccount.into());
        }

        Ok(())
    }
}

impl<'info> CreatePools<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("The provided admin wallet is invalid.")]
    InvalidAdminWallet,
    #[msg("The provided admin token account is invalid.")]
    InvalidAdminTokenAccount,
    #[msg("Invalid lock period.")]
    InvalidLockPeriod,
    #[msg("No staking score available.")]
    NoStakingScore,
}
