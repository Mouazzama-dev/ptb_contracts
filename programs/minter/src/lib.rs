use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, TokenAccount};

declare_id!("6cu3q3HcEYc4ZhQe2hQw3rsRZXkebEyw4ZebzNHYzQWG");

#[program]
pub mod minter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let emissions_account = &mut ctx.accounts.emissions_account;
        emissions_account.initial_emissions = 3_000_000_000; // Start with 3 billion tokens
        emissions_account.decay_factor = 0.8705505633;
        emissions_account.current_month = 0;
        emissions_account.current_emissions = 3_000_000_000; // Start with 3 billion tokens for the first month
        Ok(())
    }

    pub fn calculate_and_mint(ctx: Context<CalculateAndMint>) -> Result<()> {
        let emissions_account = &mut ctx.accounts.emissions_account;

        // Calculate monthly emissions based on decay, starting from the second month
        if emissions_account.current_month > 0 {
            emissions_account.current_emissions = (emissions_account.current_emissions as f64
                * emissions_account.decay_factor)
                as u64;
        }

        // Minting tokens, adjusted for decimals
        let mint_amount = emissions_account.current_emissions * 1_000_00; // Adjust for decimals
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_context, mint_amount)?;

        // Increment month after minting
        emissions_account.current_month += 1;

        Ok(())
    }

    pub fn burn_tokens(ctx: Context<BurnToken>, amount: u64) -> Result<()> {
        let burn_account = &mut ctx.accounts.burn_account;

        // Ensure there are enough tokens to burn
        require!(
            burn_account.tokens_to_burn >= amount,
            ErrorCode::InsufficientTokens
        );

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                from: ctx.accounts.burn_pool.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::burn(cpi_context, amount)?;

        // Update the burn account's state
        burn_account.tokens_to_burn -= amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 32 + 32 + 32 + 32 + 8)]
    pub emissions_account: Account<'info, EmissionsAccount>,
    #[account(init, payer = user, space = 8 + 8)]
    pub burn_account: Account<'info, BurnAccount>,
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
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct BurnToken<'info> {
    #[account(mut)]
    pub burn_pool: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    #[account(mut)]
    pub burn_account: Account<'info, BurnAccount>,
    pub user: Signer<'info>,
}

#[account]
pub struct EmissionsAccount {
    pub initial_emissions: u64,
    pub decay_factor: f64,
    pub current_month: u64,
    pub current_emissions: u64,
}

#[account]
pub struct BurnAccount {
    pub tokens_to_burn: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient tokens to burn.")]
    InsufficientTokens,
}
