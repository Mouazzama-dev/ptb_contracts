import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Minter } from "../target/types/minter";
import { TOKEN_PROGRAM_ID, MintLayout, createInitializeMintInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";
import * as assert from "assert";

describe("minter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Minter as Program<Minter>;

  let mint: Keypair;
  let emissionsAccount: Keypair;
  let burnAccount: Keypair;
  let tokenAccount: PublicKey;

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
    tokenAccount = userTokenAccount.address;
    console.log("Associated token account created.");
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

  it("Mints tokens based on emission schedule", async () => {
    // Fetch the initial token account balance.
    const initialBalance = await getTokenAccountBalance(provider, tokenAccount);
    console.log("Initial Balance:", initialBalance);
    console.log(emissionsAccount.publicKey.toString());
    console.log(provider.wallet.publicKey.toString());

    // Mint tokens for the first month.
    await program.rpc.calculateAndMint({
      accounts: {
        emissionsAccount: emissionsAccount.publicKey,
        mint: mint.publicKey,
        to: tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: provider.wallet.publicKey,
      },
    });

    // Fetch the token account balance after the first month minting.
    let tokenAccountInfo = await getTokenAccountBalance(provider, tokenAccount);
    let firstMonthEmission = 3_000_000_000 * 1_000_00; // Adjust for decimals
    console.log(
      "Expected Balance after first month:",
      initialBalance + firstMonthEmission
    );
    console.log("Actual Balance after first month:", tokenAccountInfo);
    assert.equal(tokenAccountInfo, initialBalance + firstMonthEmission);
    tokenAccountInfo = await getTokenAccountBalance(provider, tokenAccount);
    console.log(tokenAccountInfo)
    // Mint tokens for the second month.
    await program.rpc.calculateAndMint({
      accounts: {
        emissionsAccount: emissionsAccount.publicKey,
        mint: mint.publicKey,
        to: tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: provider.wallet.publicKey,
      },
    });

    // Fetch the token account balance after the second month minting.
    tokenAccountInfo = await getTokenAccountBalance(provider, tokenAccount);
    console.log(tokenAccountInfo)

    let secondMonthEmission = Math.floor(firstMonthEmission * 0.8705505633);
    console.log(
      "Expected Balance after second month:",
      initialBalance + firstMonthEmission + secondMonthEmission
    );
    console.log("Actual Balance after second month:", tokenAccountInfo);

    console.log(
      `Assert: ${tokenAccountInfo} == ${initialBalance + firstMonthEmission + secondMonthEmission}`
    );
     console.log(initialBalance)
     console.log(firstMonthEmission)
     console.log(secondMonthEmission)


    console.log(tokenAccountInfo - ( initialBalance + firstMonthEmission + secondMonthEmission))
    assert.equal(
      tokenAccountInfo,
      initialBalance + firstMonthEmission + secondMonthEmission
    );
  });
});

// Helper function to fetch token account balance
async function getTokenAccountBalance(provider: anchor.AnchorProvider, tokenAccount: PublicKey) {
  const accountInfo = await provider.connection.getTokenAccountBalance(tokenAccount);
  return parseInt(accountInfo.value.amount);
}
