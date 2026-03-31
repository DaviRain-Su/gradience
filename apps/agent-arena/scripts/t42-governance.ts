import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { promisify } from 'node:util';

import * as multisig from '@sqds/multisig';
import {
    Connection,
    Keypair,
    PublicKey,
    TransactionInstruction,
    TransactionMessage,
    type Commitment,
    type Signer,
} from '@solana/web3.js';

const execFile = promisify(execFileCallback);

const CONFIG_DISCRIMINATOR = 0x09;
const ACCOUNT_VERSION_V1 = 0x01;
const DEFAULT_PROGRAM_ID = 'GradCAJU13S33LdQK2FZ5cbuRXyToDaH7YVD2mFiqKF4';
const BASE58_ADDRESS_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export interface T42RunConfig {
    rpcEndpoint: string;
    payerKeypairPath: string;
    memberKeypairPaths: string[];
    threshold: number;
    programId: string;
    newTreasury: string | null;
    newMinJudgeStake: bigint | null;
    createGradMint: boolean;
    gradDecimals: number;
    gradInitialSupply: bigint;
    transferProgramUpgradeAuthority: boolean;
    currentProgramUpgradeAuthorityKeypairPath: string | null;
    commitment: Commitment;
    dryRun: boolean;
}

export interface T42RunSummary {
    gradMint: string | null;
    multisigPda: string;
    vaultPda: string;
    configPda: string;
    multisigCreateSignature: string;
    vaultTransactionCreateSignature: string;
    proposalCreateSignature: string;
    proposalApproveSignatures: string[];
    vaultExecuteSignature: string;
}

interface UpgradeConfigInstructionArgs {
    programId: PublicKey;
    authority: PublicKey;
    config: PublicKey;
    newTreasury: PublicKey | null;
    newMinJudgeStake: bigint | null;
}

interface SplTokenCreateResult {
    mintAddress: string;
}

export function parseT42Config(env: NodeJS.ProcessEnv): T42RunConfig {
    const payerKeypairPath = requireEnv(env.T42_PAYER_KEYPAIR, 'T42_PAYER_KEYPAIR');
    const memberKeypairPaths = splitCsv(env.T42_MEMBER_KEYPAIRS);
    if (memberKeypairPaths.length < 5) {
        throw new Error('T42_MEMBER_KEYPAIRS must contain at least 5 keypair file paths');
    }

    const threshold = parsePositiveInteger(env.T42_THRESHOLD, 3);
    if (threshold < 1 || threshold > memberKeypairPaths.length) {
        throw new Error(
            `T42_THRESHOLD must be between 1 and member count (${memberKeypairPaths.length})`,
        );
    }

    const gradDecimals = parsePositiveInteger(env.T42_GRAD_DECIMALS, 9);
    if (gradDecimals > 18) {
        throw new Error('T42_GRAD_DECIMALS must be <= 18');
    }

    return {
        rpcEndpoint: env.T42_RPC_ENDPOINT ?? env.GRADIENCE_RPC_ENDPOINT ?? 'https://api.devnet.solana.com',
        payerKeypairPath,
        memberKeypairPaths,
        threshold,
        programId: env.T42_GRADIENCE_PROGRAM_ID ?? DEFAULT_PROGRAM_ID,
        newTreasury: env.T42_NEW_TREASURY ?? null,
        newMinJudgeStake: parseOptionalBigint(env.T42_NEW_MIN_JUDGE_STAKE),
        createGradMint: parseBoolean(env.T42_CREATE_GRAD_MINT, true),
        gradDecimals,
        gradInitialSupply: parseOptionalBigint(env.T42_GRAD_INITIAL_SUPPLY) ?? 0n,
        transferProgramUpgradeAuthority: parseBoolean(
            env.T42_TRANSFER_PROGRAM_UPGRADE_AUTHORITY,
            false,
        ),
        currentProgramUpgradeAuthorityKeypairPath:
            env.T42_CURRENT_PROGRAM_UPGRADE_AUTHORITY_KEYPAIR ?? null,
        commitment: parseCommitment(env.T42_COMMITMENT, 'confirmed'),
        dryRun: parseBoolean(env.T42_DRY_RUN, false),
    };
}

