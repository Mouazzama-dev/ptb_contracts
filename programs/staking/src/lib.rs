use anchor_lang::prelude::*;

declare_id!("ADrM2jnS2kFVfQYqjGmnXU9bZom89eKZKpJBf4FjDg45");

#[program]
pub mod staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
