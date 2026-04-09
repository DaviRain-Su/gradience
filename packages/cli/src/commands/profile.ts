import ora from 'ora';
import chalk from 'chalk';
import { GradienceSDK } from '@gradiences/sdk';
import { ConfigManager } from '../config.js';
import { loadKeypairSigner, outputResult, outputError, isMockMode, isNoJsonMode } from '../utils.js';

export async function showProfile(options: { agent?: string }): Promise<void> {
    const spinner = ora('Fetching agent profile...').start();

    try {
        if (isMockMode()) {
            const mockProfile = generateMockProfile(options.agent);
            spinner.succeed('Profile fetched (mock mode)');
            emitProfileShowResult(options.agent ?? 'mock-agent', mockProfile);
            return;
        }

        const config = new ConfigManager();
        const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
        const showSdkOptions = indexerEndpoint !== undefined ? { indexerEndpoint } : {};
        const sdk = new GradienceSDK(showSdkOptions);

        let agent: string;
        if (options.agent) {
            agent = options.agent;
        } else {
            const keypairPath = await config.get('keypair');
            if (!keypairPath) {
                throw new Error(
                    'No agent specified and keypair not configured. Run: gradience config set keypair <path>',
                );
            }
            const signer = await loadKeypairSigner(keypairPath);
            agent = signer.address;
        }

        spinner.text = 'Querying profile...';
        const profile = await sdk.getAgentProfile(agent);

        spinner.succeed('Profile retrieved');
        emitProfileShowResult(agent, profile);
    } catch (error) {
        spinner.fail('Failed to fetch profile');
        outputError(error, 'PROFILE_SHOW_ERROR');
        process.exit(1);
    }
}

export async function updateProfile(options: {
    agent?: string;
    displayName?: string;
    bio?: string;
    website?: string;
    github?: string;
    x?: string;
    publishMode?: string;
}): Promise<void> {
    const spinner = ora('Updating agent profile...').start();

    try {
        if (isMockMode()) {
            const mockProfile = generateMockProfile(options.agent, options);
            spinner.succeed('Profile updated (mock mode)');
            outputResult({ ok: true, profile: mockProfile });
            return;
        }

        const config = new ConfigManager();
        const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
        const updateSdkOptions = indexerEndpoint !== undefined ? { indexerEndpoint } : {};
        const sdk = new GradienceSDK(updateSdkOptions);

        let agent: string;
        if (options.agent) {
            const keypairPath = await config.get('keypair');
            if (!keypairPath) {
                throw new Error('Keypair not configured. Run: gradience config set keypair <path>');
            }
            const signer = await loadKeypairSigner(keypairPath);
            if (options.agent !== signer.address) {
                throw new Error('--agent must match local keypair public key for profile mutations');
            }
            agent = options.agent;
        } else {
            const keypairPath = await config.get('keypair');
            if (!keypairPath) {
                throw new Error('Keypair not configured. Run: gradience config set keypair <path>');
            }
            const signer = await loadKeypairSigner(keypairPath);
            agent = signer.address;
        }

        // Get existing profile to fill in missing fields
        spinner.text = 'Fetching existing profile...';
        const existing = await sdk.getAgentProfile(agent);

        const displayName = options.displayName ?? existing?.display_name ?? '';
        const bio = options.bio ?? existing?.bio ?? '';

        if (!displayName.trim()) {
            throw new Error('Missing required profile field: --display-name');
        }

        if (!bio.trim()) {
            throw new Error('Missing required profile field: --bio');
        }

        const publishMode = parsePublishMode(options.publishMode ?? existing?.publish_mode);
        const websiteVal = options.website ?? existing?.links?.website;
        const githubVal = options.github ?? existing?.links?.github;
        const xVal = options.x ?? existing?.links?.x;
        const links = {
            ...(websiteVal !== undefined && { website: websiteVal }),
            ...(githubVal !== undefined && { github: githubVal }),
            ...(xVal !== undefined && { x: xVal }),
        };

        spinner.text = 'Updating profile...';
        await sdk.profile.update(agent, {
            display_name: displayName,
            bio,
            links,
        });

        spinner.succeed('Profile updated successfully');
        outputResult({
            ok: true,
            agent,
            display_name: displayName,
            bio: bio.slice(0, 50) + (bio.length > 50 ? '...' : ''),
        });
    } catch (error) {
        spinner.fail('Failed to update profile');
        outputError(error, 'PROFILE_UPDATE_ERROR');
        process.exit(1);
    }
}