export async function runT42(config: T42RunConfig): Promise<T42RunSummary> {
    const payer = await loadKeypair(config.payerKeypairPath);
    const memberSigners = await Promise.all(
        config.memberKeypairPaths.map((memberPath) => loadKeypair(memberPath)),
    );

    const uniqueMembers = dedupeMembers(memberSigners);
    if (uniqueMembers.length < 5) {
        throw new Error('T42 requires 5 unique members for a 3/5 multisig');
    }

    const connection = new Connection(config.rpcEndpoint, config.commitment);
    const gradMint = await maybeCreateGradMint(connection, payer, config);

    const createKey = Keypair.generate();
    const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
    const programId = new PublicKey(config.programId);
    const configPda = deriveConfigPda(programId);

    if (config.dryRun) {
        return {
            gradMint,
            multisigPda: multisigPda.toBase58(),
            vaultPda: vaultPda.toBase58(),
            configPda: configPda.toBase58(),
            multisigCreateSignature: 'dry-run-multisig-create',
            vaultTransactionCreateSignature: 'dry-run-vault-transaction-create',
            proposalCreateSignature: 'dry-run-proposal-create',
            proposalApproveSignatures: Array.from({ length: config.threshold }, (_, idx) => {
                return `dry-run-proposal-approve-${idx + 1}`;
            }),
            vaultExecuteSignature: 'dry-run-vault-execute',
        };
    }

    const permissionMask = multisig.types.Permissions.all().mask;
    const members = uniqueMembers.slice(0, 5).map((member) => ({
        key: member.publicKey,
        permissions: { mask: permissionMask },
    }));

    const multisigCreateSignature = await multisig.rpc.multisigCreateV2({
        connection,
        treasury: payer.publicKey,
        createKey,
        creator: payer,
        multisigPda,
        configAuthority: null,
        threshold: config.threshold,
        members,
        timeLock: 0,
        rentCollector: null,
    });

    if (config.transferProgramUpgradeAuthority) {
        const currentAuthority = config.currentProgramUpgradeAuthorityKeypairPath;
        if (!currentAuthority) {
            throw new Error(
                'T42_TRANSFER_PROGRAM_UPGRADE_AUTHORITY requires T42_CURRENT_PROGRAM_UPGRADE_AUTHORITY_KEYPAIR',
            );
        }
        await transferProgramUpgradeAuthority({
            rpcEndpoint: config.rpcEndpoint,
            programId: programId.toBase58(),
            newAuthority: vaultPda.toBase58(),
            currentAuthorityKeypairPath: currentAuthority,
        });
    }

    const configAccount = await connection.getAccountInfo(configPda, config.commitment);
    if (!configAccount) {
        throw new Error(
            `ProgramConfig account not found at ${configPda.toBase58()}; initialize the program first`,
        );
    }

    const configUpgradeAuthority = decodeProgramConfigUpgradeAuthority(configAccount.data);
    if (!configUpgradeAuthority.equals(vaultPda)) {
        throw new Error(
            `ProgramConfig upgrade_authority=${configUpgradeAuthority.toBase58()} does not match Squads vault ${vaultPda.toBase58()}`,
        );
    }

    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda,
    );
    const transactionIndex = BigInt(multisigAccount.transactionIndex.toString());
    const treasury = new PublicKey(config.newTreasury ?? payer.publicKey.toBase58());

    const upgradeConfigInstruction = buildUpgradeConfigInstruction({
        programId,
        authority: vaultPda,
        config: configPda,
        newTreasury: treasury,
        newMinJudgeStake: config.newMinJudgeStake ?? 1_000_000_000n,
    });
    const recentBlockhash = (await connection.getLatestBlockhash(config.commitment)).blockhash;
    const transactionMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash,
        instructions: [upgradeConfigInstruction],
    });

    const vaultTransactionCreateSignature = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: payer,
        multisigPda,
        transactionIndex,
        creator: members[0]!.key,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage,
    });

    const proposalCreateSignature = await multisig.rpc.proposalCreate({
        connection,
        feePayer: payer,
        creator: uniqueMembers[0]!,
        multisigPda,
        transactionIndex,
        isDraft: false,
    });

    const proposalApproveSignatures: string[] = [];
    for (const member of uniqueMembers.slice(0, config.threshold)) {
        const approveSignature = await multisig.rpc.proposalApprove({
            connection,
            feePayer: payer,
            member,
            multisigPda,
            transactionIndex,
        });
        proposalApproveSignatures.push(approveSignature);
    }

    const vaultExecuteSignature = await multisig.rpc.vaultTransactionExecute({
        connection,
        feePayer: payer,
        multisigPda,
        transactionIndex,
        member: uniqueMembers[0]!.publicKey,
    });

    return {
        gradMint,
        multisigPda: multisigPda.toBase58(),
        vaultPda: vaultPda.toBase58(),
        configPda: configPda.toBase58(),
        multisigCreateSignature,
        vaultTransactionCreateSignature,
        proposalCreateSignature,
        proposalApproveSignatures,
        vaultExecuteSignature,
    };
}

export function deriveConfigPda(programId: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from('config')], programId)[0];
}

export function decodeProgramConfigUpgradeAuthority(data: Uint8Array): PublicKey {
    if (data.length < 74) {
        throw new Error('ProgramConfig account data is too short');
    }
    if (data[0] !== CONFIG_DISCRIMINATOR || data[1] !== ACCOUNT_VERSION_V1) {
        throw new Error('Invalid ProgramConfig discriminator/version');
    }
    return new PublicKey(data.slice(34, 66));
}

export function encodeUpgradeConfigData(args: {
    newTreasury: PublicKey | null;
    newMinJudgeStake: bigint | null;
}): Buffer {
    const chunks: Buffer[] = [];
    chunks.push(Buffer.from([10]));

    if (args.newTreasury) {
        chunks.push(Buffer.from([1]));
        chunks.push(args.newTreasury.toBuffer());
    } else {
        chunks.push(Buffer.from([0]));
    }

    if (args.newMinJudgeStake !== null) {
        const encoded = Buffer.alloc(8);
        encoded.writeBigUInt64LE(args.newMinJudgeStake);
        chunks.push(Buffer.from([1]));
        chunks.push(encoded);
    } else {
        chunks.push(Buffer.from([0]));
    }

    return Buffer.concat(chunks);
}

