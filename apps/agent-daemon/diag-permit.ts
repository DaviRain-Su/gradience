import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { xLayerTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { buildPermitSignature } from './src/payments/x402-evm-signer.js';
const privateKey = '0xbebff393a40d6aabe1e7fd66bd7299f094255ed574b4abc08f5329b9629ee4c9';
const settlement = '0x1Af0E217d434323f428609a42Df36B3D93c2452a';
const tokenAddress = '0xa8ad936e0489d847a8e4cffd555cacffdc24b092';
const account = privateKeyToAccount(privateKey as `0x${string}`);
const payer = account.address;
const publicClient = createPublicClient({ chain: xLayerTestnet, transport: http('https://testrpc.xlayer.tech') });
const walletClient = createWalletClient({ chain: xLayerTestnet, transport: http('https://testrpc.xlayer.tech'), account });
async function main() {
  const nonce = await publicClient.readContract({ address: tokenAddress, abi: [{type:'function',name:'nonces',inputs:[{type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'}], functionName:'nonces', args:[payer] });
  console.log('nonce', nonce);
  const tokenName = await publicClient.readContract({ address: tokenAddress, abi: [{type:'function',name:'name',inputs:[],outputs:[{type:'string'}],stateMutability:'view'}], functionName:'name' });
  console.log('name', tokenName);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const sig = await buildPermitSignature({ name: tokenName, version: '1', chainId: xLayerTestnet.id, verifyingContract: tokenAddress }, payer, settlement, parseEther('10'), nonce, deadline, account);
  console.log('sig', sig);
  try {
    const hash = await walletClient.writeContract({ address: tokenAddress, abi: [{type:'function',name:'permit',inputs:[{type:'address'},{type:'address'},{type:'uint256'},{type:'uint256'},{type:'uint8'},{type:'bytes32'},{type:'bytes32'}],outputs:[],stateMutability:'nonpayable'}], functionName:'permit', args:[payer, settlement, parseEther('10'), deadline, sig.v, sig.r, sig.s] } as any);
    console.log('permit tx', hash);
  } catch(e) { console.error('permit error', e); }
}
main().catch(console.error);