export async function publishProfile(options: { agent?: string; mode?: string; contentRef?: string }): Promise<void> {
    const spinner = ora('Publishing profile on-chain...').start();

    try {
        if (isMockMode()) {
            const mockResult = {
                ok: true,
                onchain_tx: 'mock-profile-publish-signature',
                profile: generateMockProfile(options.agent, { publishMode: options.mode }),
            };
            spinner.succeed('Profile published (mock mode)');
            outputResult(mockResult);
            return;
        }

        const config = new ConfigManager();
        const indexerEndpoint = process.env.GRADIENCE_INDEXER_ENDPOINT;
        const publishSdkOptions = indexerEndpoint !== undefined ? { indexerEndpoint } : {};
        const sdk = new GradienceSDK(publishSdkOptions);

        let agent: string;
        if (options.agent) {
            const keypairPath = await config.get('keypair');
            if (!keypairPath) {
                throw new Error('Keypair not configured. Run: gradience config set keypair <path>');
            }
            const signer = await loadKeypairSigner(keypairPath);
            if (options.agent !== signer.address) {
                throw new Error('--agent must match local keypair public key for profile mutations');
            }
            agent = options.agent;
        } else {
            const keypairPath = await config.get('keypair');
            if (!keypairPath) {
                throw new Error('Keypair not configured. Run: gradience config set keypair <path>');
            }
            const signer = await loadKeypairSigner(keypairPath);
            agent = signer.address;
        }

        const mode = parsePublishMode(options.mode);

        spinner.text = 'Publishing on-chain reference...';

        // Note: This would need to be implemented in the SDK
        throw new Error('Profile publishing not yet implemented in SDK');
    } catch (error) {
        spinner.fail('Failed to publish profile');
        outputError(error, 'PROFILE_PUBLISH_ERROR');
        process.exit(1);
    }
}

function emitProfileShowResult(agent: string, profile: any | null): void {
    if (isNoJsonMode()) {
        outputResult({ agent, profile });
        return;
    }

    if (!profile) {
        console.log(chalk.yellow(`Profile not found for agent: ${agent}`));
        return;
    }

    console.log(chalk.bold(`\nAgent Profile: ${agent}\n`));
    console.log(`${chalk.bold('Display Name:')} ${profile.display_name}`);
    console.log(`${chalk.bold('Bio:')} ${profile.bio}`);
    console.log(`${chalk.bold('Publish Mode:')} ${profile.publish_mode}`);

    if (profile.links?.website || profile.links?.github || profile.links?.x) {
        console.log(chalk.bold('\nLinks:'));
        if (profile.links.website) {
            console.log(`  Website: ${profile.links.website}`);
        }
        if (profile.links.github) {
            console.log(`  GitHub: ${profile.links.github}`);
        }
        if (profile.links.x) {
            console.log(`  X (Twitter): ${profile.links.x}`);
        }
    }

    console.log(`\n${chalk.bold('On-chain Reference:')} ${profile.onchain_ref ?? 'None'}`);
    console.log(`${chalk.bold('Last Updated:')} ${new Date(profile.updated_at * 1000).toLocaleString()}`);
}

function parsePublishMode(value: string | undefined): 'manual' | 'git-sync' {
    if (!value || value.length === 0) {
        return 'manual';
    }
    if (value === 'manual' || value === 'git-sync') {
        return value;
    }
    throw new Error('Publish mode must be "manual" or "git-sync"');
}

function generateMockProfile(agent?: string, overrides: any = {}): any {
    return {
        agent: agent ?? 'mock-agent',
        display_name: overrides.displayName ?? 'Mock Agent',
        bio: overrides.bio ?? 'A mock agent profile for testing',
        links: {
            website: overrides.website ?? 'https://example.com',
            github: overrides.github ?? 'https://github.com/mock-agent',
            x: overrides.x ?? 'https://x.com/mock_agent',
        },
        onchain_ref: overrides.contentRef ?? null,
        publish_mode: parsePublishMode(overrides.publishMode),
        updated_at: Math.floor(Date.now() / 1000),
    };
}