export function buildUpgradeConfigInstruction(args: UpgradeConfigInstructionArgs): TransactionInstruction {
    return new TransactionInstruction({
        programId: args.programId,
        keys: [
            { pubkey: args.authority, isSigner: true, isWritable: false },
            { pubkey: args.config, isSigner: false, isWritable: true },
        ],
        data: encodeUpgradeConfigData({
            newTreasury: args.newTreasury,
            newMinJudgeStake: args.newMinJudgeStake,
        }),
    });
}

export function parseSplTokenMintAddress(output: string): string | null {
    const creatingToken = output.match(/Creating token ([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (creatingToken?.[1]) {
        return creatingToken[1];
    }

    const candidates = output.match(BASE58_ADDRESS_PATTERN);
    if (!candidates || candidates.length === 0) {
        return null;
    }
    return candidates[0] ?? null;
}

async function maybeCreateGradMint(
    connection: Connection,
    payer: Signer,
    config: T42RunConfig,
): Promise<string | null> {
    if (!config.createGradMint) {
        return null;
    }
    void connection;
    if (config.dryRun) {
        return 'dry-run-grad-mint';
    }
    const created = await createGradMint({
        rpcEndpoint: config.rpcEndpoint,
        payerKeypairPath: config.payerKeypairPath,
        decimals: config.gradDecimals,
        initialSupply: config.gradInitialSupply,
    });
    if (created.mintAddress.length === 0) {
        throw new Error('Failed to parse GRAD mint address from spl-token output');
    }
    void payer;
    return created.mintAddress;
}

async function createGradMint(args: {
    rpcEndpoint: string;
    payerKeypairPath: string;
    decimals: number;
    initialSupply: bigint;
}): Promise<SplTokenCreateResult> {
    const baseArgs = [
        '--url',
        args.rpcEndpoint,
        '--keypair',
        args.payerKeypairPath,
        '--fee-payer',
        args.payerKeypairPath,
    ];

    const createResult = await execFile('spl-token', [
        ...baseArgs,
        'create-token',
        '--decimals',
        String(args.decimals),
    ]);
    const mintAddress = parseSplTokenMintAddress(`${createResult.stdout}\n${createResult.stderr}`);
    if (!mintAddress) {
        throw new Error(`Unable to parse mint address from spl-token output:\n${createResult.stdout}`);
    }

    if (args.initialSupply > 0n) {
        await execFile('spl-token', [...baseArgs, 'create-account', mintAddress]);
        await execFile('spl-token', [...baseArgs, 'mint', mintAddress, args.initialSupply.toString()]);
    }

    return { mintAddress };
}

async function transferProgramUpgradeAuthority(args: {
    rpcEndpoint: string;
    programId: string;
    newAuthority: string;
    currentAuthorityKeypairPath: string;
}): Promise<void> {
    await execFile('solana', [
        '--url',
        args.rpcEndpoint,
        'program',
        'set-upgrade-authority',
        args.programId,
        '--new-upgrade-authority',
        args.newAuthority,
        '--skip-new-upgrade-authority-signer-check',
        '--keypair',
        args.currentAuthorityKeypairPath,
    ]);
}

async function loadKeypair(keypairPath: string): Promise<Keypair> {
    const raw = await readFile(keypairPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 64) {
        throw new Error(`Invalid keypair file at ${keypairPath}; expected 64-byte array`);
    }
    const bytes = Uint8Array.from(parsed as number[]);
    return Keypair.fromSecretKey(bytes);
}

function dedupeMembers(signers: Keypair[]): Keypair[] {
    const unique = new Map<string, Keypair>();
    for (const signer of signers) {
        unique.set(signer.publicKey.toBase58(), signer);
    }
    return [...unique.values()];
}

function splitCsv(value: string | undefined): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function requireEnv(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
        return fallback;
    }
    return !['0', 'false', 'False', 'FALSE', 'no', 'No', 'NO'].includes(value);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Expected positive integer, received: ${value}`);
    }
    return parsed;
}

function parseOptionalBigint(value: string | undefined): bigint | null {
    if (!value) {
        return null;
    }
    try {
        const parsed = BigInt(value);
        if (parsed < 0n) {
            throw new Error(`Expected non-negative bigint, received: ${value}`);
        }
        return parsed;
    } catch {
        throw new Error(`Invalid bigint value: ${value}`);
    }
}

function parseCommitment(value: string | undefined, fallback: Commitment): Commitment {
    if (!value) {
        return fallback;
    }
    if (value === 'processed' || value === 'confirmed' || value === 'finalized') {
        return value;
    }
    throw new Error(`Invalid commitment: ${value}`);
}

async function main(): Promise<void> {
    const config = parseT42Config(process.env);
    const summary = await runT42(config);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    void main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exit(1);
    });
}
