import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount } from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { Staking } from "../target/types/staking";

describe("staking", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Staking as Program<Staking>;
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet;

  let stakingAccount: Keypair;
  let userTokenAccount: PublicKey;
  let adminTokenAccount: PublicKey;
  let mint: PublicKey;
  let user: Keypair;
  const admin = new PublicKey("AofwKSrDSzPULMWZy9CoJYWDPABLR6nHuqwxhqJ55FM3");
  const adminTokenAcc = new PublicKey("3X2MKFhhHkcRE1FT9fUHvutMTfPRLkh5BgUcm2jb8AWa");

  before(async () => {
    // Airdrop SOL to the provider wallet
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(provider.wallet.publicKey, 2 * LAMPORTS_PER_SOL),
      "confirmed"
    );

    // Create Mint and Token Accounts
    mint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      9
    );

    user = Keypair.generate();

    userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint,
      user.publicKey
    );

    // Check if the admin token account is already initialized
    try {
      const adminTokenAccountInfo = await getAccount(
        provider.connection,
        adminTokenAcc
      );
      adminTokenAccount = adminTokenAcc;
      console.log("Admin Token Account already initialized:", adminTokenAccount.toBase58());
      console.log("Admin Token Account Info:", adminTokenAccountInfo);
    } catch (error) {
      console.error("Admin Token Account is not initialized and it must be pre-initialized.");
      throw new Error("Admin Token Account is not initialized.");
    }

    // Mint tokens to user
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint,
      userTokenAccount.address,
      provider.wallet.publicKey,
      1000 * LAMPORTS_PER_SOL
    );

    // Initialize Staking Account
    stakingAccount = Keypair.generate();
    await program.rpc.initialize({
      accounts: {
        stakingAccount: stakingAccount.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [stakingAccount]
    });
  });

  it("stakes tokens", async () => {
    // Stake tokens
    const amount = new anchor.BN(100 * LAMPORTS_PER_SOL);

    await program.rpc.stakeTokens(amount, {
      accounts: {
        stakingAccount: stakingAccount.publicKey,
        user: user.publicKey,
        userTokenAccount: userTokenAccount.address,
        adminTokenAccount: adminTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [user],
    });

    // Fetch the staking account
    const account = await program.account.stakingAccount.fetch(stakingAccount.publicKey);

    assert.ok(account.totalStaked.eq(amount));
  });

});
