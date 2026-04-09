import { runRelayServerFromEnv } from './server';

runRelayServerFromEnv().catch((error) => {
    console.error('[a2a-relay] failed to start', error);
    const processLike = globalThis as { process?: { exit?: (code?: number) => void } };
    processLike.process?.exit?.(1);
});
