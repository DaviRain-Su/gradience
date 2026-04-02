#!/usr/bin/env bun

import { homedir } from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
    AccountRole,
    address,
    createKeyPairSignerFromBytes,
    createSolanaRpc,
    fetchEncodedAccount,
    getAddressEncoder,
    getProgramDerivedAddress,
    type AccountMeta,
    type Address,
    type Instruction,
} from '@solana/kit';

import {
    GRADIENCE_PROGRAM_ADDRESS,
    GradienceSDK,
    KeypairAdapter,
    findEventAuthorityPda,
} from '../clients/typescript/src/index.js';

type ConfigKey = 'rpc' | 'keypair';

interface GradienceConfig {
    rpc?: string;
    keypair?: string;
    updatedAt?: string;
}

type TaskCommand = 'post' | 'apply' | 'submit' | 'status' | 'judge' | 'cancel' | 'refund';
type JudgeCommand = 'register' | 'unstake';
type InstructionLike = Instruction & { accounts: readonly AccountMeta[] };

interface CliErrorLike {
    code: string;
    message: string;
}

class CliError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

async function main(): Promise<number> {
    const args = process.argv.slice(2);
    const noDna = isNoDnaMode(process.env);
    try {
        if (shouldShowHelp(args)) {
            printHelp(noDna);
            return 0;
        }

        if (args[0] === 'config' && args[1] === 'set') {
            const key = args[2];
            const value = args[3];
            if (!key || !value || !isSupportedConfigKey(key) || args.length !== 4) {
                throw new CliError('INVALID_ARGUMENT', 'Usage: gradience config set <rpc|keypair> <value>');
            }
            const configPath = await updateConfig(key, value, process.env);
            if (noDna) {
                printJson({
                    ok: true,
                    timestamp: new Date().toISOString(),
                    path: configPath,
                    updated: { [key]: value },
                });
            } else {
                process.stdout.write(`Updated ${key} in ${configPath}\n`);
            }
            return 0;
        }

        if (args[0] === 'task') {
            await handleTaskCommand(args.slice(1), process.env, noDna);
            return 0;
        }

        if (args[0] === 'judge') {
            await handleJudgeCommand(args.slice(1), process.env, noDna);
            return 0;
        }

        throw new CliError('UNKNOWN_COMMAND', `Unknown command: ${args.join(' ') || '(empty)'}. Use --help for usage.`);
    } catch (error) {
        const normalized = normalizeError(error);
        if (noDna) {
            process.stderr.write(
                `${JSON.stringify({
                    ok: false,
                    timestamp: new Date().toISOString(),
                    error: normalized,
                })}\n`,
            );
        } else {
            process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
        }
        return 1;
    }
}

function shouldShowHelp(args: string[]): boolean {
    return args.length === 0 || args.includes('--help') || args.includes('-h');
}

