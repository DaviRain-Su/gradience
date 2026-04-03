/**
 * Solana Program Instruction Builders
 * 
 * Builds instructions for the Workflow Marketplace program
 */
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW');

/**
 * Find PDA with seeds
 */
export function findPDA(seeds: (Buffer | Uint8Array)[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

/**
 * Get Config PDA
 */
export function getConfigPDA(): [PublicKey, number] {
  return findPDA([Buffer.from('config')]);
}

/**
 * Get Treasury PDA
 */
export function getTreasuryPDA(): [PublicKey, number] {
  return findPDA([Buffer.from('treasury')]);
}

/**
 * Get Workflow PDA
 */
export function getWorkflowPDA(workflowId: PublicKey): [PublicKey, number] {
  return findPDA([Buffer.from('workflow'), workflowId.toBuffer()]);
}

/**
 * Get Access PDA
 */
export function getAccessPDA(
  workflowId: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return findPDA([
    Buffer.from('access'),
    workflowId.toBuffer(),
    user.toBuffer(),
  ]);
}

/**
 * Get Review PDA
 */
export function getReviewPDA(
  workflowId: PublicKey,
  reviewer: PublicKey
): [PublicKey, number] {
  return findPDA([
    Buffer.from('review'),
    workflowId.toBuffer(),
    reviewer.toBuffer(),
  ]);
}

/**
 * Instruction 0: Initialize Program
 */
export function createInitializeInstruction(
  payer: PublicKey,
  treasury: PublicKey,
  upgradeAuthority: PublicKey
): TransactionInstruction {
  const [configPDA] = getConfigPDA();
  const [treasuryPDA] = getTreasuryPDA();

  const data = Buffer.concat([
    Buffer.from([0]), // instruction 0
    treasury.toBuffer(),
    upgradeAuthority.toBuffer(),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 1: Create Workflow
 */
export interface CreateWorkflowParams {
  workflowId: PublicKey;
  contentHash: Buffer; // 64 bytes
  version: string; // max 16 bytes
  pricingModel: number; // 0-4
  priceMint: PublicKey;
  priceAmount: bigint;
  creatorShare: number; // bps (0-10000)
  isPublic: boolean;
}

export function createCreateWorkflowInstruction(
  author: PublicKey,
  params: CreateWorkflowParams
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(params.workflowId);

  // Prepare version buffer (16 bytes)
  const versionBuffer = Buffer.alloc(16);
  Buffer.from(params.version).copy(versionBuffer, 0);

  // Prepare price amount (8 bytes, little-endian)
  const priceAmountBuffer = Buffer.alloc(8);
  priceAmountBuffer.writeBigUInt64LE(params.priceAmount);

  // Prepare creator share (2 bytes, little-endian)
  const creatorShareBuffer = Buffer.alloc(2);
  creatorShareBuffer.writeUInt16LE(params.creatorShare);

  const data = Buffer.concat([
    Buffer.from([1]), // instruction 1
    params.workflowId.toBuffer(),
    params.contentHash,
    versionBuffer,
    Buffer.from([params.pricingModel]),
    params.priceMint.toBuffer(),
    priceAmountBuffer,
    creatorShareBuffer,
    Buffer.from([params.isPublic ? 1 : 0]),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: author, isSigner: true, isWritable: true },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 2: Purchase Workflow
 */
export function createPurchaseWorkflowInstruction(
  buyer: PublicKey,
  workflowId: PublicKey,
  accessType: number = 0 // 0=purchased, 1=subscribed, 2=rented
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(workflowId);
  const [accessPDA] = getAccessPDA(workflowId, buyer);

  const data = Buffer.concat([
    Buffer.from([2]), // instruction 2
    workflowId.toBuffer(),
    Buffer.from([accessType]),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
      { pubkey: accessPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 3: Review Workflow
 */
export function createReviewWorkflowInstruction(
  reviewer: PublicKey,
  workflowId: PublicKey,
  rating: number, // 1-5
  commentHash: Buffer // 32 bytes
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(workflowId);
  const [reviewPDA] = getReviewPDA(workflowId, reviewer);
  const [accessPDA] = getAccessPDA(workflowId, reviewer);

  const data = Buffer.concat([
    Buffer.from([3]), // instruction 3
    workflowId.toBuffer(),
    Buffer.from([rating]),
    commentHash,
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: reviewer, isSigner: true, isWritable: true },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
      { pubkey: reviewPDA, isSigner: false, isWritable: true },
      { pubkey: accessPDA, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 4: Update Workflow
 */
export function createUpdateWorkflowInstruction(
  author: PublicKey,
  workflowId: PublicKey,
  newContentHash: Buffer // 64 bytes
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(workflowId);

  const data = Buffer.concat([
    Buffer.from([4]), // instruction 4
    workflowId.toBuffer(),
    newContentHash,
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: author, isSigner: true, isWritable: false },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 5: Deactivate Workflow
 */
export function createDeactivateWorkflowInstruction(
  author: PublicKey,
  workflowId: PublicKey
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(workflowId);

  const data = Buffer.concat([
    Buffer.from([5]), // instruction 5
    workflowId.toBuffer(),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: author, isSigner: true, isWritable: false },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 6: Activate Workflow
 */
export function createActivateWorkflowInstruction(
  author: PublicKey,
  workflowId: PublicKey
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(workflowId);

  const data = Buffer.concat([
    Buffer.from([6]), // instruction 6
    workflowId.toBuffer(),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: author, isSigner: true, isWritable: false },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Instruction 7: Delete Workflow
 */
export function createDeleteWorkflowInstruction(
  author: PublicKey,
  workflowId: PublicKey
): TransactionInstruction {
  const [workflowPDA] = getWorkflowPDA(workflowId);

  const data = Buffer.concat([
    Buffer.from([7]), // instruction 7
    workflowId.toBuffer(),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: author, isSigner: true, isWritable: true },
      { pubkey: workflowPDA, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}
