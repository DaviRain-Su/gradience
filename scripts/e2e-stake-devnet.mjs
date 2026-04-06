import { Connection, Keypair } from '@solana/web3.js';
import { createRealStakeHandler } from '../packages/workflow-engine/dist/index.js';
import { readFileSync } from 'fs';

const RPC_URL = 'https://api.devnet.solana.com';
const KEYPAIR_PATH = '/Users/davirian/.config/solana/id.json';
const VALIDATOR_VOTE = '7UGVVQyRLmbkjhCx3cKG6ShPFwJtDBoTWd3z4r2kyQUR';

async function main() {
  const secret = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8'));
  const signer = Keypair.fromSecretKey(new Uint8Array(secret));

  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(signer.publicKey);
  console.log(`Signer: ${signer.publicKey.toBase58()}`);
  console.log(`Balance: ${balance / 1e9} SOL`);

  const handler = createRealStakeHandler({ connection });

  console.log('Creating stake account + delegating to validator...');
  const result = await handler.execute(
    'solana',
    {
      validator: VALIDATOR_VOTE,
      amount: '10000000', // 0.01 SOL
      signer,
    },
    {
      stepId: 'e2e-stake',
      workflowId: 'devnet-e2e',
      executor: 'droid-test',
      stepResults: new Map(),
    }
  );

  console.log('Stake result:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('E2E stake failed:', err);
  process.exit(1);
});