function isNoDnaMode(env: NodeJS.ProcessEnv): boolean {
    const value = env.NO_DNA;
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

function printHelp(noDna: boolean): void {
    if (noDna) {
        printJson({
            schemaVersion: '1.0.0',
            name: 'gradience',
            mode: 'NO_DNA',
            timestamp: new Date().toISOString(),
            commands: [
                {
                    command: 'config set rpc <url>',
                    description: 'Set RPC endpoint URL in ~/.gradience/config.json',
                },
                {
                    command: 'config set keypair <path>',
                    description: 'Set keypair path in ~/.gradience/config.json',
                },
                {
                    command:
                        'task post --task-id <id> --eval-ref <cid> --reward <lamports> [--category <n>] [--min-stake <lamports>]',
                    description: 'Create a task on-chain',
                },
                {
                    command: 'task apply --task-id <id>',
                    description: 'Apply for a task on-chain',
                },
                {
                    command: 'task submit --task-id <id> --result-ref <cid> --trace-ref <cid>',
                    description: 'Submit task result on-chain',
                },
                {
                    command: 'task status <task_id>',
                    description: 'Fetch task state from indexer',
                },
                {
                    command:
                        'task judge --task-id <id> --winner <agent> --poster <poster> --score <0-10000> --reason-ref <cid>',
                    description: 'Judge task and settle payouts',
                },
                {
                    command: 'task cancel --task-id <id>',
                    description: 'Cancel a task',
                },
                {
                    command: 'task refund --task-id <id> [--poster <address>]',
                    description: 'Refund expired task',
                },
                {
                    command: 'judge register --category <name|id[,name|id...]> [--stake-amount <lamports>]',
                    description: 'Register judge stake and judge pools',
                },
                {
                    command: 'judge unstake',
                    description: 'Unstake judge and leave judge pools',
                },
            ],
        });
        return;
    }

    process.stdout.write(
        [
            'gradience - Gradience CLI',
            '',
            'Usage:',
            '  gradience config set rpc <url>',
            '  gradience config set keypair <path>',
            '  gradience task post --task-id <id> --eval-ref <cid> --reward <lamports>',
            '  gradience task apply --task-id <id>',
            '  gradience task submit --task-id <id> --result-ref <cid> --trace-ref <cid>',
            '  gradience task status <task_id>',
            '  gradience task judge --task-id <id> --winner <agent> --poster <poster> --score <0-10000> --reason-ref <cid>',
            '  gradience task cancel --task-id <id>',
            '  gradience task refund --task-id <id> [--poster <address>]',
            '  gradience judge register --category <name|id[,name|id...]> [--stake-amount <lamports>]',
            '  gradience judge unstake',
            '  gradience --help',
            '',
            'Commands:',
            '  config set rpc <url>       Set RPC endpoint',
            '  config set keypair <path>  Set keypair file path',
            '  task post                  Create a task',
            '  task apply                 Apply for task',
            '  task submit                Submit task result',
            '  task status                Query task status',
            '  task judge                 Judge and settle task',
            '  task cancel                Cancel task',
            '  task refund                Refund expired task',
            '  judge register             Register as judge',
            '  judge unstake              Unstake judge',
        ].join('\n') + '\n',
    );
}

function printJson(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function handleTaskCommand(taskArgs: string[], env: NodeJS.ProcessEnv, noDna: boolean): Promise<void> {
    const command = taskArgs[0];
    if (!command || !isTaskCommand(command)) {
        throw new CliError('INVALID_ARGUMENT', 'Usage: gradience task <post|apply|submit|status> ...');
    }

    if (command === 'status') {
        const taskId = parseU64(taskArgs[1], 'task_id');
        if (isMockTaskMode(env)) {
            emitStatus(
                Number(taskId),
                env.GRADIENCE_CLI_MOCK_STATE ?? 'Open',
                parseU64(env.GRADIENCE_CLI_MOCK_SUBMISSION_COUNT ?? '0', 'submissionCount'),
                noDna,
            );
            return;
        }

        const sdk = createSdk(env);
        const task = await sdk.getTask(Number(taskId));
        if (!task) {
            throw new CliError('NOT_FOUND', `Task ${taskId.toString()} not found`);
        }
        emitStatus(Number(taskId), toCliTaskState(task.state), BigInt(task.submission_count), noDna);
        return;
    }

    const flags = parseFlags(taskArgs.slice(1));
    const taskId = parseU64(flags.get('task-id'), 'task-id');

    if (isMockTaskMode(env)) {
        const signature = env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-${command}-signature`;
        if (command === 'judge') {
            emitJudgeSignature(
                signature,
                Number(taskId),
                requiredFlag(flags, 'winner'),
                Number(parseU64(flags.get('score'), 'score')),
                noDna,
            );
            return;
        }
        emitTaskSignature(command, signature, Number(taskId), noDna);
        return;
    }

    const config = await loadConfig(env);
    if (!config.rpc) {
        throw new CliError(
            'CONFIG_MISSING',
            'Missing rpc in ~/.gradience/config.json. Run: gradience config set rpc <url>',
        );
    }
    if (!config.keypair) {
        throw new CliError(
            'CONFIG_MISSING',
            'Missing keypair in ~/.gradience/config.json. Run: gradience config set keypair <path>',
        );
    }

    const sdk = createSdk(env);
    const wallet = await createKeypairAdapter(config.rpc, config.keypair);

    if (command === 'post') {
        const evalRef = requiredFlag(flags, 'eval-ref');
        const reward = parseU64(flags.get('reward'), 'reward');
        const category = Number(parseU64(flags.get('category') ?? '0', 'category'));
        const minStake = parseU64(flags.get('min-stake') ?? '0', 'min-stake');
        const judgeModeRaw = (flags.get('judge-mode') ?? 'pool').toLowerCase();
        if (judgeModeRaw !== 'pool' && judgeModeRaw !== 'designated') {
            throw new CliError('INVALID_ARGUMENT', '--judge-mode must be "pool" or "designated"');
        }
        const judge =
            judgeModeRaw === 'designated'
                ? parseAddress(requiredFlag(flags, 'judge'), 'judge')
                : flags.get('judge')
                  ? parseAddress(flags.get('judge'), 'judge')
                  : undefined;
        const now = BigInt(Math.floor(Date.now() / 1000));
        const deadline = parseU64(flags.get('deadline') ?? (now + 86_400n).toString(), 'deadline');
        const judgeDeadline = parseU64(
            flags.get('judge-deadline') ?? (deadline + 86_400n).toString(),
            'judge-deadline',
        );
        const mint = flags.get('mint') ? parseAddress(flags.get('mint'), 'mint') : undefined;

        const signature = await sdk.task.post(wallet, {
            taskId,
            evalRef,
            reward,
            category,
            minStake,
            judgeMode: judgeModeRaw === 'designated' ? 0 : 1,
            judge,
            deadline,
            judgeDeadline,
            mint,
        });
        emitTaskSignature(command, signature, Number(taskId), noDna);
        return;
    }

    if (command === 'apply') {
        const mint = flags.get('mint') ? parseAddress(flags.get('mint'), 'mint') : undefined;
        const signature = await sdk.task.apply(wallet, {
            taskId,
            mint,
        });
        emitTaskSignature(command, signature, Number(taskId), noDna);
        return;
    }

    if (command === 'judge') {
        const winner = parseAddress(requiredFlag(flags, 'winner'), 'winner');
        const poster = parseAddress(requiredFlag(flags, 'poster'), 'poster');
        const scoreBig = parseU64(flags.get('score'), 'score');
        if (scoreBig > 10_000n) {
            throw new CliError('INVALID_ARGUMENT', 'score must be <= 10000');
        }
        const reasonRef = requiredFlag(flags, 'reason-ref');
        const signature = await sdk.task.judge(wallet, {
            taskId,
            winner,
            poster,
            score: Number(scoreBig),
            reasonRef,
        });
        emitJudgeSignature(signature, Number(taskId), winner, Number(scoreBig), noDna);
        return;
    }

    if (command === 'cancel') {
        const signature = await sdk.task.cancel(wallet, { taskId });
        emitTaskSignature(command, signature, Number(taskId), noDna);
        return;
    }

    if (command === 'refund') {
        const poster =
            flags.get('poster') !== undefined
                ? parseAddress(flags.get('poster'), 'poster')
                : await fetchPosterAddress(sdk, Number(taskId));
        const signature = await sdk.task.refund(wallet, {
            taskId,
            poster,
        });
        emitTaskSignature(command, signature, Number(taskId), noDna);
        return;
    }

    const resultRef = requiredFlag(flags, 'result-ref');
    const traceRef = requiredFlag(flags, 'trace-ref');
    const runtimeProvider = flags.get('runtime-provider') ?? 'openai';
    const runtimeModel = flags.get('runtime-model') ?? 'gpt-4';
    const runtimeRuntime = flags.get('runtime-runtime') ?? 'node';
    const runtimeVersion = flags.get('runtime-version') ?? '20';
    const signature = await sdk.task.submit(wallet, {
        taskId,
        resultRef,
        traceRef,
        runtimeEnv: {
            provider: runtimeProvider,
            model: runtimeModel,
            runtime: runtimeRuntime,
            version: runtimeVersion,
        },
    });
    emitTaskSignature(command, signature, Number(taskId), noDna);
}

function emitTaskSignature(
    command: Exclude<TaskCommand, 'status'>,
    signature: string,
    taskId: number,
    noDna: boolean,
): void {
    if (noDna) {
        printJson({ signature, taskId });
        return;
    }
    process.stdout.write(`${command} ok: signature=${signature} taskId=${taskId}\n`);
}

function emitStatus(taskId: number, state: string, submissionCount: bigint, noDna: boolean): void {
    if (noDna) {
        printJson({
            taskId,
            state,
            submissionCount: Number(submissionCount),
        });
        return;
    }
    process.stdout.write(`task ${taskId}: state=${state}, submissionCount=${submissionCount.toString()}\n`);
}

function emitJudgeSignature(signature: string, taskId: number, winner: string, score: number, noDna: boolean): void {
    if (noDna) {
        printJson({ signature, taskId, winner, score });
        return;
    }
    process.stdout.write(`judge ok: signature=${signature} taskId=${taskId} winner=${winner} score=${score}\n`);
}

async function handleJudgeCommand(judgeArgs: string[], env: NodeJS.ProcessEnv, noDna: boolean): Promise<void> {
    const command = judgeArgs[0];
    if (!command || !isJudgeCommand(command)) {
        throw new CliError('INVALID_ARGUMENT', 'Usage: gradience judge <register|unstake> ...');
    }

    if (isMockTaskMode(env)) {
        const signature = env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-judge-${command}-signature`;
        if (noDna) {
            printJson({ signature, command });
        } else {
            process.stdout.write(`${command} ok: signature=${signature}\n`);
        }
        return;
    }

    const config = await loadConfig(env);
    if (!config.rpc) {
        throw new CliError(
            'CONFIG_MISSING',
            'Missing rpc in ~/.gradience/config.json. Run: gradience config set rpc <url>',
        );
    }
    if (!config.keypair) {
        throw new CliError(
            'CONFIG_MISSING',
            'Missing keypair in ~/.gradience/config.json. Run: gradience config set keypair <path>',
        );
    }

    const flags = parseFlags(judgeArgs.slice(1));
    const sdk = createSdk(env);
    const wallet = await createKeypairAdapter(config.rpc, config.keypair);
    const eventAuthority = await findEventAuthorityPda();

    if (command === 'register') {
        const categories = parseCategories(requiredFlag(flags, 'category'));
        const [configPda] = await findConfigPda();
        const [stakePda] = await findStakePda(wallet.signer.address);
        const [reputationPda] = await findReputationPda(wallet.signer.address);
        const stakeAmount =
            flags.get('stake-amount') !== undefined
                ? parseU64(flags.get('stake-amount'), 'stake-amount')
                : await fetchMinJudgeStake(config.rpc, configPda);

        const instruction = await sdk.instructions.registerJudge(
            {
                judge: wallet.signer,
                config: configPda,
                stake: stakePda,
                reputation: reputationPda,
                eventAuthority,
                gradienceProgram: GRADIENCE_PROGRAM_ADDRESS,
                categories,
                stakeAmount,
            },
            { programAddress: GRADIENCE_PROGRAM_ADDRESS },
        );

        const poolMetas = await Promise.all(
            categories.map(async category => {
                const [pool] = await findJudgePoolPda(category);
                return { address: pool, role: AccountRole.WRITABLE } as AccountMeta;
            }),
        );

        const signature = await wallet.signAndSendTransaction([appendRemainingAccounts(instruction, poolMetas)]);
        if (noDna) {
            printJson({ signature, categories, stakeAmount: Number(stakeAmount) });
        } else {
            process.stdout.write(`judge register ok: signature=${signature} categories=${categories.join(',')}\n`);
        }
        return;
    }

    const [stakePda] = await findStakePda(wallet.signer.address);
    const categories = await fetchStakeCategories(config.rpc, stakePda);
    const instruction = await sdk.instructions.unstakeJudge(
        {
            judge: wallet.signer,
            stake: stakePda,
            eventAuthority,
            gradienceProgram: GRADIENCE_PROGRAM_ADDRESS,
        },
        { programAddress: GRADIENCE_PROGRAM_ADDRESS },
    );
    const poolMetas = await Promise.all(
        categories.map(async category => {
            const [pool] = await findJudgePoolPda(category);
            return { address: pool, role: AccountRole.WRITABLE } as AccountMeta;
        }),
    );
    const signature = await wallet.signAndSendTransaction([appendRemainingAccounts(instruction, poolMetas)]);
    if (noDna) {
        printJson({ signature, categories });
    } else {
        process.stdout.write(`judge unstake ok: signature=${signature}\n`);
    }
}

function normalizeError(error: unknown): CliErrorLike {
    if (error instanceof CliError) {
        return { code: error.code, message: error.message };
    }
    if (error instanceof Error) {
        return { code: 'INTERNAL_ERROR', message: error.message };
    }
    return { code: 'INTERNAL_ERROR', message: String(error) };
}

function createSdk(env: NodeJS.ProcessEnv): GradienceSDK {
    return new GradienceSDK({
        indexerEndpoint: env.GRADIENCE_INDEXER_ENDPOINT,
    });
}

function createRpcClient(rpcEndpoint: string) {
    return createSolanaRpc(rpcEndpoint as Parameters<typeof createSolanaRpc>[0]);
}

async function createKeypairAdapter(rpcEndpoint: string, keypairPath: string): Promise<KeypairAdapter> {
    const signer = await loadKeypairSigner(keypairPath);
    return new KeypairAdapter({
        signer,
        rpcEndpoint,
    });
}

async function loadKeypairSigner(keypairPath: string) {
    let raw: string;
    try {
        raw = await readFile(keypairPath, 'utf8');
    } catch {
        throw new CliError('CONFIG_MISSING', `Unable to read keypair file: ${keypairPath}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid keypair json: ${keypairPath}`);
    }
    if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some(value => !isByte(value))) {
        throw new CliError('INVALID_ARGUMENT', 'Keypair file must be a 64-element array of byte values');
    }

    const bytes = Uint8Array.from(parsed as number[]);
    return createKeyPairSignerFromBytes(bytes);
}

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function parseFlags(tokens: string[]): Map<string, string> {
    const flags = new Map<string, string>();
    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (!token || !token.startsWith('--')) {
            throw new CliError('INVALID_ARGUMENT', `Expected flag token, got "${token ?? ''}"`);
        }
        const key = token.slice(2);
        const value = tokens[i + 1];
        if (!value || value.startsWith('--')) {
            throw new CliError('INVALID_ARGUMENT', `Missing value for --${key}`);
        }
        flags.set(key, value);
        i += 1;
    }
    return flags;
}

