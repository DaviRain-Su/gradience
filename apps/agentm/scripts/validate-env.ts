/**
 * Environment variable matrix validation for AgentM.
 * Run: npx tsx scripts/validate-env.ts
 *
 * Checks required and optional env vars, reports missing/invalid ones.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

interface EnvVar {
    name: string;
    required: boolean;
    description: string;
    defaultValue?: string;
    validate?: (value: string) => boolean;
}

const ENV_MATRIX: EnvVar[] = [
    {
        name: 'VITE_PRIVY_APP_ID',
        required: false,
        description: 'Privy OAuth app ID (https://dashboard.privy.io). Without it, app runs in demo mode.',
    },
    {
        name: 'VITE_INDEXER_BASE_URL',
        required: false,
        description: 'Indexer REST API base URL',
        defaultValue: 'http://127.0.0.1:3001',
        validate: (v) => v.startsWith('http'),
    },
    {
        name: 'VITE_ERC8004_RELAY_BASE_URL',
        required: false,
        description: '8004 identity relay base URL',
        validate: (v) => v.startsWith('http'),
    },
    {
        name: 'VITE_ERC8004_RELAY_AUTH_TOKEN',
        required: false,
        description: 'Bearer token for 8004 relay authentication',
    },
    {
        name: 'AGENT_IM_DEMO_REQUIRE_INDEXER',
        required: false,
        description: 'Set to 0 to allow offline demo mode',
        defaultValue: '1',
        validate: (v) => v === '0' || v === '1',
    },
];

function loadDotEnv(): Record<string, string> {
    const envPath = path.join(process.cwd(), '.env');
    if (!existsSync(envPath)) return {};
    const content = readFileSync(envPath, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        result[key] = val;
    }
    return result;
}

function main() {
    const dotEnv = loadDotEnv();
    const merged = { ...dotEnv, ...process.env };

    let hasErrors = false;
    const rows: Array<{ name: string; status: string; value: string }> = [];

    for (const envVar of ENV_MATRIX) {
        const value = merged[envVar.name];
        let status: string;

        if (!value && envVar.required) {
            status = 'MISSING (required)';
            hasErrors = true;
        } else if (!value && envVar.defaultValue) {
            status = `default: ${envVar.defaultValue}`;
        } else if (!value) {
            status = 'not set (optional)';
        } else if (envVar.validate && !envVar.validate(value)) {
            status = 'INVALID';
            hasErrors = true;
        } else {
            status = 'ok';
        }

        rows.push({
            name: envVar.name,
            status,
            value: value ? (value.length > 30 ? `${value.slice(0, 27)}...` : value) : '--',
        });
    }

    console.log('\nAgentM Environment Matrix\n');
    console.log(`${'Variable'.padEnd(40)} ${'Status'.padEnd(25)} Value`);
    console.log('-'.repeat(80));
    for (const row of rows) {
        console.log(`${row.name.padEnd(40)} ${row.status.padEnd(25)} ${row.value}`);
    }
    console.log('');

    if (hasErrors) {
        console.error('Environment validation FAILED. Fix the issues above.\n');
        process.exit(1);
    } else {
        console.log('Environment validation PASSED.\n');
    }
}

main();
