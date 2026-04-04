#!/usr/bin/env node

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
} from '@gradiences/arena-sdk';

type ConfigKey = 'rpc' | 'keypair';

interface GradienceConfig {
    rpc?: string;
    keypair?: string;
    updatedAt?: string;
}

type TaskCommand = 'post' | 'apply' | 'submit' | 'status' | 'judge' | 'cancel' | 'refund';
type JudgeCommand = 'register' | 'unstake';
type ProfileCommand = 'show' | 'update' | 'publish';
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

        if (args[0] === 'profile') {
            await handleProfileCommand(args.slice(1), process.env, noDna);
            return 0;
        }

        if (args[0] === 'create-agent') {
            await handleCreateAgent(args.slice(1), noDna);
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
                        'task judge --task-id <id> --winner <agent> --poster <poster> --score <0-100> --reason-ref <cid>',
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
                {
                    command: 'profile show [--agent <address>]',
                    description: 'Show agent profile from AgentM API',
                },
                {
                    command:
                        'profile update [--agent <address>] [--display-name <name>] [--bio <text>] [--website <url>] [--github <url>] [--x <url>] [--publish-mode <manual|git-sync>]',
                    description: 'Update agent profile via AgentM API',
                },
                {
                    command: 'profile publish [--agent <address>] [--mode <manual|git-sync>] [--content-ref <cid-or-hash>]',
                    description: 'Publish profile on-chain reference via AgentM API',
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
            '  gradience task judge --task-id <id> --winner <agent> --poster <poster> --score <0-100> --reason-ref <cid>',
            '  gradience task cancel --task-id <id>',
            '  gradience task refund --task-id <id> [--poster <address>]',
            '  gradience judge register --category <name|id[,name|id...]> [--stake-amount <lamports>]',
            '  gradience judge unstake',
            '  gradience profile show [--agent <address>]',
            '  gradience profile update [--agent <address>] [--display-name <name>] [--bio <text>] [--website <url>] [--github <url>] [--x <url>] [--publish-mode <manual|git-sync>]',
            '  gradience profile publish [--agent <address>] [--mode <manual|git-sync>] [--content-ref <cid-or-hash>]',
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
            '  profile show               Show agent profile',
            '  profile update             Update agent profile',
            '  profile publish            Publish profile on-chain reference',
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

interface AgentProfileApiResponse {
    agent: string;
    display_name: string;
    bio: string;
    links: {
        website?: string;
        github?: string;
        x?: string;
    };
    onchain_ref: string | null;
    publish_mode: 'manual' | 'git-sync';
    updated_at: number;
}

async function handleProfileCommand(
    profileArgs: string[],
    env: NodeJS.ProcessEnv,
    noDna: boolean,
): Promise<void> {
    const command = profileArgs[0];
    if (!command || !isProfileCommand(command)) {
        throw new CliError('INVALID_ARGUMENT', 'Usage: gradience profile <show|update|publish> ...');
    }

    const flags = parseFlags(profileArgs.slice(1));
    const apiBaseUrl = resolveAgentmApiBaseUrl(env);
    const agentOverride = flags.get('agent');

    if (isMockTaskMode(env)) {
        emitMockProfileCommand(command, agentOverride, flags, noDna);
        return;
    }

    if (command === 'show') {
        const agent = agentOverride ?? (await resolveLocalAgentAddress(env));
        const profile = await getRemoteProfile(apiBaseUrl, agent, env);
        emitProfileShowResult(agent, profile, noDna);
        return;
    }

    const localAgent = await resolveLocalAgentAddress(env);
    if (agentOverride && agentOverride !== localAgent) {
        throw new CliError('INVALID_ARGUMENT', '--agent must match local keypair public key for profile mutations');
    }
    await ensureAgentmDemoSession(apiBaseUrl, localAgent, env);

    if (command === 'update') {
        const existing = await getRemoteProfile(apiBaseUrl, localAgent, env);
        const displayName = flags.get('display-name') ?? flags.get('name') ?? existing?.display_name ?? '';
        const bio = flags.get('bio') ?? existing?.bio ?? '';
        if (!displayName.trim()) {
            throw new CliError('INVALID_ARGUMENT', 'Missing required profile field: --display-name');
        }
        if (!bio.trim()) {
            throw new CliError('INVALID_ARGUMENT', 'Missing required profile field: --bio');
        }
        const publishMode = parseProfilePublishMode(flags.get('publish-mode') ?? existing?.publish_mode ?? undefined);
        const links = {
            website: flags.get('website') ?? existing?.links?.website,
            github: flags.get('github') ?? existing?.links?.github,
            x: flags.get('x') ?? existing?.links?.x,
        };

        const updated = await requestAgentmApiJson<{ profile: AgentProfileApiResponse }>(
            apiBaseUrl,
            `/api/agents/${encodeURIComponent(localAgent)}/profile`,
            env,
            {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    display_name: displayName,
                    bio,
                    links,
                    publish_mode: publishMode,
                }),
            },
        );
        if (noDna) {
            printJson({ ok: true, profile: updated.profile });
        } else {
            process.stdout.write(`profile update ok: agent=${updated.profile.agent}\n`);
        }
        return;
    }

    const mode = parseProfilePublishMode(flags.get('mode') ?? flags.get('publish-mode') ?? undefined);
    const contentRef = flags.get('content-ref');
    const published = await requestAgentmApiJson<{
        ok: boolean;
        onchain_tx: string;
        profile: AgentProfileApiResponse;
    }>(
        apiBaseUrl,
        `/api/agents/${encodeURIComponent(localAgent)}/profile/publish`,
        env,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                publish_mode: mode,
                content_ref: contentRef,
            }),
        },
    );
    if (noDna) {
        printJson(published);
    } else {
        process.stdout.write(
            `profile publish ok: tx=${published.onchain_tx} onchain_ref=${published.profile.onchain_ref ?? 'null'}\n`,
        );
    }
}

