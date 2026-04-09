import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MAX_DIST_BYTES = 20 * 1024 * 1024;

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
    execFileSync(command, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env,
    });
}

function getDirectorySizeBytes(dirPath: string): number {
    let total = 0;
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            total += getDirectorySizeBytes(fullPath);
            continue;
        }
        total += statSync(fullPath).size;
    }
    return total;
}

function main() {
    run('pnpm', ['typecheck']);
    run('pnpm', ['test']);
    run('pnpm', ['build']);
    run('pnpm', ['demo:stage-a'], {
        ...process.env,
        AGENT_IM_DEMO_REQUIRE_INDEXER: '0',
    });

    const distPath = path.join(process.cwd(), 'dist');
    const distBytes = getDirectorySizeBytes(distPath);
    if (distBytes > MAX_DIST_BYTES) {
        throw new Error(`dist size exceeds 20MB gate: ${(distBytes / 1024 / 1024).toFixed(2)}MB`);
    }

    process.stdout.write(
        JSON.stringify(
            {
                ok: true,
                checks: ['typecheck', 'test', 'build', 'stage-a-demo', 'dist-size'],
                distBytes,
                distMb: Number((distBytes / 1024 / 1024).toFixed(2)),
            },
            null,
            2,
        ) + '\n',
    );
}

main();
