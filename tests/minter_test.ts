// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { Minter } from "../target/types/minter";
// import { TOKEN_PROGRAM_ID, MintLayout, createInitializeMintInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
// import { SystemProgram, Transaction } from "@solana/web3.js";
// import { assert } from "chai";

// describe("minter", () => {
//   // Configure the client to use the local cluster.
//   anchor.setProvider(anchor.AnchorProvider.env());

//   const program = anchor.workspace.Minter as Program<Minter>;
//   const provider = anchor.AnchorProvider.env();
//   const wallet = provider.wallet;

//   const emissionsAccountKeypair = anchor.web3.Keypair.generate();
//   const burnAccountKeypair = anchor.web3.Keypair.generate();
//   const burnPoolAuthorityKeypair = anchor.web3.Keypair.generate();
//   const mintKeypair = anchor.web3.Keypair.generate();

//   const emissionsAccount = emissionsAccountKeypair.publicKey;
//   const burnAccount = burnAccountKeypair.publicKey;
//   const burnPoolAuthority = burnPoolAuthorityKeypair.publicKey;

//   it("Create and initialize mint account", async () => {
//     const lamports = await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span);
//     const transaction = new Transaction().add(
//       SystemProgram.createAccount({
//         fromPubkey: wallet.publicKey,
//         newAccountPubkey: mintKeypair.publicKey,
//         space: MintLayout.span,
//         lamports: lamports,
//         programId: TOKEN_PROGRAM_ID,
//       }),
//       createInitializeMintInstruction(
//         mintKeypair.publicKey,
//         0, // Decimals
//         wallet.publicKey,
//         wallet.publicKey,
//         TOKEN_PROGRAM_ID
//       )
//     );
//     await provider.sendAndConfirm(transaction, [mintKeypair]);

//     await getOrCreateAssociatedTokenAccount(
//       provider.connection,
//       wallet.payer,
//       mintKeypair.publicKey,
//       wallet.publicKey
//     );
//   });

//   it("Initialize accounts", async () => {
//     const tx = await program.methods
//       .initialize()
//       .accounts({
//         emissionsAccount,
//         burnAccount,
//         user: wallet.publicKey,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([emissionsAccountKeypair, burnAccountKeypair])
//       .rpc();

//     console.log("Your transaction signature:", tx);

//     const emissionsData = await program.account.emissionsAccount.fetch(emissionsAccount);
//     assert.equal(emissionsData.initialEmissions, 3000000000);
//     assert.equal(emissionsData.decayFactor, 0.8705505633);
//     assert.equal(emissionsData.currentMonth, 0);
//     assert.equal(emissionsData.currentEmissions, 3000000000);

//     const burnData = await program.account.burnAccount.fetch(burnAccount);
//     assert.equal(burnData.totalBurned, 0);
//   });

//   // it("Calculate and Mint", async () => {
//   //   const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
//   //     provider.connection,
//   //     wallet.payer,
//   //     mintKeypair.publicKey,
//   //     wallet.publicKey
//   //   );

//   //   const tx = await program.methods.calculateAndMint()
//   //     .accounts({
//   //       emissionsAccount,
//   //       mint: mintKeypair.publicKey,
//   //       to: associatedTokenAccount.address,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //       user: wallet.publicKey,
//   //     })
//   //     .signers([wallet.payer])
//   //     .rpc();

//   //   console.log("Your transaction signature:", tx);

//   //   const emissionsData = await program.account.emissionsAccount.fetch(emissionsAccount);
//   //   assert.equal(emissionsData.currentMonth, 1);
//   //   console.log(emissionsData.currentEmissions.toString());
//   // });

//   // it("Burn Tokens", async () => {
//   //   const mint = mintKeypair.publicKey;

//   //   const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
//   //     provider.connection,
//   //     wallet.payer,
//   //     mint,
//   //     burnPoolAuthority
//   //   );
//   //   const burnPoolAccount = associatedTokenAccount.address;

//   //   await program.methods
//   //     .calculateAndMint()
//   //     .accounts({
//   //       emissionsAccount,
//   //       mint: mint,
//   //       to: burnPoolAccount,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //       user: wallet.publicKey,
//   //     })
//   //     .signers([wallet.payer])
//   //     .rpc();

//   //   const tx = await program.methods
//   //     .burnTokens(new anchor.BN(500000))
//   //     .accounts({
//   //       mint: mint,
//   //       burnPoolAccount: burnPoolAccount,
//   //       burnPoolAuthority: burnPoolAuthority,
//   //       burnAccount: burnAccount,
//   //       tokenProgram: TOKEN_PROGRAM_ID,
//   //     })
//   //     .signers([burnPoolAuthorityKeypair])
//   //     .rpc();

//   //   console.log("Your transaction signature:", tx);

//   //   const burnData = await program.account.burnAccount.fetch(burnAccount);
//   //   console.log("Total Burned:", burnData.totalBurned.toString()); // Convert BN to string
//   // });
// });


import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { Minter } from "../target/types/minter";

describe("minter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.Minter as Program<Minter>;

  it("Initializes the emissions account", async () => {
    // Get a signer wallet
    const wallet = provider.wallet;

    // Derive the PDAs
    const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("emissions_account")],
      program.programId
    );
    console.log("line 168 ", emissionsAccountBump, emissionsAccountPda);

    const [lootRafflePoolPda, lootRafflePoolBump] = await PublicKey.findProgramAddress(
      [Buffer.from("loot_raffle_pool")],
      program.programId
    );
    console.log("line 174 ", lootRafflePoolPda, lootRafflePoolBump);

    const [globalTappingPoolPda, globalTappingPoolBump] = await PublicKey.findProgramAddress(
      [Buffer.from("global_tapping_pool")],
      program.programId
    );
    console.log("line 180 ", globalTappingPoolBump, globalTappingPoolPda);

    // // Initialize the accounts
    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(wallet.publicKey, 1000000000), // Airdrop SOL for transaction fees
    //   "confirmed"
    // );

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

    console.log("hi");

    // Fetch the initialized data
    const emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

    // Verify the initial values
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
  });
});
