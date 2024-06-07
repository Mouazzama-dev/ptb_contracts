import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Minter } from "../target/types/minter";
import { TOKEN_PROGRAM_ID, MintLayout, createInitializeMintInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";

describe("minter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Minter as Program<Minter>;

  let mint: Keypair;
  let emissionsAccount: Keypair;
  let burnAccount: Keypair;

  before(async () => {
    // Generate new keypairs for the mint, emissions account, and burn account
    mint = anchor.web3.Keypair.generate();
    emissionsAccount = anchor.web3.Keypair.generate();
    burnAccount = anchor.web3.Keypair.generate();

    console.log("Creating mint account...");
    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(MintLayout.span);
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: mintRent,
        space: MintLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        9, // decimals
        provider.wallet.publicKey, // mint authority
        provider.wallet.publicKey // freeze authority
      )
    );

    await provider.sendAndConfirm(transaction, [mint]);
    console.log("Mint account created.");

    // Get or create the associated token account
    console.log("Getting or creating associated token account...");
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint.publicKey,
      provider.wallet.publicKey
    );
    console.log("Associated token account created.");

    console.log("Calling initialize method on the program...");
    // const tx = await program.methods.initialize().accounts({
    //   emissionsAccount: emissionsAccount.publicKey,
    //   burnAccount: burnAccount.publicKey,
    //   user: provider.wallet.publicKey,
    //   systemProgram: SystemProgram.programId,
    // }).signers([emissionsAccount, burnAccount]).rpc();

    console.log("Initialization done.");
  });

  it("Is initialized!", async () => {
    // Add your test here.
    console.log("Starting test initialization...");
    const tx = await program.methods.initialize().accounts({
      emissionsAccount: emissionsAccount.publicKey,
      burnAccount: burnAccount.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    }).signers([emissionsAccount, burnAccount]).rpc();

    console.log("Your transaction signature", tx);
  });
});
