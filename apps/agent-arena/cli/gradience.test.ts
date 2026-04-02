import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const CLI_PATH = '/Users/davirian/dev/active/gradience/apps/agent-arena/cli/gradience.ts';

test('help lists config commands', () => {
    const result = runCli(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /config set rpc <url>/);
    assert.match(result.stdout, /config set keypair <path>/);
    assert.match(result.stdout, /profile show/);
});

test('NO_DNA help returns json schema', () => {
    const result = runCli(['--help'], { NO_DNA: '1' });
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout.trim()) as {
        schemaVersion: string;
        mode: string;
    };
    assert.equal(parsed.schemaVersion, '1.0.0');
    assert.equal(parsed.mode, 'NO_DNA');
});

test('NO_DNA config set rpc writes ~/.gradience/config.json', () => {
    const tempHome = mkdtempSync(path.join(os.tmpdir(), 'gradience-cli-'));
    try {
        const result = runCli(['config', 'set', 'rpc', 'http://127.0.0.1:8899'], {
            NO_DNA: '1',
            HOME: tempHome,
        });
        assert.equal(result.status, 0);
        const payload = JSON.parse(result.stdout.trim()) as { ok: boolean };
        assert.equal(payload.ok, true);

        const configPath = path.join(tempHome, '.gradience', 'config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as { rpc: string };
        assert.equal(config.rpc, 'http://127.0.0.1:8899/');
    } finally {
        rmSync(tempHome, { recursive: true, force: true });
    }
});

test('invalid arguments return clear machine-readable error in NO_DNA mode', () => {
    const result = runCli(['config', 'set', 'rpc'], { NO_DNA: '1' });
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim()) as {
        ok: boolean;
        error: { code: string };
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_ARGUMENT');
});

test('NO_DNA task post outputs structured signature payload', () => {
    const result = runCli(['task', 'post', '--task-id', '42', '--eval-ref', 'ipfs://eval', '--reward', '1000000'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-post-signature',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; taskId: number };
    assert.equal(payload.signature, 'mock-post-signature');
    assert.equal(payload.taskId, 42);
});

test('NO_DNA task apply outputs structured signature payload', () => {
    const result = runCli(['task', 'apply', '--task-id', '7'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-apply-signature',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; taskId: number };
    assert.equal(payload.signature, 'mock-apply-signature');
    assert.equal(payload.taskId, 7);
});

test('NO_DNA task submit outputs structured signature payload', () => {
    const result = runCli(
        ['task', 'submit', '--task-id', '3', '--result-ref', 'ipfs://result', '--trace-ref', 'ipfs://trace'],
        {
            NO_DNA: '1',
            GRADIENCE_CLI_MOCK: '1',
            GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-submit-signature',
        },
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; taskId: number };
    assert.equal(payload.signature, 'mock-submit-signature');
    assert.equal(payload.taskId, 3);
});

test('NO_DNA task status outputs pure json', () => {
    const result = runCli(['task', 'status', '1'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_STATE: 'Open',
        GRADIENCE_CLI_MOCK_SUBMISSION_COUNT: '5',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as {
        taskId: number;
        state: string;
        submissionCount: number;
    };
    assert.deepEqual(payload, { taskId: 1, state: 'Open', submissionCount: 5 });
});

test('NO_DNA task judge outputs signature + winner + score payload', () => {
    const result = runCli(
        [
            'task',
            'judge',
            '--task-id',
            '9',
            '--winner',
            '11111111111111111111111111111111',
            '--poster',
            '11111111111111111111111111111111',
            '--score',
            '9000',
            '--reason-ref',
            'ipfs://reason',
        ],
        {
            NO_DNA: '1',
            GRADIENCE_CLI_MOCK: '1',
            GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-judge-signature',
        },
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as {
        signature: string;
        taskId: number;
        winner: string;
        score: number;
    };
    assert.equal(payload.signature, 'mock-judge-signature');
    assert.equal(payload.taskId, 9);
    assert.equal(payload.winner, '11111111111111111111111111111111');
    assert.equal(payload.score, 9000);
});

test('NO_DNA task cancel outputs structured signature payload', () => {
    const result = runCli(['task', 'cancel', '--task-id', '2'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-cancel-signature',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; taskId: number };
    assert.equal(payload.signature, 'mock-cancel-signature');
    assert.equal(payload.taskId, 2);
});

test('NO_DNA task refund outputs structured signature payload', () => {
    const result = runCli(['task', 'refund', '--task-id', '4'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-refund-signature',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; taskId: number };
    assert.equal(payload.signature, 'mock-refund-signature');
    assert.equal(payload.taskId, 4);
});

test('NO_DNA judge register returns structured payload', () => {
    const result = runCli(['judge', 'register', '--category', 'defi'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-register-signature',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; command: string };
    assert.equal(payload.signature, 'mock-register-signature');
    assert.equal(payload.command, 'register');
});

test('NO_DNA judge unstake returns structured payload', () => {
    const result = runCli(['judge', 'unstake'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
        GRADIENCE_CLI_MOCK_SIGNATURE: 'mock-unstake-signature',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as { signature: string; command: string };
    assert.equal(payload.signature, 'mock-unstake-signature');
    assert.equal(payload.command, 'unstake');
});

test('NO_DNA profile show returns structured payload', () => {
    const result = runCli(['profile', 'show', '--agent', 'agent-a'], {
        NO_DNA: '1',
        GRADIENCE_CLI_MOCK: '1',
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as {
        agent: string;
        profile: { agent: string; display_name: string };
    };
    assert.equal(payload.agent, 'agent-a');
    assert.equal(payload.profile.agent, 'agent-a');
    assert.equal(payload.profile.display_name, 'Mock Agent');
});

test('NO_DNA profile update returns ok payload', () => {
    const result = runCli(
        [
            'profile',
            'update',
            '--display-name',
            'Alice',
            '--bio',
            'Builder',
            '--website',
            'https://alice.example',
        ],
        {
            NO_DNA: '1',
            GRADIENCE_CLI_MOCK: '1',
        },
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as {
        ok: boolean;
        profile: { display_name: string; bio: string };
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.profile.display_name, 'Alice');
    assert.equal(payload.profile.bio, 'Builder');
});

test('NO_DNA profile publish returns tx payload', () => {
    const result = runCli(
        ['profile', 'publish', '--mode', 'git-sync', '--content-ref', 'sha256:abc'],
        {
            NO_DNA: '1',
            GRADIENCE_CLI_MOCK: '1',
        },
    );
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout.trim()) as {
        ok: boolean;
        onchain_tx: string;
        profile: { publish_mode: string; onchain_ref: string };
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.onchain_tx, 'mock-profile-publish-signature');
    assert.equal(payload.profile.publish_mode, 'git-sync');
    assert.equal(payload.profile.onchain_ref, 'sha256:abc');
});

test('profile publish rejects invalid mode', () => {
    const result = runCli(
        ['profile', 'publish', '--mode', 'invalid-mode'],
        {
            NO_DNA: '1',
            GRADIENCE_CLI_MOCK: '1',
        },
    );
    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stderr.trim()) as {
        ok: boolean;
        error: { code: string; message: string };
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_ARGUMENT');
    assert.match(payload.error.message, /publish mode must be manual or git-sync/);
});

function runCli(args: string[], env: NodeJS.ProcessEnv = {}) {
    return spawnSync('bun', [CLI_PATH, ...args], {
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env,
        },
    });
}
