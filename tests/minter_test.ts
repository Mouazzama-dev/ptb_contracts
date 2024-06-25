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

  const merkleRoot = Buffer.from('3e421d00400ce1cf199682f74d3eb353a0c4978a99b73c65a56aeeaa81b81891', 'hex');
  let merkleTreePda: PublicKey;
  let bump: number;

  before(async () => {
    try {
      // Find the Merkle Tree PDA
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
      // Initialize the emissions account if not already done
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

      // Assertions to ensure the correct initialization
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

  it("Initializes the Merkle Tree Account", async () => {
    try {      
      // Initialize the Merkle Tree Account
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
      // Create the mint account
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MintLayout.span,
        lamports: lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      // Initialize the mint account
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        5, // Decimals
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(transaction, [mintKeypair]);

    // Get or create the associated token account
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

    // Calculate and mint the emissions
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

    // Assertions to ensure the emissions were calculated and minted correctly
    assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), expectedMonth);
    assert.isAbove(emissionsAccountData.currentEmissions.toNumber(), 0);
  });

  it("Claims rewards successfully", async () => {
    // Derive the PDAs
    const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("emissions_account")],
      program.programId
    );

    const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintKeypair.publicKey,
      wallet.publicKey
    );
    console.log("Associated Token Account: ", associatedTokenAccount.address);

    // Mock user address and proof
    const userAddress = wallet.publicKey;
    console.log("User Address: ", userAddress);

    // Initialize the emissions account if not already done
    let emissionsAccountData;
    try {
      emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);
    } catch (err) {
      await program.rpc.initialize({
        accounts: {
          emissionsAccount: emissionsAccountPda,
          lootRafflePool: emissionsAccountPda,
          globalTappingPool: emissionsAccountPda,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [wallet.payer],
      });
      emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);
    }

    // Define the amount to claim and the pool type
    const amountToClaim = 5; // Example amount
    const proof = [Buffer.from('df11146d98716abe954b4a08a4064f51aa22b62a327802230e69994ba600e879', 'hex')];
    const formattedProof = proof.map(p => Array.from(p));

    [merkleTreePda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("merkle_tree_1")],
      MerkleRewardsProgram.programId
    );
    console.log("Merkle Tree PDA: ", merkleTreePda.toString());

    // Fund the emissions account for testing
    await program.rpc.calculateAndMint({
      accounts: {
        emissionsAccount: emissionsAccountPda,
        mint: mintKeypair.publicKey,
        to: associatedTokenAccount.address,
        mintAuthority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [wallet.payer],
    });

    const valueToClaim = new anchor.BN(amountToClaim);
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

    console.log("Initial Loot Raffle Amount: ", emissionsAccountData.lootRaffleAmount.toNumber());
    console.log("Initial Global Tapping Amount: ", emissionsAccountData.globalTappingAmount.toNumber());

    const poolType = { lootRaffle: {} };

    const mintInfo = await provider.connection.getParsedAccountInfo(mintKeypair.publicKey);
    const tokenAccountInfo = await provider.connection.getParsedAccountInfo(tokenAssociatedAccount.address);

    console.log("Mint Account Info: ", mintKeypair.publicKey);
    console.log("Token Associated Account Info: ", tokenAssociatedAccount.address);
    console.log("User Associated Account Info: ", userAssociatedAccount.address);

    // Perform the claim_rewards operation
    await program.rpc.claimRewards(valueToClaim, poolType, userAddress, formattedProof, {
      accounts: {
        emissionsAccount: emissionsAccountPda,
        merkleProgram: MerkleRewardsProgram.programId,
        merkleTree: merkleTreePda,
        associatedTokenAccount: tokenAssociatedAccount.address,
        userTokenAccount: userAssociatedAccount.address,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: wallet.publicKey,
      },
      signers: [wallet.payer],
    });

    // Fetch the updated emissions account data after claiming rewards
    const updatedEmissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

    console.log("Claimed rewards successfully");
  });

});
