use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use std::str::FromStr;

declare_id!("13butYyAmNAzDdigb7KfMRJLT3u3YQ1D6yqkNC6288do");

const ADMIN_WALLET: &str = "AofwKSrDSzPULMWZy9CoJYWDPABLR6nHuqwxhqJ55FM3";
const ADMIN_TOKEN_ACCOUNT: &str = "3X2MKFhhHkcRE1FT9fUHvutMTfPRLkh5BgUcm2jb8AWa";

#[program]
mod staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let staking_account = &mut ctx.accounts.staking_account;
        staking_account.total_staked = 0;
        Ok(())
    }

    pub fn stake_tokens(ctx: Context<StakeTokens>, amount: u64) -> Result<()> {
        ctx.accounts.validate()?;

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

        Ok(())
    }
}
aa
#[account]
pub struct StakingAccount {
    pub total_staked: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(mut)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,
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

#[error_code]
pub enum ErrorCode {
    #[msg("The provided admin wallet is invalid.")]
    InvalidAdminWallet,
    #[msg("The provided admin token account is invalid.")]
    InvalidAdminTokenAccount,
}