function requiredFlag(flags: Map<string, string>, key: string): string {
    const value = flags.get(key);
    if (!value) {
        throw new CliError('INVALID_ARGUMENT', `Missing required flag: --${key}`);
    }
    return value;
}

function parseU64(value: string | undefined, name: string): bigint {
    if (!value) {
        throw new CliError('INVALID_ARGUMENT', `Missing required value: ${name}`);
    }
    let parsed: bigint;
    try {
        parsed = BigInt(value);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid integer for ${name}: ${value}`);
    }
    if (parsed < 0n) {
        throw new CliError('INVALID_ARGUMENT', `${name} must be non-negative`);
    }
    return parsed;
}

function parseAddress(value: string | undefined, name: string): Address {
    if (!value) {
        throw new CliError('INVALID_ARGUMENT', `Missing address value for ${name}`);
    }
    try {
        return address(value);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid address for ${name}: ${value}`);
    }
}

function toCliTaskState(value: string): string {
    if (value === 'open') {
        return 'Open';
    }
    if (value === 'completed') {
        return 'Completed';
    }
    if (value === 'refunded') {
        return 'Refunded';
    }
    return value;
}

function isTaskCommand(value: string): value is TaskCommand {
    return (
        value === 'post' ||
        value === 'apply' ||
        value === 'submit' ||
        value === 'status' ||
        value === 'judge' ||
        value === 'cancel' ||
        value === 'refund'
    );
}

