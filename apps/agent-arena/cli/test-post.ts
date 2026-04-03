import { createSdk, createKeypairAdapter } from './gradience.ts';

async function main() {
    const rpc = 'https://api.devnet.solana.com/';
    const keypair = process.env.HOME + '/.config/solana/id.json';
    
    // Import sdk creation from the CLI module
    const { GradienceClient, KeypairWalletAdapter } = await import('../clients/typescript/src/sdk.js');
    const { createKeyPairSignerFromBytes, getBase58Encoder } = await import('@solana/kit');
    const fs = await import('node:fs');
    
    const keypairBytes = JSON.parse(fs.readFileSync(keypair, 'utf-8'));
    const signer = await createKeyPairSignerFromBytes(new Uint8Array(keypairBytes));
    console.log('Signer:', signer.address);
    
    const wallet = new KeypairWalletAdapter(rpc, signer);
    const sdk = new GradienceClient({ rpcEndpoint: rpc });
    
    try {
        const sig = await sdk.postTask(wallet, {
            taskId: 3n,
            evalRef: 'fix-test',
            reward: 50000000n,
            category: 0,
            minStake: 0n,
            judgeMode: 0,
            judge: signer.address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
            judgeDeadline: BigInt(Math.floor(Date.now() / 1000) + 172800),
        });
        console.log('Posted task, sig:', sig);
    } catch (e: any) {
        console.error('Error:', e.message);
        console.error('Full error:', JSON.stringify(e, null, 2));
        if (e.cause) console.error('Cause:', e.cause);
        if (e.context) console.error('Context:', JSON.stringify(e.context, null, 2));
        if (e.logs) console.error('Logs:', e.logs);
    }
}

main();