function emitMockProfileCommand(
    command: ProfileCommand,
    agentOverride: string | undefined,
    flags: Map<string, string>,
    noDna: boolean,
): void {
    const agent = agentOverride ?? 'mock-agent';
    const profile = {
        agent,
        display_name: flags.get('display-name') ?? flags.get('name') ?? 'Mock Agent',
        bio: flags.get('bio') ?? 'Mock profile bio',
        links: {
            ...(flags.get('website') ? { website: flags.get('website') } : {}),
            ...(flags.get('github') ? { github: flags.get('github') } : {}),
            ...(flags.get('x') ? { x: flags.get('x') } : {}),
        },
        onchain_ref: flags.get('content-ref') ?? null,
        publish_mode: parseProfilePublishMode(flags.get('mode') ?? flags.get('publish-mode') ?? undefined),
        updated_at: Date.now(),
    };

    if (command === 'show') {
        emitProfileShowResult(agent, profile, noDna);
        return;
    }
    if (command === 'update') {
        if (noDna) {
            printJson({ ok: true, profile });
        } else {
            process.stdout.write(`profile update ok: agent=${agent}\n`);
        }
        return;
    }
    const payload = {
        ok: true,
        onchain_tx: 'mock-profile-publish-signature',
        profile,
    };
    if (noDna) {
        printJson(payload);
    } else {
        process.stdout.write(`profile publish ok: tx=${payload.onchain_tx}\n`);
    }
}

function emitProfileShowResult(agent: string, profile: AgentProfileApiResponse | null, noDna: boolean): void {
    if (noDna) {
        printJson({ agent, profile });
        return;
    }
    if (!profile) {
        process.stdout.write(`profile not found: agent=${agent}\n`);
        return;
    }
    process.stdout.write(
        [
            `agent: ${profile.agent}`,
            `display_name: ${profile.display_name}`,
            `bio: ${profile.bio}`,
            `publish_mode: ${profile.publish_mode}`,
            `onchain_ref: ${profile.onchain_ref ?? 'null'}`,
        ].join('\n') + '\n',
    );
}

function parseProfilePublishMode(value: string | undefined): 'manual' | 'git-sync' {
    if (!value || value.length === 0) {
        return 'manual';
    }
    if (value === 'manual' || value === 'git-sync') {
        return value;
    }
    throw new CliError('INVALID_ARGUMENT', 'publish mode must be manual or git-sync');
}

function resolveAgentmApiBaseUrl(env: NodeJS.ProcessEnv): string {
    const raw = env.GRADIENCE_AGENTM_API_ENDPOINT ?? 'http://127.0.0.1:3939';
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid AgentM API endpoint: ${raw}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new CliError('INVALID_ARGUMENT', 'AgentM API endpoint must use http:// or https://');
    }
    return parsed.toString().replace(/\/$/, '');
}

async function resolveLocalAgentAddress(env: NodeJS.ProcessEnv): Promise<Address> {
    const config = await loadConfig(env);
    if (!config.keypair) {
        throw new CliError(
            'CONFIG_MISSING',
            'Missing keypair in ~/.gradience/config.json. Run: gradience config set keypair <path>',
        );
    }
    const signer = await loadKeypairSigner(config.keypair);
    return signer.address;
}

async function getRemoteProfile(
    apiBaseUrl: string,
    agent: string,
    env: NodeJS.ProcessEnv,
): Promise<AgentProfileApiResponse | null> {
    const response = await requestAgentmApiJson<{ profile: AgentProfileApiResponse | null }>(
        apiBaseUrl,
        `/api/agents/${encodeURIComponent(agent)}/profile`,
        env,
    );
    return response.profile ?? null;
}

async function ensureAgentmDemoSession(
    apiBaseUrl: string,
    agent: string,
    env: NodeJS.ProcessEnv,
): Promise<void> {
    if (env.GRADIENCE_AGENTM_DEMO_LOGIN === '0') {
        return;
    }
    const privyUserId = env.GRADIENCE_AGENTM_PRIVY_USER_ID ?? `cli-${agent.slice(0, 16)}`;
    await requestAgentmApiJson(
        apiBaseUrl,
        '/auth/demo-login',
        env,
        {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                publicKey: agent,
                email: `${agent.slice(0, 8)}@agentm.local`,
                privyUserId,
            }),
        },
    );
}

