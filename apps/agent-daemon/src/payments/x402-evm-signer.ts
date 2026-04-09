/**
 * X402 EVM Permit Signer
 *
 * Helper for payers to generate ERC-2612 permit signatures for X402Settlement.
 */

import {
  type Hex,
  type Chain,
  type Account,
  keccak256,
  toHex,
  concat,
  pad,
  hexToSignature,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export interface PermitSignatureRequest {
  token: Hex;
  chain: Chain;
  owner: Hex;
  spender: Hex;
  value: bigint;
  deadline: bigint;
  nonce: bigint;
}

export interface PermitSignatureResult {
  v: number;
  r: Hex;
  s: Hex;
  nonce: bigint;
}

// ERC-2612 Permit type hash
const PERMIT_TYPEHASH = keccak256(
  toHex('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

function domainSeparator(token: Hex, chain: Chain): Hex {
  // EIP-712 domain type hash
  const domainTypeHash = keccak256(
    toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  );

  // Uncached - always fetch name from contract or assume it (simplified here)
  // For full correctness on arbitrary tokens, read name() from token.
  // We allow overriding via an explicit name parameter in a future version.
  // Defaulting to hash logic is dynamic - this helper currently requires caller to pass nameHash and versionHash.
  // For compatibility with common test tokens we provide a helper with explicit domain.
  throw new Error('Use buildPermitSignatureWithDomain() with explicit domain values');
}

export interface EIP712DomainValues {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Hex;
}

export async function buildPermitSignatureWithDomain(
  domain: EIP712DomainValues,
  request: Omit<PermitSignatureRequest, 'token' | 'chain'>,
  signer: Account | Hex
): Promise<PermitSignatureResult> {
  const domainSeparatorHash = keccak256(
    concat([
      keccak256(toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
      keccak256(toHex(domain.name)),
      keccak256(toHex(domain.version)),
      pad(toHex(domain.chainId), { size: 32 }),
      pad(domain.verifyingContract, { size: 32 }),
    ])
  );

  const structHash = keccak256(
    concat([
      PERMIT_TYPEHASH,
      pad(request.owner, { size: 32 }),
      pad(request.spender, { size: 32 }),
      pad(toHex(request.value), { size: 32 }),
      pad(toHex(request.nonce), { size: 32 }),
      pad(toHex(request.deadline), { size: 32 }),
    ])
  );

  const digest = keccak256(
    concat(['0x1901', domainSeparatorHash, structHash])
  );

  const account = typeof signer === 'string' ? privateKeyToAccount(signer) : signer;
  const signature = await account.sign({ hash: digest });
  const sig = hexToSignature(signature);
  return {
    v: sig.v,
    r: sig.r,
    s: sig.s,
    nonce: request.nonce,
  };
}

/**
 * Convenience wrapper for common test setups where token domain is known.
 */
export async function buildPermitSignature(
  tokenDomain: EIP712DomainValues,
  owner: Hex,
  spender: Hex,
  value: bigint,
  nonce: bigint,
  deadline: bigint,
  signer: Account | Hex
): Promise<PermitSignatureResult> {
  return buildPermitSignatureWithDomain(
    tokenDomain,
    { owner, spender, value, nonce, deadline },
    signer
  );
}
