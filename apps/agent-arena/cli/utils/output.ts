/**
 * Output utilities for Gradience CLI
 */

import type { AgentProfileApiResponse } from '../types.js';

/**
 * Check if NO_DNA mode is enabled via environment variable
 */
export function isNoDnaMode(env: NodeJS.ProcessEnv): boolean {
    const value = env.NO_DNA;
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

/**
 * Check if help should be shown based on arguments
 */
export function shouldShowHelp(args: string[]): boolean {
    return args.length === 0 || args.includes('--help') || args.includes('-h');
}

/**
 * Print JSON output to stdout
 */
export function printJson(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
}

/**
 * Print help message
 */
export function printHelp(noDna: boolean): void {
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

/**
 * Emit task signature output
 */
export function emitTaskSignature(
    command: 'post' | 'apply' | 'submit' | 'judge' | 'cancel' | 'refund',
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

/**
 * Emit task status output
 */
export function emitStatus(
    taskId: number,
    state: string,
    submissionCount: bigint,
    noDna: boolean,
): void {
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

/**
 * Emit judge signature output
 */
export function emitJudgeSignature(
    signature: string,
    taskId: number,
    winner: string,
    score: number,
    noDna: boolean,
): void {
    if (noDna) {
        printJson({ signature, taskId, winner, score });
        return;
    }
    process.stdout.write(`judge ok: signature=${signature} taskId=${taskId} winner=${winner} score=${score}\n`);
}

/**
 * Emit profile show result output
 */
export function emitProfileShowResult(
    agent: string,
    profile: AgentProfileApiResponse | null,
    noDna: boolean,
): void {
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
