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
} from '@gradiences/arena-sdk';

import {
    type TaskCommand,
    type CliErrorLike,
    type GradienceConfig,
    type InstructionLike,
    CliError,
    TEXT_ENCODER,
    MAX_CATEGORIES,
    STAKE_DISCRIMINATOR,
    PROGRAM_CONFIG_DISCRIMINATOR,
    CATEGORY_NAME_TO_ID,
    isMockTaskMode,
    isTaskCommand,
    parseFlags,
    requiredFlag,
    parseU64,
    parseAddress,
    toCliTaskState,
    loadConfig,
    createSdk,
    fetchPosterAddress,
    findConfigPda,
    findStakePda,
    findReputationPda,
    findJudgePoolPda,
    fetchMinJudgeStake,
    fetchStakeCategories,
    parseCategories,
    appendRemainingAccounts,
    printJson,
    ByteReader,
} from '../types.js';

export async function handleTaskCommand(
    taskArgs: string[],
    env: NodeJS.ProcessEnv,
    noDna: boolean,
): Promise<void> {
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
        if (scoreBig > 100n) {
            throw new CliError('INVALID_ARGUMENT', 'score must be <= 100 (u8 on-chain, MIN_SCORE=60 for valid completion)');
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

export function emitTaskSignature(
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

export function emitStatus(taskId: number, state: string, submissionCount: bigint, noDna: boolean): void {
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

export function emitJudgeSignature(signature: string, taskId: number, winner: string, score: number, noDna: boolean): void {
    if (noDna) {
        printJson({ signature, taskId, winner, score });
        return;
    }
    process.stdout.write(`judge ok: signature=${signature} taskId=${taskId} winner=${winner} score=${score}\n`);
}

async function createKeypairAdapter(rpcEndpoint: string, keypairPath: string): Promise<KeypairAdapter> {
    const signer = await loadKeypairSigner(keypairPath);
    return new KeypairAdapter({
        signer,
        rpcEndpoint,
    });
}

async function loadKeypairSigner(keypairPath: string) {
    const { readFile } = await import('node:fs/promises');
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
    if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((value: unknown) => !isByte(value))) {
        throw new CliError('INVALID_ARGUMENT', 'Keypair file must be a 64-element array of byte values');
    }

    const bytes = Uint8Array.from(parsed as number[]);
    return createKeyPairSignerFromBytes(bytes);
}

function isByte(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}
