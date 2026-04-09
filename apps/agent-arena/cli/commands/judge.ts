import { AccountRole, type AccountMeta, type Address } from '@solana/kit';
import { GRADIENCE_PROGRAM_ADDRESS, type GradienceSDK, findEventAuthorityPda } from '@gradiences/arena-sdk';
import type { KeypairAdapter } from '@gradiences/arena-sdk';
import {
    CliError,
    isMockTaskMode,
    parseFlags,
    requiredFlag,
    parseU64,
    parseCategories,
    appendRemainingAccounts,
    findConfigPda,
    findStakePda,
    findReputationPda,
    findJudgePoolPda,
    fetchMinJudgeStake,
    fetchStakeCategories,
} from '../types.js';
import { loadConfig, createSdk } from '../utils/index.js';
import { printJson } from '../utils/output.js';
import { createKeypairAdapter } from '../utils/sdk.js';

export type JudgeCommand = 'register' | 'unstake';

export function isJudgeCommand(value: string): value is JudgeCommand {
    return value === 'register' || value === 'unstake';
}

export async function handleJudgeCommand(judgeArgs: string[], env: NodeJS.ProcessEnv, noDna: boolean): Promise<void> {
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
                : await fetchMinJudgeStake();

        const instruction = await (sdk as any).instructions.registerJudge(
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

    // command === 'unstake'
    const [stakePda] = await findStakePda(wallet.signer.address);
    const categories = await fetchStakeCategories();
    const instruction = await (sdk as any).instructions.unstakeJudge(
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