function isJudgeCommand(value: string): value is JudgeCommand {
    return value === 'register' || value === 'unstake';
}

function isMockTaskMode(env: NodeJS.ProcessEnv): boolean {
    const value = env.GRADIENCE_CLI_MOCK;
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

function isSupportedConfigKey(value: string): value is ConfigKey {
    return value === 'rpc' || value === 'keypair';
}

async function updateConfig(key: ConfigKey, rawValue: string, env: NodeJS.ProcessEnv): Promise<string> {
    const home = env.HOME || homedir();
    const configDir = path.join(home, '.gradience');
    const configPath = path.join(configDir, 'config.json');

    const value = key === 'rpc' ? validateRpcUrl(rawValue) : normalizePath(rawValue, home);
    const existing = await readConfig(configPath);
    const next: GradienceConfig = {
        ...existing,
        [key]: value,
        updatedAt: new Date().toISOString(),
    };

    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return configPath;
}

async function readConfig(configPath: string): Promise<GradienceConfig> {
    try {
        const raw = await readFile(configPath, 'utf8');
        return JSON.parse(raw) as GradienceConfig;
    } catch {
        return {};
    }
}

async function loadConfig(env: NodeJS.ProcessEnv): Promise<GradienceConfig> {
    const home = env.HOME || homedir();
    const configPath = path.join(home, '.gradience', 'config.json');
    return readConfig(configPath);
}

async function fetchPosterAddress(sdk: GradienceSDK, taskId: number): Promise<Address> {
    const task = await sdk.getTask(taskId);
    if (!task) {
        throw new CliError('NOT_FOUND', `Task ${taskId} not found`);
    }
    return parseAddress(task.poster, 'poster');
}

async function findConfigPda(): Promise<readonly [Address, number]> {
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('config')],
    });
}

