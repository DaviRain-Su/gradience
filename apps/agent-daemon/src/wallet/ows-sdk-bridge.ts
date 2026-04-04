/**
 * OWS SDK Bridge
 *
 * Wraps @open-wallet-standard/core to provide wallet management,
 * policy enforcement, and API key provisioning for agent sub-wallets.
 *
 * @module wallet/ows-sdk-bridge
 */

import {
  createWallet,
  listWallets,
  getWallet,
  deleteWallet,
  exportWallet,
  importWalletMnemonic,
  importWalletPrivateKey,
  signMessage,
  signTransaction,
  signAndSend,
  generateMnemonic,
  deriveAddress,
  createPolicy,
  listPolicies,
  getPolicy,
  deletePolicy,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '@open-wallet-standard/core';
import { logger } from '../utils/logger.js';

export interface OWSWalletInfo {
  id: string;
  name: string;
  accounts: Array<{
    chainId: string;
    address: string;
    derivationPath: string;
  }>;
  createdAt: string;
}

export interface OWSSignResult {
  signature: string;
  recoveryId?: number;
}

export interface OWSSendResult {
  txHash: string;
}

export interface OWSPolicyDef {
  id: string;
  name: string;
  version: number;
  created_at: string;
  rules?: Array<{ type: string; [key: string]: unknown }>;
  executable?: string | null;
  config?: Record<string, unknown> | null;
  action: 'deny';
}

export interface OWSApiKeyResult {
  token: string;
  id: string;
  name: string;
}

export class OWSSdkBridge {
  private vaultPath: string;

  constructor(vaultPath?: string) {
    this.vaultPath = vaultPath ?? `${process.env.HOME}/.ows`;
  }

  // ── Wallet Management ──

  createAgentWallet(name: string, passphrase?: string): OWSWalletInfo {
    logger.info({ name }, 'Creating OWS wallet');
    const wallet = createWallet(name, passphrase, 12, this.vaultPath);
    logger.info({ id: wallet.id, name, accounts: wallet.accounts.length }, 'OWS wallet created');
    return wallet as OWSWalletInfo;
  }

  listAgentWallets(): OWSWalletInfo[] {
    return listWallets(this.vaultPath) as OWSWalletInfo[];
  }

  getAgentWallet(nameOrId: string): OWSWalletInfo {
    return getWallet(nameOrId, this.vaultPath) as OWSWalletInfo;
  }

  deleteAgentWallet(nameOrId: string): void {
    logger.info({ nameOrId }, 'Deleting OWS wallet');
    deleteWallet(nameOrId, this.vaultPath);
  }

  exportAgentWallet(nameOrId: string, passphrase?: string): string {
    return exportWallet(nameOrId, passphrase, this.vaultPath) as string;
  }

  importFromMnemonic(name: string, mnemonic: string, passphrase?: string): OWSWalletInfo {
    logger.info({ name }, 'Importing wallet from mnemonic');
    return importWalletMnemonic(name, mnemonic, passphrase, undefined, this.vaultPath) as OWSWalletInfo;
  }

  importFromPrivateKey(name: string, privateKeyHex: string, chain?: string, passphrase?: string): OWSWalletInfo {
    logger.info({ name, chain }, 'Importing wallet from private key');
    return importWalletPrivateKey(name, privateKeyHex, passphrase, this.vaultPath, chain) as OWSWalletInfo;
  }

  generateNewMnemonic(words: 12 | 24 = 12): string {
    return generateMnemonic(words) as string;
  }

  deriveWalletAddress(mnemonic: string, chain: string, index = 0): string {
    return deriveAddress(mnemonic, chain, index) as string;
  }

  // ── Signing ──

  signAgentMessage(
    wallet: string,
    chain: string,
    message: string,
    credential?: string,
  ): OWSSignResult {
    logger.debug({ wallet, chain }, 'Signing message');
    return signMessage(wallet, chain, message, credential, undefined, undefined, this.vaultPath) as OWSSignResult;
  }

  signAgentTransaction(
    wallet: string,
    chain: string,
    txHex: string,
    credential?: string,
  ): OWSSignResult {
    logger.debug({ wallet, chain }, 'Signing transaction');
    return signTransaction(wallet, chain, txHex, credential, undefined, this.vaultPath) as OWSSignResult;
  }

  signAndSendTransaction(
    wallet: string,
    chain: string,
    txHex: string,
    credential?: string,
    rpcUrl?: string,
  ): OWSSendResult {
    logger.info({ wallet, chain }, 'Signing and sending transaction');
    return signAndSend(wallet, chain, txHex, credential, undefined, rpcUrl, this.vaultPath) as OWSSendResult;
  }

  // ── Policy Management ──

  createSigningPolicy(policy: OWSPolicyDef): void {
    logger.info({ id: policy.id, name: policy.name }, 'Creating OWS policy');
    createPolicy(JSON.stringify(policy), this.vaultPath);
  }

  listSigningPolicies(): OWSPolicyDef[] {
    return listPolicies(this.vaultPath) as OWSPolicyDef[];
  }

  getSigningPolicy(id: string): OWSPolicyDef {
    return getPolicy(id, this.vaultPath) as OWSPolicyDef;
  }

  deleteSigningPolicy(id: string): void {
    logger.info({ id }, 'Deleting OWS policy');
    deletePolicy(id, this.vaultPath);
  }

  // ── API Key Management ──

  createAgentApiKey(
    name: string,
    walletIds: string[],
    policyIds: string[],
    passphrase: string,
    expiresAt?: string,
  ): OWSApiKeyResult {
    logger.info({ name, walletIds, policyIds }, 'Creating OWS API key');
    const result = createApiKey(name, walletIds, policyIds, passphrase, expiresAt, this.vaultPath);
    logger.info({ keyId: (result as OWSApiKeyResult).id, name }, 'OWS API key created');
    return result as OWSApiKeyResult;
  }

  listAgentApiKeys(): Array<{ id: string; name: string; walletIds: string[]; policyIds: string[] }> {
    return listApiKeys(this.vaultPath) as Array<{ id: string; name: string; walletIds: string[]; policyIds: string[] }>;
  }

  revokeAgentApiKey(id: string): void {
    logger.info({ id }, 'Revoking OWS API key');
    revokeApiKey(id, this.vaultPath);
  }

  // ── Helpers ──

  getSolanaAddress(wallet: OWSWalletInfo): string | null {
    const solanaAccount = wallet.accounts.find(a =>
      a.chainId.startsWith('solana:'),
    );
    return solanaAccount?.address ?? null;
  }

  getEvmAddress(wallet: OWSWalletInfo): string | null {
    const evmAccount = wallet.accounts.find(a =>
      a.chainId.startsWith('eip155:'),
    );
    return evmAccount?.address ?? null;
  }
}
