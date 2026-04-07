/**
 * Solana Program Instruction Builders (@solana/kit)
 *
 * Builds instructions for the Workflow Marketplace program
 */
import {
  address,
  AccountRole,
  getProgramDerivedAddress,
  getAddressEncoder,
  type Address,
  type Instruction,
} from '@solana/kit';

export const PROGRAM_ID = address('3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW');

const SYSTEM_PROGRAM_ADDRESS = address('11111111111111111111111111111111');

const addressEncoder = getAddressEncoder();

function toBytes(addr: Address): Uint8Array {
  return new Uint8Array(addressEncoder.encode(addr));
}

/**
 * Find PDA with seeds
 */
export async function findPDA(seeds: (Buffer | Uint8Array)[]): Promise<[Address, number]> {
  const result = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: seeds.map((s) => new Uint8Array(s)),
  });
  return [result[0], result[1] as number];
}

/**
 * Get Config PDA
 */
export async function getConfigPDA(): Promise<[Address, number]> {
  return findPDA([Buffer.from('config')]);
}

/**
 * Get Treasury PDA
 */
export async function getTreasuryPDA(): Promise<[Address, number]> {
  return findPDA([Buffer.from('treasury')]);
}

/**
 * Get Workflow PDA
 */
export async function getWorkflowPDA(workflowId: Address): Promise<[Address, number]> {
  return findPDA([Buffer.from('workflow'), toBytes(workflowId)]);
}

/**
 * Get Access PDA
 */
export async function getAccessPDA(
  workflowId: Address,
  user: Address
): Promise<[Address, number]> {
  return findPDA([
    Buffer.from('access'),
    toBytes(workflowId),
    toBytes(user),
  ]);
}

/**
 * Get Review PDA
 */
export async function getReviewPDA(
  workflowId: Address,
  reviewer: Address
): Promise<[Address, number]> {
  return findPDA([
    Buffer.from('review'),
    toBytes(workflowId),
    toBytes(reviewer),
  ]);
}

/**
 * Instruction 0: Initialize Program
 */