async function findStakePda(judge: Address): Promise<readonly [Address, number]> {
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('stake'), getAddressEncoder().encode(judge)],
    });
}

async function findReputationPda(agent: Address): Promise<readonly [Address, number]> {
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('reputation'), getAddressEncoder().encode(agent)],
    });
}

async function findJudgePoolPda(category: number): Promise<readonly [Address, number]> {
    return getProgramDerivedAddress({
        programAddress: GRADIENCE_PROGRAM_ADDRESS,
        seeds: [TEXT_ENCODER.encode('judge_pool'), Uint8Array.of(category)],
    });
}

async function fetchMinJudgeStake(rpcEndpoint: string, configPda: Address): Promise<bigint> {
    const rpc = createRpcClient(rpcEndpoint);
    const maybeAccount = await fetchEncodedAccount(rpc, configPda);
    if (!maybeAccount.exists) {
        throw new CliError('NOT_FOUND', 'Program config account not found');
    }
    const reader = new ByteReader(maybeAccount.data);
    const discriminator = reader.readU8();
    if (discriminator !== PROGRAM_CONFIG_DISCRIMINATOR) {
        throw new CliError('INVALID_ARGUMENT', 'Invalid program config account');
    }
    reader.readU8(); // version
    reader.skip(32); // treasury
    reader.skip(32); // upgrade_authority
    return reader.readU64();
}