async function requestAgentmApiJson<T>(
    apiBaseUrl: string,
    path: string,
    env: NodeJS.ProcessEnv,
    init?: RequestInit,
): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            ...init,
            signal: AbortSignal.timeout(5000),
        });
    } catch (error) {
        throw new CliError('NETWORK_ERROR', `AgentM API unreachable: ${asErrorMessage(error)}`);
    }

    if (!response.ok) {
        const body = await response.text();
        const message = extractApiErrorMessage(body) ?? body ?? response.statusText;
        throw new CliError('API_ERROR', `AgentM API ${response.status}: ${message}`);
    }
    return (await response.json()) as T;
}

function extractApiErrorMessage(body: string): string | null {
    if (!body) {
        return null;
    }
    try {
        const parsed = JSON.parse(body) as { error?: unknown };
        if (typeof parsed.error === 'string') {
            return parsed.error;
        }
    } catch {
        return null;
    }
    return null;
}

function asErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
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

function isProfileCommand(value: string): value is ProfileCommand {
    return value === 'show' || value === 'update' || value === 'publish';
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

// ── create-agent ────────────────────────────────────────────────────

async function handleCreateAgent(args: string[], noDna: boolean): Promise<void> {
    const name = args[0] || 'my-agent';
    const template = parseFlag(args, '--template') || 'basic';

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        throw new CliError('INVALID_NAME', 'Agent name must start with a letter and contain only letters, numbers, hyphens, dashes.');
    }

    const targetDir = path.resolve(process.cwd(), name);

    try {
        await mkdir(targetDir, { recursive: true });
    } catch {
        throw new CliError('DIR_ERROR', `Cannot create directory: ${targetDir}`);
    }

    const packageJson = JSON.stringify({
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            start: 'tsx agent.ts',
            dev: 'tsx --watch agent.ts',
        },
        dependencies: {
            '@gradiences/sdk': '^0.1.0',
            '@solana/kit': '^5.5.0',
            tsx: '^4.20.0',
            typescript: '^5.9.0',
        },
    }, null, 2);

    const agentTs = `import { GradienceSDK, KeypairAdapter } from '@gradiences/sdk';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const RPC = process.env.GRADIENCE_RPC ?? 'https://api.devnet.solana.com';
const INDEXER = process.env.GRADIENCE_INDEXER ?? 'http://127.0.0.1:3001';
const KEYPAIR_PATH = process.env.GRADIENCE_KEYPAIR ?? path.join(homedir(), '.config/solana/id.json');

async function main() {
    // Load keypair
    const raw = JSON.parse(await readFile(KEYPAIR_PATH, 'utf-8'));
    const wallet = KeypairAdapter.fromSecretKey(new Uint8Array(raw));
    console.log('Agent:', wallet.publicKey);

    const sdk = new GradienceSDK({ rpcEndpoint: RPC, indexerEndpoint: INDEXER });

    // 1. Check reputation
    const rep = await sdk.getReputation(wallet.publicKey);
    console.log('Reputation:', rep ?? 'No reputation yet');

    // 2. Browse open tasks
    const tasks = await sdk.getTasks({ state: 'open', limit: 5 });
    console.log('Open tasks:', tasks?.length ?? 0);

    if (!tasks || tasks.length === 0) {
        console.log('No open tasks. Waiting...');
        return;
    }

    // 3. Apply to first matching task
    const target = tasks[0];
    console.log(\`Applying to Task #\${target.task_id} (reward: \${target.reward})...\`);

    // TODO: Add your task selection logic here
    // await sdk.applyForTask(wallet, { taskId: BigInt(target.task_id) });

    // 4. Process and submit result
    // TODO: Add your task processing logic here
    // const resultRef = 'ipfs://your-result-cid';
    // await sdk.submitTaskResult(wallet, { taskId: BigInt(target.task_id), resultRef });
}

main().catch(console.error);
`;

    const tsconfigJson = JSON.stringify({
        compilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'bundler',
            esModuleInterop: true,
            strict: true,
            skipLibCheck: true,
            outDir: './dist',
        },
        include: ['*.ts'],
    }, null, 2);

    await writeFile(path.join(targetDir, 'package.json'), packageJson);
    await writeFile(path.join(targetDir, 'agent.ts'), agentTs);
    await writeFile(path.join(targetDir, 'tsconfig.json'), tsconfigJson);

    if (noDna) {
        printJson({ ok: true, name, template, path: targetDir });
    } else {
        console.log(`\n  Agent project created: ${name}/\n`);
        console.log('  Next steps:');
        console.log(`    cd ${name}`);
        console.log('    npm install');
        console.log('    npm start\n');
    }
}

function parseFlag(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
}

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
