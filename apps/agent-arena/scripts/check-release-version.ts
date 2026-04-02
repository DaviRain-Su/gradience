import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SEMVER_REGEX =
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

interface VersionSnapshot {
    workspaceVersion: string;
    rustClientVersion: string;
    npmSdkVersion: string;
}

function extractArg(argv: string[], name: string): string | null {
    const exact = `--${name}`;
    const withValue = argv.find((arg) => arg.startsWith(`${exact}=`));
    if (withValue) {
        return withValue.slice(exact.length + 1);
    }
    const index = argv.findIndex((arg) => arg === exact);
    if (index >= 0 && argv[index + 1]) {
        return argv[index + 1];
    }
    return null;
}

function parseTomlSectionValue(content: string, section: string, key: string): string | null {
    const sectionRegex = new RegExp(`\\[${section.replace('.', '\\.')}\\]([\\s\\S]*?)(?:\\n\\[|$)`);
    const sectionMatch = content.match(sectionRegex);
    if (!sectionMatch) {
        return null;
    }
    const keyRegex = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm');
    const keyMatch = sectionMatch[1]?.match(keyRegex);
    return keyMatch?.[1] ?? null;
}

function inferVersionFromGitTag(gitRefName: string | undefined): string | null {
    if (!gitRefName) {
        return null;
    }
    const match = gitRefName.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/);
    return match?.[1] ?? null;
}

async function loadSnapshot(repoRoot: string): Promise<VersionSnapshot> {
    const workspaceCargo = await readFile(
        path.join(repoRoot, 'apps/agent-arena/Cargo.toml'),
        'utf8',
    );
    const rustCargo = await readFile(
        path.join(repoRoot, 'apps/agent-arena/clients/rust/Cargo.toml'),
        'utf8',
    );
    const npmPackageRaw = await readFile(
        path.join(repoRoot, 'apps/agent-arena/clients/typescript/package.json'),
        'utf8',
    );
    const npmPackage = JSON.parse(npmPackageRaw) as { version?: string };

    const workspaceVersion = parseTomlSectionValue(
        workspaceCargo,
        'workspace.package',
        'version',
    );
    const rustClientVersion = parseTomlSectionValue(rustCargo, 'package', 'version');
    const npmSdkVersion = npmPackage.version ?? null;

    if (!workspaceVersion || !rustClientVersion || !npmSdkVersion) {
        throw new Error('failed to resolve one or more package versions');
    }
    return { workspaceVersion, rustClientVersion, npmSdkVersion };
}

export async function checkReleaseVersion(
    argv: string[] = process.argv.slice(2),
): Promise<VersionSnapshot> {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(scriptDir, '..', '..', '..');
    const snapshot = await loadSnapshot(repoRoot);

    for (const [name, version] of Object.entries(snapshot)) {
        if (!SEMVER_REGEX.test(version)) {
            throw new Error(`invalid semver for ${name}: ${version}`);
        }
    }

    const uniqueVersions = new Set(Object.values(snapshot));
    if (uniqueVersions.size !== 1) {
        throw new Error(
            `version mismatch detected: ${JSON.stringify(snapshot)}`,
        );
    }

    const requestedVersion =
        extractArg(argv, 'version') ?? process.env.RELEASE_VERSION ?? null;
    if (requestedVersion && snapshot.workspaceVersion !== requestedVersion) {
        throw new Error(
            `release version mismatch: requested=${requestedVersion} current=${snapshot.workspaceVersion}`,
        );
    }

    if (process.env.GITHUB_REF_TYPE === 'tag') {
        const tagVersion = inferVersionFromGitTag(process.env.GITHUB_REF_NAME);
        if (tagVersion && tagVersion !== snapshot.workspaceVersion) {
            throw new Error(
                `tag version mismatch: tag=${tagVersion} current=${snapshot.workspaceVersion}`,
            );
        }
    }

    process.stdout.write(
        `${JSON.stringify(
            {
                ok: true,
                version: snapshot.workspaceVersion,
                packages: snapshot,
            },
            null,
            2,
        )}\n`,
    );
    return snapshot;
}

const isMainEntry =
    typeof process.argv[1] === 'string' &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (isMainEntry) {
    checkReleaseVersion().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
    });
}
