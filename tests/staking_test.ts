import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, createMint, mintTo, getAccount, MintLayout, createInitializeMintInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL , Transaction} from "@solana/web3.js";
import { assert } from "chai";
import { Staking } from "../target/types/staking"


describe('staking_program', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking as Program<Staking>;

  let stakingAccountPda: PublicKey;
  let stakingAccountBump: number;
  const wallet = provider.wallet;
  const mintKeypair = anchor.web3.Keypair.generate();


  
   
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

  it('Initialize staking account ', async () => {
    // Generate keypairs
    const tradingFeePool = anchor.web3.Keypair.generate().publicKey;
    const adminWallet = anchor.web3.Keypair.generate().publicKey;

    // Find the PDA for the staking account
    const [stakingAccountPda, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('staking_account_1'), wallet.publicKey.toBuffer()],
      program.programId
    );

    try {
      // Fetch the staking account to check if it already exists
      const stakingAccount = await program.account.stakingAccount.fetch(stakingAccountPda);

      console.log('Staking account already exists:', stakingAccount);
    } catch (e) {
      console.log('Staking account does not exist, initializing...');

      // If staking account does not exist, initialize it
      await program.methods
        .initialize(tradingFeePool, adminWallet)
        .accounts({
          stakingAccount: stakingAccountPda,
          user: wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc();

      // Fetch the newly created staking account to confirm it was initialized
      const stakingAccount = await program.account.stakingAccount.fetch(stakingAccountPda);

      console.log('Staking account initialized:', stakingAccount);

      assert.ok(stakingAccount.tradingFeePool.equals(tradingFeePool));
      assert.ok(stakingAccount.admin.equals(adminWallet));
      assert.equal(stakingAccount.totalStaked, 0);
    }
  });
  it('Stake tokens and calculate staking score', async () => {
    // Generate keypairs
    const user = anchor.web3.Keypair.generate();
    const adminWallet = anchor.web3.Keypair.generate().publicKey;



    const adminAssociatedAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            mintKeypair.publicKey,
            adminWallet
          );
      
          const userAssociatedAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            mintKeypair.publicKey,
            wallet.publicKey
          );
  
    // Find the PDA for the staking account
    const [stakingAccountPda, stakingAccountBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('staking_account_1'), wallet.publicKey.toBuffer()],
      program.programId
    );
  
    // Find the PDA for the user account
    const [userAccountPda, userAccountBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('user_account'), wallet.publicKey.toBuffer()],
      program.programId
    );
  
    // Define staking parameters
    const amount = 1000;
    const lockPeriod = 3; // 3 months
  
    try {
      // Fetch the user account to check if it already exists
      const userAccount = await program.account.userAccount.fetch(userAccountPda);
  
      console.log('User account already exists:', userAccount);
    } catch (e) {
      console.log('User account does not exist, staking...');
      const value = new anchor.BN(amount)
      // If user account does not exist, stake tokens and calculate staking score
      await program.methods
        .stake(value, lockPeriod)
        .accounts({
          stakingAccount: stakingAccountPda,
          userAccount: userAccountPda,
          user: wallet.publicKey,
          adminTokenAccount: adminAssociatedAccount.address,
          userTokenAccount: userAssociatedAccount.address,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet.payer])
        .rpc();
  
      // Fetch the newly created user account to confirm staking
      const userAccount = await program.account.userAccount.fetch(userAccountPda);
  
      console.log('User account after staking:', userAccount);
  
      // Check staking score calculation
      const expectedStakingScore = amount * 1.4; // 1.4x multiplier for 3 months lock period
      assert.equal(userAccount.stakingScore, expectedStakingScore);
      assert.equal(userAccount.amountStaked, amount);
      assert.equal(userAccount.lockPeriod, lockPeriod);
  
      // Check if the total staked in the staking account is updated
      const stakingAccount = await program.account.stakingAccount.fetch(stakingAccountPda);
      assert.equal(stakingAccount.totalStaked, amount);
    }
  });

  it('Allocate pools and claim rewards', async () => {
    // Generate keypairs
    const user = anchor.web3.Keypair.generate();
    const mint = await createMint(provider.connection, wallet.payer, wallet.publicKey, null, 9);
  
    // // Create user token account and mint tokens
    // const userTokenAccount = await createAccount(provider.connection, wallet.payer, mint, user.publicKey);
    // await mintTo(provider.connection, wallet.payer, mint, userTokenAccount, wallet.payer, 1000);
  
    // // Create admin token account
    // const adminTokenAccount = await createAccount(provider.connection, wallet.payer, mint, adminWallet);
    const adminWallet = anchor.web3.Keypair.generate().publicKey;



    const adminAssociatedAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            wallet.payer,
            mintKeypair.publicKey,
            adminWallet
          );
  
  
    // Find the PDAs for the various pools
    const [burnPoolPda, burnPoolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('burn_pool')],
      program.programId
    );
  
    const [teamPoolPda, teamPoolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('team_pool')],
      program.programId
    );

  
    const [stakingRewardsPoolPda, stakingRewardsPoolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('staking_rewards_pool')],
      program.programId
    );
  
    const [lastPushPoolPda, lastPushPoolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('last_push_pool')],
      program.programId
    );

  
    const [premiumPackPoolPda, premiumPackPoolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from('premium_pack_pool')],
      program.programId
    );
  
    // Allocate pools
    const amount = new anchor.BN(1000);
    await program.methods
      .allocatePools(amount)
      .accounts({
        burnPool: burnPoolPda,
        teamPool: teamPoolPda,
        stakingRewardsPool: stakingRewardsPoolPda,
        lastPushPool: lastPushPoolPda,
        premiumPackPool: premiumPackPoolPda,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        user: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([wallet.payer])
      .rpc();
  
  });
});
