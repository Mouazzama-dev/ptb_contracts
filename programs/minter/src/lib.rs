use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

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
        msg!("New emissions after decay: {}", emissions_account.current_emissions);

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

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.burn_pool_account.to_account_info(),
            authority: ctx.accounts.burn_pool_authority.to_account_info(), // Use the correct authority
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        // Update total burned in the burn account
        let burn_account = &mut ctx.accounts.burn_account;
        burn_account.total_burned += amount;

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
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub burn_pool_account: Account<'info, TokenAccount>, // The specific token account to burn from
    #[account(signer)]
    /// CHECK: We are doing read or write from this account
    pub burn_pool_authority: AccountInfo<'info>, // Authority for the source token account
    #[account(mut)]
    pub burn_account: Account<'info, BurnAccount>,
    pub token_program: Program<'info, Token>,
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
    pub total_burned: u64,
}
