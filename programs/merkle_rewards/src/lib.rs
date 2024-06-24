use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

declare_id!("ExUtjdNkv4YzPibQBVU8JDCipXxvwxRcGrkQZQfvuVaM");

#[program]
pub mod merkle_rewards {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, merkle_root: [u8; 32]) -> Result<()> {
        let merkle_tree = &mut ctx.accounts.merkle_tree;
        merkle_tree.merkle_root = merkle_root;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>, user_address: Pubkey, amount: u64, proof: Vec<[u8; 32]>) -> Result<()> {
        let merkle_tree = &ctx.accounts.merkle_tree;

        // Verify the proof
        let mut hash = hash_leaf(user_address.as_ref(), amount);
        msg!("Initial hash from user address and amount: {:?}", hash);

        for (index, p) in proof.iter().enumerate() {
            msg!("Proof[{}]: {:?}", index, p);
            if index % 2 == 0 {
                hash = hash_nodes(hash, *p);
            } else {
                hash = hash_nodes(*p, hash);
            }
            msg!("Updated hash after hashing with Proof[{}]: {:?}", index, hash);
        }
        
        msg!("Final computed hash: {:?}", hash);
        msg!("Stored merkle root in contract: {:?}", merkle_tree.merkle_root);

        require!(hash == merkle_tree.merkle_root, ErrorCode::InvalidProof);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 32 + 32, seeds = [b"merkle_tree"], bump)]
    pub merkle_tree: Account<'info, MerkleTree>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub merkle_tree: Account<'info, MerkleTree>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
pub struct MerkleTree {
    pub merkle_root: [u8; 32],
}

fn hash_leaf(address: &[u8], amount: u64) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(address);
    hasher.update(&amount.to_le_bytes());
    hasher.finalize().into()
}

fn hash_nodes(left: [u8; 32], right: [u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(&left);
    hasher.update(&right);
    hasher.finalize().into()
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Merkle proof")]
    InvalidProof,
}