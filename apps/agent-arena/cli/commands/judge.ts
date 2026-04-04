import { AccountRole, type AccountMeta, type Address } from '@solana/kit';
import {
    GRADIENCE_PROGRAM_ADDRESS,
    type GradienceSDK,
    findEventAuthorityPda,
} from '@gradiences/arena-sdk';
import type { KeypairAdapter } from '@gradiences/arena-sdk';

export type JudgeCommand = 'register' | 'unstake';

export interface JudgeCommandContext {
    sdk: GradienceSDK;
    wallet: KeypairAdapter;
    noDna: boolean;
    printJson: (value: unknown) => void;
    CliError: new (code: string, message: string) => Error & { code: string };
    isMockTaskMode: (env: NodeJS.ProcessEnv) => boolean;
    loadConfig: (env: NodeJS.ProcessEnv) => Promise<{ rpc?: string; keypair?: string }>;
    createSdk: (env: NodeJS.ProcessEnv) => GradienceSDK;
    createKeypairAdapter: (rpcEndpoint: string, keypairPath: string) => Promise<KeypairAdapter>;
    parseFlags: (tokens: string[]) => Map<string, string>;
    requiredFlag: (flags: Map<string, string>, key: string) => string;
    parseU64: (value: string | undefined, name: string) => bigint;
    findConfigPda: () => Promise<readonly [Address, number]>;
    findStakePda: (judge: Address) => Promise<readonly [Address, number]>;
    findReputationPda: (agent: Address) => Promise<readonly [Address, number]>;
    findJudgePoolPda: (category: number) => Promise<readonly [Address, number]>;
    fetchMinJudgeStake: (rpcEndpoint: string, configPda: Address) => Promise<bigint>;
    fetchStakeCategories: (rpcEndpoint: string, stakePda: Address) => Promise<number[]>;
    parseCategories: (raw: string) => number[];
    appendRemainingAccounts: (instruction: InstructionLike, remaining: AccountMeta[]) => InstructionLike;
}

export interface InstructionLike {
    accounts: readonly AccountMeta[];
    programAddress: Address;
    data: Uint8Array;
}

export function isJudgeCommand(value: string): value is JudgeCommand {
    return value === 'register' || value === 'unstake';
}

export async function handleJudgeCommand(
    judgeArgs: string[],
    env: NodeJS.ProcessEnv,
    noDna: boolean,
    ctx: JudgeCommandContext,
): Promise<void> {
    const command = judgeArgs[0];
    if (!command || !isJudgeCommand(command)) {
        throw new ctx.CliError('INVALID_ARGUMENT', 'Usage: gradience judge <register|unstake> ...');
    }

    if (ctx.isMockTaskMode(env)) {
        const signature = env.GRADIENCE_CLI_MOCK_SIGNATURE ?? `mock-judge-${command}-signature`;
        if (noDna) {
            ctx.printJson({ signature, command });
        } else {
            process.stdout.write(`${command} ok: signature=${signature}\n`);
        }
        return;
    }

    const config = await ctx.loadConfig(env);
    if (!config.rpc) {
        throw new ctx.CliError(
            'CONFIG_MISSING',
            'Missing rpc in ~/.gradience/config.json. Run: gradience config set rpc <url>',
        );
    }
    if (!config.keypair) {
        throw new ctx.CliError(
            'CONFIG_MISSING',
            'Missing keypair in ~/.gradience/config.json. Run: gradience config set keypair <path>',
        );
    }

    const flags = ctx.parseFlags(judgeArgs.slice(1));
    const sdk = ctx.createSdk(env);
    const wallet = await ctx.createKeypairAdapter(config.rpc, config.keypair);
    const eventAuthority = await findEventAuthorityPda();

    if (command === 'register') {
        const categories = ctx.parseCategories(ctx.requiredFlag(flags, 'category'));
        const [configPda] = await ctx.findConfigPda();
        const [stakePda] = await ctx.findStakePda(wallet.signer.address);
        const [reputationPda] = await ctx.findReputationPda(wallet.signer.address);
        const stakeAmount =
            flags.get('stake-amount') !== undefined
                ? ctx.parseU64(flags.get('stake-amount'), 'stake-amount')
                : await ctx.fetchMinJudgeStake(config.rpc, configPda);

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
            categories.map(async (category) => {
                const [pool] = await ctx.findJudgePoolPda(category);
                return { address: pool, role: AccountRole.WRITABLE } as AccountMeta;
            }),
        );

        const signature = await wallet.signAndSendTransaction([ctx.appendRemainingAccounts(instruction, poolMetas)]);
        if (noDna) {
            ctx.printJson({ signature, categories, stakeAmount: Number(stakeAmount) });
        } else {
            process.stdout.write(`judge register ok: signature=${signature} categories=${categories.join(',')}\n`);
        }
        return;
    }

    // command === 'unstake'
    const [stakePda] = await ctx.findStakePda(wallet.signer.address);
    const categories = await ctx.fetchStakeCategories(config.rpc, stakePda);
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
        categories.map(async (category) => {
            const [pool] = await ctx.findJudgePoolPda(category);
            return { address: pool, role: AccountRole.WRITABLE } as AccountMeta;
        }),
    );
    const signature = await wallet.signAndSendTransaction([ctx.appendRemainingAccounts(instruction, poolMetas)]);
    if (noDna) {
        ctx.printJson({ signature, categories });
    } else {
        process.stdout.write(`judge unstake ok: signature=${signature}\n`);
    }
}