export async function createInitializeInstruction(
  payer: Address,
  treasury: Address,
  upgradeAuthority: Address
): Promise<Instruction> {
  const [configPDA] = await getConfigPDA();
  const [treasuryPDA] = await getTreasuryPDA();

  const data = new Uint8Array([
    0, // instruction 0
    ...toBytes(treasury),
    ...toBytes(upgradeAuthority),
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: configPDA, role: AccountRole.WRITABLE },
      { address: treasuryPDA, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

/**
 * Instruction 1: Create Workflow
 */
export interface CreateWorkflowParams {
  workflowId: Address;
  contentHash: Uint8Array; // 64 bytes
  version: string; // max 16 bytes
  pricingModel: number; // 0-4
  priceMint: Address;
  priceAmount: bigint;
  creatorShare: number; // bps (0-10000)
  isPublic: boolean;
}

export async function createCreateWorkflowInstruction(
  author: Address,
  params: CreateWorkflowParams
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(params.workflowId);

  // Prepare version buffer (16 bytes)
  const versionBuffer = new Uint8Array(16);
  const versionBytes = Buffer.from(params.version);
  versionBuffer.set(versionBytes, 0);

  // Prepare price amount (8 bytes, little-endian)
  const priceAmountBuffer = new Uint8Array(8);
  const priceAmountView = new DataView(priceAmountBuffer.buffer);
  priceAmountView.setBigUint64(0, params.priceAmount, true);

  // Prepare creator share (2 bytes, little-endian)
  const creatorShareBuffer = new Uint8Array(2);
  const creatorShareView = new DataView(creatorShareBuffer.buffer);
  creatorShareView.setUint16(0, params.creatorShare, true);

  const data = Buffer.concat([
    Buffer.from([1]), // instruction 1
    Buffer.from(toBytes(params.workflowId)),
    Buffer.from(params.contentHash),
    Buffer.from(versionBuffer),
    Buffer.from([params.pricingModel]),
    Buffer.from(toBytes(params.priceMint)),
    Buffer.from(priceAmountBuffer),
    Buffer.from(creatorShareBuffer),
    Buffer.from([params.isPublic ? 1 : 0]),
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: author, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: new Uint8Array(data),
  };
}

/**
 * Instruction 2: Purchase Workflow
 */
export async function createPurchaseWorkflowInstruction(
  buyer: Address,
  workflowId: Address,
  accessType: number = 0 // 0=purchased, 1=subscribed, 2=rented
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);
  const [accessPDA] = await getAccessPDA(workflowId, buyer);

  const data = new Uint8Array([
    2, // instruction 2
    ...toBytes(workflowId),
    accessType,
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: buyer, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
      { address: accessPDA, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

/**
 * Instruction 3: Review Workflow
 */
export async function createReviewWorkflowInstruction(
  reviewer: Address,
  workflowId: Address,
  rating: number, // 1-5
  commentHash: Uint8Array // 32 bytes
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);
  const [reviewPDA] = await getReviewPDA(workflowId, reviewer);
  const [accessPDA] = await getAccessPDA(workflowId, reviewer);

  const data = new Uint8Array([
    3, // instruction 3
    ...toBytes(workflowId),
    rating,
    ...commentHash,
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: reviewer, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
      { address: reviewPDA, role: AccountRole.WRITABLE },
      { address: accessPDA, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

/**
 * Instruction 4: Update Workflow
 */
export async function createUpdateWorkflowInstruction(
  author: Address,
  workflowId: Address,
  newContentHash: Uint8Array // 64 bytes
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);

  const data = new Uint8Array([
    4, // instruction 4
    ...toBytes(workflowId),
    ...newContentHash,
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: author, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/**
 * Instruction 5: Deactivate Workflow
 */
export async function createDeactivateWorkflowInstruction(
  author: Address,
  workflowId: Address
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);

  const data = new Uint8Array([
    5, // instruction 5
    ...toBytes(workflowId),
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: author, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/**
 * Instruction 6: Activate Workflow
 */
export async function createActivateWorkflowInstruction(
  author: Address,
  workflowId: Address
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);

  const data = new Uint8Array([
    6, // instruction 6
    ...toBytes(workflowId),
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: author, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/**
 * Instruction 7: Delete Workflow
 */
export async function createDeleteWorkflowInstruction(
  author: Address,
  workflowId: Address
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);

  const data = new Uint8Array([
    7, // instruction 7
    ...toBytes(workflowId),
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: author, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/**
 * Instruction 8: Purchase Workflow V2 (with payment)
 */
export async function createPurchaseWorkflowV2Instruction(
  buyer: Address,
  workflowId: Address,
  author: Address,
  accessType: number = 0 // 0=purchased, 1=subscribed, 2=rented
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);
  const [accessPDA] = await getAccessPDA(workflowId, buyer);
  const [configPDA] = await getConfigPDA();
  const [treasuryPDA] = await getTreasuryPDA();

  const data = new Uint8Array([
    8, // instruction 8
    ...toBytes(workflowId),
    accessType,
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: buyer, role: AccountRole.WRITABLE_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
      { address: accessPDA, role: AccountRole.WRITABLE },
      { address: author, role: AccountRole.WRITABLE },
      { address: treasuryPDA, role: AccountRole.WRITABLE },
      { address: configPDA, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

/**
 * Instruction 9: Record Execution
 */
export async function createRecordExecutionInstruction(
  executor: Address,
  workflowId: Address
): Promise<Instruction> {
  const [workflowPDA] = await getWorkflowPDA(workflowId);
  const [accessPDA] = await getAccessPDA(workflowId, executor);

  const data = new Uint8Array([
    9, // instruction 9
    ...toBytes(workflowId),
  ]);

  return {
    programAddress: PROGRAM_ID,
    accounts: [
      { address: executor, role: AccountRole.READONLY_SIGNER },
      { address: workflowPDA, role: AccountRole.WRITABLE },
      { address: accessPDA, role: AccountRole.WRITABLE },
    ],
    data,
  };
}
