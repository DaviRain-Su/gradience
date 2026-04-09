import type { Address } from '@solana/kit';
import { homedir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import type { AgentProfileApiResponse } from '../types.js';
import { CliError } from '../types.js';

export type ProfileCommand = 'show' | 'update' | 'publish';

export function isProfileCommand(value: string): value is ProfileCommand {
    return value === 'show' || value === 'update' || value === 'publish';
}

function printJson(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
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

async function loadConfig(env: NodeJS.ProcessEnv): Promise<{ rpc?: string; keypair?: string }> {
    const home = env.HOME || homedir();
    const configPath = path.join(home, '.gradience', 'config.json');

    try {
        const raw = await readFile(configPath, 'utf8');
        return JSON.parse(raw) as { rpc?: string; keypair?: string };
    } catch {
        return {};
    }
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
        const message = error instanceof Error ? error.message : String(error);
        throw new CliError('NETWORK_ERROR', `AgentM API unreachable: ${message}`);
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

async function ensureAgentmDemoSession(apiBaseUrl: string, agent: string, env: NodeJS.ProcessEnv): Promise<void> {
    if (env.GRADIENCE_AGENTM_DEMO_LOGIN === '0') {
        return;
    }
    const privyUserId = env.GRADIENCE_AGENTM_PRIVY_USER_ID ?? `cli-${agent.slice(0, 16)}`;
    await requestAgentmApiJson(apiBaseUrl, '/auth/demo-login', env, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            publicKey: agent,
            email: `${agent.slice(0, 8)}@agentm.local`,
            privyUserId,
        }),
    });
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

function isMockTaskMode(env: NodeJS.ProcessEnv): boolean {
    const value = env.GRADIENCE_CLI_MOCK;
    if (!value) {
        return false;
    }
    return !['0', 'false', 'False', 'FALSE'].includes(value);
}

export async function handleProfileCommand(
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
    }>(apiBaseUrl, `/api/agents/${encodeURIComponent(localAgent)}/profile/publish`, env, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            publish_mode: mode,
            content_ref: contentRef,
        }),
    });
    if (noDna) {
        printJson(published);
    } else {
        process.stdout.write(
            `profile publish ok: tx=${published.onchain_tx} onchain_ref=${published.profile.onchain_ref ?? 'null'}\n`,
        );
    }
}
