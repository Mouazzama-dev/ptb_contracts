use anchor_lang::prelude::*;

declare_id!("7vqm6TUqywzR7SExTk7rDED1XPeb71k4gG7HeUixUvJK");

#[program]
pub mod merkle_proof {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