async function fetchStakeCategories(rpcEndpoint: string, stakePda: Address): Promise<number[]> {
    const rpc = createRpcClient(rpcEndpoint);
    const maybeAccount = await fetchEncodedAccount(rpc, stakePda);
    if (!maybeAccount.exists) {
        throw new CliError('NOT_FOUND', 'Stake account not found');
    }
    const reader = new ByteReader(maybeAccount.data);
    const discriminator = reader.readU8();
    if (discriminator !== STAKE_DISCRIMINATOR) {
        throw new CliError('INVALID_ARGUMENT', 'Invalid stake account');
    }
    reader.readU8(); // version
    reader.skip(32); // judge
    reader.skip(8); // amount
    const categories = reader.readFixedArray(MAX_CATEGORIES);
    const categoryCount = reader.readU8();
    if (categoryCount > MAX_CATEGORIES) {
        throw new CliError('INVALID_ARGUMENT', 'Stake account category_count exceeds max categories');
    }
    return Array.from(categories.slice(0, categoryCount));
}

function parseCategories(raw: string): number[] {
    const chunks = raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    if (chunks.length === 0) {
        throw new CliError('INVALID_ARGUMENT', 'At least one category is required');
    }
    const categories = chunks.map(item => {
        const lower = item.toLowerCase();
        if (CATEGORY_NAME_TO_ID.has(lower)) {
            return CATEGORY_NAME_TO_ID.get(lower)!;
        }
        const numeric = Number(item);
        if (!Number.isInteger(numeric) || numeric < 0 || numeric >= MAX_CATEGORIES) {
            throw new CliError(
                'INVALID_ARGUMENT',
                `Invalid category "${item}". Use 0-7 or names: ${[...CATEGORY_NAME_TO_ID.keys()].join(', ')}`,
            );
        }
        return numeric;
    });
    const unique = [...new Set(categories)];
    if (unique.length !== categories.length) {
        throw new CliError('INVALID_ARGUMENT', 'Duplicate categories are not allowed');
    }
    return unique;
}

