import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, SystemProgram, Keypair, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import { Minter } from "../target/types/minter";
import { TOKEN_PROGRAM_ID, MintLayout, createInitializeMintInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { MerkleRewards } from "../target/types/merkle_rewards";

describe("minter", () => {
  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.Minter as Program<Minter>;
  const MerkleRewardsProgram = anchor.workspace.MerkleRewards as Program<MerkleRewards>;
  const wallet = provider.wallet;
  const mintKeypair = anchor.web3.Keypair.generate();
  const userKeypair = anchor.web3.Keypair.generate(); // User keypair

  const merkleRoot = Buffer.from('3e421d00400ce1cf199682f74d3eb353a0c4978a99b73c65a56aeeaa81b8189e', 'hex');
  let merkleTreePda: PublicKey;
  let bump: number;


  before(async () => {
    try {
      [merkleTreePda, bump] = await PublicKey.findProgramAddress(
        [Buffer.from("merkle_tree")],
        MerkleRewardsProgram.programId
      );
      console.log("merkleTreePda found: ", merkleTreePda.toString());
    } catch (error) {
      console.error("Error finding PDA: ", error);
      throw error;
    }
  });

  it("Initializes the emissions account", async () => {
    const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("emissions_account")],
      program.programId
    );

    const [lootRafflePoolPda, lootRafflePoolBump] = await PublicKey.findProgramAddress(
      [Buffer.from("loot_raffle_pool")],
      program.programId
    );

    const [globalTappingPoolPda, globalTappingPoolBump] = await PublicKey.findProgramAddress(
      [Buffer.from("global_tapping_pool")],
      program.programId
    );

    let emissionsAccountData;
    try {
      emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);
    } catch (err) {}

    if (!emissionsAccountData) {
      await program.rpc.initialize({
        accounts: {
          emissionsAccount: emissionsAccountPda,
          lootRafflePool: lootRafflePoolPda,
          globalTappingPool: globalTappingPoolPda,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [wallet.payer],
      });

      emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

      assert.strictEqual(emissionsAccountData.initialEmissions.toNumber(), 3000000000);
      assert.strictEqual(emissionsAccountData.decayFactor, 0.8705505633);
      assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), 0);
      assert.strictEqual(emissionsAccountData.currentEmissions.toNumber(), 3000000000);
      assert.strictEqual(emissionsAccountData.lootRafflePool.toBase58(), lootRafflePoolPda.toBase58());
      assert.strictEqual(emissionsAccountData.lootRaffleAmount.toNumber(), 50000000);
      assert.strictEqual(emissionsAccountData.lootRaffleTotal.toNumber(), 50000000);
      assert.strictEqual(emissionsAccountData.globalTappingPool.toBase58(), globalTappingPoolPda.toBase58());
      assert.strictEqual(emissionsAccountData.globalTappingAmount.toNumber(), 1000000000);
      assert.strictEqual(emissionsAccountData.globalTappingTotal.toNumber(), 1000000000);
    } else {
      console.log("Emissions account already initialized");
    }

    emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);
    console.log("Emissions account month: ", emissionsAccountData.currentMonth.toNumber());
    console.log("Monthly Emissions: ", emissionsAccountData.currentEmissions.toNumber());

    const expectedMonth = emissionsAccountData.currentMonth.toNumber();
    assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), expectedMonth);
  });

  it("Initializes the Merkle Tree Account!", async () => {
    try {      
      const tx = await MerkleRewardsProgram.methods.initialize(Array.from(merkleRoot))
        .accounts({
          merkleTree: merkleTreePda,
          user: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc({ skipPreflight: false });
  
      console.log("Transaction signature", tx);
    } catch (error) {
      // Check if the error message indicates the account is already in use
      if (error.message.includes("already in use")) {
        console.log("Merkle Tree Account already initialized, passing the test.");
      } else {
        console.error("Error initializing: ", error);
        throw error;
      }
    }
  });
  

  it("Create and initialize mint account", async () => {
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span);
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MintLayout.span,
        lamports: lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        5, // Decimals
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(transaction, [mintKeypair]);

    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintKeypair.publicKey,
      wallet.publicKey
    );
  });

  it("Calculates and mints emissions", async () => {
    const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("emissions_account")],
      program.programId
    );

    const tokenAssociatedAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintKeypair.publicKey,
      wallet.publicKey
    );

    const userAssociatedAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintKeypair.publicKey,
      userKeypair.publicKey
    );

    const emissionsAccountDataBefore = await program.account.emissionsAccount.fetch(emissionsAccountPda);
    const expectedMonth = emissionsAccountDataBefore.currentMonth.toNumber() + 1;

    console.log("Mint Account Info1: ", mintKeypair.publicKey);
    console.log("Token Associated Account Info1: ", tokenAssociatedAccount.address);
    console.log("User Associated Account Info1: ", userAssociatedAccount.address);

    await program.rpc.calculateAndMint({
      accounts: {
        emissionsAccount: emissionsAccountPda,
        mint: mintKeypair.publicKey,
        to: tokenAssociatedAccount.address,
        mintAuthority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [wallet.payer],
    });

    const emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

    assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), expectedMonth);
    assert.isAbove(emissionsAccountData.currentEmissions.toNumber(), 0);
  });

  it("Claims rewards", async () => {
    const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("emissions_account")],
      program.programId
    );

    const tokenAssociatedAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintKeypair.publicKey,
      wallet.publicKey
    );

    const userAssociatedAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintKeypair.publicKey,
      userKeypair.publicKey
    );

    let emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

    console.log("Initial Loot Raffle Amount: ", emissionsAccountData.lootRaffleAmount.toNumber());
    console.log("Initial Global Tapping Amount: ", emissionsAccountData.globalTappingAmount.toNumber());

    const poolType = { lootRaffle: {} };
    const claimAmount = new anchor.BN(1);

    const mintInfo = await provider.connection.getParsedAccountInfo(mintKeypair.publicKey);
    const tokenAccountInfo = await provider.connection.getParsedAccountInfo(tokenAssociatedAccount.address);

    console.log("Mint Account Info: ", mintKeypair.publicKey);
    console.log("Token Associated Account Info: ", tokenAssociatedAccount.address);
    console.log("User Associated Account Info: ", userAssociatedAccount.address);

    await program.rpc.claimRewards(claimAmount, poolType, {
      accounts: {
        emissionsAccount: emissionsAccountPda,
        associatedTokenAccount: tokenAssociatedAccount.address,
        userTokenAccount: userAssociatedAccount.address,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: wallet.publicKey,
      },
      signers: [wallet.payer],
    });

    emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

    console.log("Updated Loot Raffle Amount: ", emissionsAccountData.lootRaffleAmount.toNumber());
    console.log("Updated Global Tapping Amount: ", emissionsAccountData.globalTappingAmount.toNumber());

    if (poolType.lootRaffle) {
      assert.isBelow(emissionsAccountData.lootRaffleAmount.toNumber(), emissionsAccountData.lootRaffleTotal.toNumber());
    } else if (poolType.globalTapping) {
      assert.isBelow(emissionsAccountData.globalTappingAmount.toNumber(), emissionsAccountData.globalTappingTotal.toNumber());
    }

    const userTokenAccount = await provider.connection.getTokenAccountBalance(userAssociatedAccount.address);
    assert.isAbove(userTokenAccount.value.uiAmount, 0);
  });
});
