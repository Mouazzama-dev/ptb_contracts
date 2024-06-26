use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("BFwmbEmjJfeomE29k5dj2BXeXEGo168fVKEFR3MtwPoB");

#[program]
mod staking {
    use super::*;

    // Initializing staking program with trading fee pool and admin wallet
    pub fn initialize(ctx: Context<Initialize>, trading_fee_pool: Pubkey, admin: Pubkey) -> Result<()> {
        let staking_account = &mut ctx.accounts.staking_account;
        staking_account.trading_fee_pool = trading_fee_pool;
        staking_account.admin = admin;
        staking_account.total_staked = 0;

        // Initialize the pool accounts with zero amounts and names
        let burn_pool = &mut ctx.accounts.burn_pool;
        burn_pool.amount = 0;
        burn_pool.name = "burn_pool".to_string();

        let team_pool = &mut ctx.accounts.team_pool;
        team_pool.amount = 0;
        team_pool.name = "team_pool".to_string();

        let staking_rewards_pool = &mut ctx.accounts.staking_rewards_pool;
        staking_rewards_pool.amount = 0;
        staking_rewards_pool.name = "staking_rewards_pool".to_string();

        let last_push_pool = &mut ctx.accounts.last_push_pool;
        last_push_pool.amount = 0;
        last_push_pool.name = "last_push_pool".to_string();

        let premium_pack_pool = &mut ctx.accounts.premium_pack_pool;
        premium_pack_pool.amount = 0;
        premium_pack_pool.name = "premium_pack_pool".to_string();

        Ok(())
    }

    // Staking tokens and calculating staking score
    pub fn stake(ctx: Context<Stake>, amount: u64, lock_period: u8) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let staking_account = &mut ctx.accounts.staking_account;

        // Calculate staking score based on lock period
        let time_multiplier = match lock_period {
            1 => 1.0,
            3 => 1.4,
            6 => 2.0,
            _ => return Err(ProgramError::InvalidArgument.into()),
        };

        user_account.staking_score = (amount as f64 * time_multiplier) as u64;
        user_account.amount_staked = amount;
        user_account.lock_period = lock_period;

        // Update total staked
        staking_account.total_staked += amount;

        // Transfer tokens from the associated token account to the user's token account
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.admin_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_context, amount)?;

        Ok(())
    }

    // Allocate trading fee pool tokens to various sub-pools
    pub fn allocate_pools(ctx: Context<AllocatePools>, amount: u64) -> Result<()> {
        // Burn pool: 30%
        let burn_amount = (amount * 30) / 100;
        let burn_pool = &mut ctx.accounts.burn_pool;
        burn_pool.amount += burn_amount;
        
        // Team pool: 30%
        let team_amount = (amount * 30) / 100;
        let team_pool = &mut ctx.accounts.team_pool;
        team_pool.amount += team_amount;

        // Staking rewards pool: 10%
        let staking_rewards_amount = (amount * 10) / 100;
        let staking_rewards_pool = &mut ctx.accounts.staking_rewards_pool;
        staking_rewards_pool.amount += staking_rewards_amount;

        // Last push pool: 10%
        let last_push_amount = (amount * 10) / 100;
        let last_push_pool = &mut ctx.accounts.last_push_pool;
        last_push_pool.amount += last_push_amount;

        // Premium pack pool: 20%
        let premium_pack_amount = (amount * 20) / 100;
        let premium_pack_pool = &mut ctx.accounts.premium_pack_pool;
        premium_pack_pool.amount += premium_pack_amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 32,
        seeds = [b"staking_account_1", user.key().as_ref()],
        bump
    )]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(init, payer = user, space = 8 + 8 + 32, seeds = [b"burn_pool"], bump)]
    pub burn_pool: Account<'info, Pool>,
    #[account(init, payer = user, space = 8 + 8 + 32, seeds = [b"team_pool"], bump)]
    pub team_pool: Account<'info, Pool>,
    #[account(init, payer = user, space = 8 + 8 + 32, seeds = [b"staking_rewards_pool"], bump)]
    pub staking_rewards_pool: Account<'info, Pool>,
    #[account(init, payer = user, space = 8 + 8 + 32, seeds = [b"last_push_pool"], bump)]
    pub last_push_pool: Account<'info, Pool>,
    #[account(init, payer = user, space = 8 + 8 + 32, seeds = [b"premium_pack_pool"], bump)]
    pub premium_pack_pool: Account<'info, Pool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        mut,
        seeds = [b"staking_account_1", user.key().as_ref()],
        bump
    )]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 1, // space for user account data
        seeds = [b"user_account", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AllocatePools<'info> {
    #[account(mut)]
    pub burn_pool: Account<'info, Pool>,
    #[account(mut)]
    pub team_pool: Account<'info, Pool>,
    #[account(mut)]
    pub staking_rewards_pool: Account<'info, Pool>,
    #[account(mut)]
    pub last_push_pool: Account<'info, Pool>,
    #[account(mut)]
    pub premium_pack_pool: Account<'info, Pool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct StakingAccount {
    pub trading_fee_pool: Pubkey,
    pub admin: Pubkey,
    pub total_staked: u64,
}

#[account]
pub struct UserAccount {
    pub amount_staked: u64,
    pub lock_period: u8,
    pub staking_score: u64,
}

#[account]
pub struct Pool {
    pub amount: u64,
    pub name: String,
}