function appendRemainingAccounts(instruction: InstructionLike, remaining: AccountMeta[]): InstructionLike {
    return {
        ...instruction,
        accounts: [...instruction.accounts, ...remaining],
    };
}

function validateRpcUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid RPC URL: ${value}`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new CliError('INVALID_ARGUMENT', 'RPC URL must start with http:// or https://');
    }
    return url.toString();
}

function normalizePath(value: string, home: string): string {
    if (value.startsWith('~/')) {
        return path.join(home, value.slice(2));
    }
    return path.resolve(value);
}

const TEXT_ENCODER = new TextEncoder();
const MAX_CATEGORIES = 8;
const STAKE_DISCRIMINATOR = 0x06;
const PROGRAM_CONFIG_DISCRIMINATOR = 0x09;
const CATEGORY_NAME_TO_ID = new Map<string, number>([
    ['general', 0],
    ['defi', 1],
    ['code', 2],
    ['research', 3],
    ['creative', 4],
    ['data', 5],
    ['compute', 6],
    ['gov', 7],
]);

class ByteReader {
    private readonly view: DataView;
    private offset = 0;

    constructor(private readonly data: Uint8Array) {
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    readU8(): number {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readU64(): bigint {
        const value = this.view.getBigUint64(this.offset, true);
        this.offset += 8;
        return value;
    }

    skip(count: number): void {
        this.offset += count;
    }

    readFixedArray(size: number): Uint8Array {
        const start = this.offset;
        this.offset += size;
        return this.data.slice(start, this.offset);
    }
}

void main().then(exitCode => {
    process.exitCode = exitCode;
});
