// import * as anchor from "@coral-xyz/anchor";
// import { Program, AnchorProvider } from "@coral-xyz/anchor";
// import { MerkleRewards } from "../target/types/merkle_rewards";
// import { Minter } from "../target/types/minter";
// import { PublicKey } from "@solana/web3.js";
// import { expect } from "chai";

// describe("CPI from merkle rewards to Minter", () => {
//   const provider = AnchorProvider.env();

//   // Configure the client to use the local cluster.
//   anchor.setProvider(provider);

//   const MerkleRewardsProgram = anchor.workspace.MerkleRewards as Program<MerkleRewards>;
//   const MinterProgram = anchor.workspace.Minter as Program<Minter>;
//   const dataAccountKeypair = anchor.web3.Keypair.generate();

//   const merkleRoot = Buffer.from('3e421d00400ce1cf199682f74d3eb353a0c4978a99b73c65a56aeeaa81b8189e', 'hex');

//   let merkleTreePda: PublicKey;
//   let bump: number;

//   before(async () => {
//     try {
//       [merkleTreePda, bump] = await PublicKey.findProgramAddress(
//         [Buffer.from("merkle_tree")],
//         MerkleRewardsProgram.programId
//       );
//       console.log("merkleTreePda found: ", merkleTreePda.toString());
//     } catch (error) {
//       console.error("Error finding PDA: ", error);
//       throw error;
//     }
//   });

//   const wallet = provider.wallet;

//   // Uncomment this block if you need to initialize something first
//   // it("Is initialized!", async () => {
//   //   try {
//   //     const tx = await MerkleRewardsProgram.methods.initialize(Array.from(merkleRoot))
//   //       .accounts({
//   //         merkleTree: merkleTreePda,
//   //         user: wallet.publicKey,
//   //         systemProgram: anchor.web3.SystemProgram.programId,
//   //       })
//   //       .signers([wallet.payer])
//   //       .rpc({ skipPreflight: false });

//   //     console.log("Transaction signature", tx);
//   //   } catch (error) {
//   //     console.error("Error initializing: ", error);
//   //     throw error;
//   //   }
//   // });

//   it("Can claim merkle proof!", async () => {
//     try {
//       // Define the amount to claim and generate a proof
//       const amount = 5;
//       const proof = [Buffer.from('bcc35fbd0ba0793927039c72d1fa6d4a48a2b938cd7a526b050d21074735298a', 'hex')];
//       const formattedProof = proof.map(p => Array.from(p));
//       const value = new anchor.BN(amount);

//       [merkleTreePda, bump] = await PublicKey.findProgramAddress(
//         [Buffer.from("merkle_tree")],
//         MerkleRewardsProgram.programId
//       );
      
//       // Define the user address
//       const userAddress = new PublicKey('2vxsF9eTA7gYc5oE1Fnnsqj9AG1NvbpDADmDxtEZ1bQQ');
//       console.log(userAddress.toString());

//       const tx = await MinterProgram.methods
//         .claimMerkleProof(userAddress, value, formattedProof)  // Ensure the method name is correct
//         .accounts({
//           merkleTree: merkleTreePda,  // Ensure the PDA is used here
//           merkleProgram: MerkleRewardsProgram.programId,  // Ensure the MerkleRewards program ID is provided
//           user: wallet.publicKey  // The user who is making the claim
//         })
//         .signers([wallet.payer])
//         .rpc();

//       console.log("Transaction signature", tx);
//     } catch (error) {
//       console.error("Error claiming merkle proof: ", error);
//       throw error;
//     }
//   });

//   // Uncomment and adapt these tests if needed
//   // it("Can assert value in Bob's data account equals 4 + 2", async () => {
//   //   const BobAccountValue = (
//   //     await MinterProgram.account.bobData.fetch(dataAccountKeypair.publicKey)
//   //   ).result.toNumber();
//   //   expect(BobAccountValue).to.equal(6);
//   // });
// });
