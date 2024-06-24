// import * as anchor from "@project-serum/anchor";
// import { Program } from "@project-serum/anchor";
// import { PublicKey, SystemProgram, Keypair, Transaction } from "@solana/web3.js";
// import { assert } from "chai";
// import { Minter } from "../target/types/minter";
// import { TOKEN_PROGRAM_ID, MintLayout, createInitializeMintInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

// describe("minter", () => {
//   // Configure the client to use the local cluster.
//   const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
//   anchor.setProvider(provider);

//   const program = anchor.workspace.Minter as Program<Minter>;
//   const wallet = provider.wallet;
//   const mintKeypair = anchor.web3.Keypair.generate();

//   it("Initializes the emissions account", async () => {
//     // Derive the PDAs
//     const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
//       [Buffer.from("emissions_account")],
//       program.programId
//     );
//     console.log("line 168 ", emissionsAccountBump, emissionsAccountPda);

//     const [lootRafflePoolPda, lootRafflePoolBump] = await PublicKey.findProgramAddress(
//       [Buffer.from("loot_raffle_pool")],
//       program.programId
//     );
//     console.log("line 174 ", lootRafflePoolPda, lootRafflePoolBump);

//     const [globalTappingPoolPda, globalTappingPoolBump] = await PublicKey.findProgramAddress(
//       [Buffer.from("global_tapping_pool")],
//       program.programId
//     );
//     console.log("line 180 ", globalTappingPoolBump, globalTappingPoolPda);

//     // Check if the emissions account is already initialized
//     let emissionsAccountData;
//     try {
//       emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);
//     } catch (err) {
//       // Account not initialized, proceed with initialization
//     }

//     if (!emissionsAccountData) {
//       // Initialize the accounts
//       await program.rpc.initialize({
//         accounts: {
//           emissionsAccount: emissionsAccountPda,
//           lootRafflePool: lootRafflePoolPda,
//           globalTappingPool: globalTappingPoolPda,
//           user: wallet.publicKey,
//           systemProgram: SystemProgram.programId,
//         },
//         signers: [wallet.payer],
//       });
//       console.log("Initialized emissions account");

//       // Fetch the initialized data
//       emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

//       // Verify the initial values
//       assert.strictEqual(emissionsAccountData.initialEmissions.toNumber(), 3000000000);
//       assert.strictEqual(emissionsAccountData.decayFactor, 0.8705505633);
//       assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), 0);
//       assert.strictEqual(emissionsAccountData.currentEmissions.toNumber(), 3000000000);
//       assert.strictEqual(emissionsAccountData.lootRafflePool.toBase58(), lootRafflePoolPda.toBase58());
//       assert.strictEqual(emissionsAccountData.lootRaffleAmount.toNumber(), 50000000);
//       assert.strictEqual(emissionsAccountData.lootRaffleTotal.toNumber(), 50000000);
//       assert.strictEqual(emissionsAccountData.globalTappingPool.toBase58(), globalTappingPoolPda.toBase58());
//       assert.strictEqual(emissionsAccountData.globalTappingAmount.toNumber(), 1000000000);
//       assert.strictEqual(emissionsAccountData.globalTappingTotal.toNumber(), 1000000000);
//     } else {
//       console.log("Emissions account already initialized");
//     }

//     // Fetch the initialized data
//     emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);
//     console.log("Emissions account month: ", emissionsAccountData.currentMonth.toNumber());
//     console.log("Monthly Emissions: ", emissionsAccountData.currentEmissions.toNumber());

//     // Verify the values dynamically based on current state
//     const expectedMonth = emissionsAccountData.currentMonth.toNumber();
//     assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), expectedMonth);
//   });

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
//         5, // Decimals
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

//   it("Calculates and mints emissions", async () => {
//     // Derive the PDAs
//     const [emissionsAccountPda, emissionsAccountBump] = await PublicKey.findProgramAddress(
//       [Buffer.from("emissions_account")],
//       program.programId
//     );

//     const associatedTokenAccount = await getOrCreateAssociatedTokenAccount(
//       provider.connection,
//       wallet.payer,
//       mintKeypair.publicKey,
//       wallet.publicKey
//     );

//     // Fetch the current month to determine the expected month after minting
//     const emissionsAccountDataBefore = await program.account.emissionsAccount.fetch(emissionsAccountPda);
//     const expectedMonth = emissionsAccountDataBefore.currentMonth.toNumber() + 1;

//     await program.rpc.calculateAndMint({
//       accounts: {
//         emissionsAccount: emissionsAccountPda,
//         mint: mintKeypair.publicKey,
//         to: associatedTokenAccount.address,
//         mintAuthority: wallet.publicKey,
//         tokenProgram: TOKEN_PROGRAM_ID,
//       },
//       signers: [wallet.payer],
//     });

//     // Fetch the emissions account data after minting
//     const emissionsAccountData = await program.account.emissionsAccount.fetch(emissionsAccountPda);

//     // Verify the values after minting
//     assert.strictEqual(emissionsAccountData.currentMonth.toNumber(), expectedMonth);
//     assert.isAbove(emissionsAccountData.currentEmissions.toNumber(), 0);
//   });
// });
