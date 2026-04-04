/**
 * OWS Daemon Client
 *
 * Proxies wallet operations through the daemon REST API instead of
 * managing keys locally. Falls back to local OWSSdkClient when daemon
 * is unreachable.
 */

export interface DaemonWallet {
  id: string;
  name: string;
  accounts: Array<{ chainId: string; address: string; derivationPath: string }>;
  createdAt: string;
  solanaAddress: string | null;
}

export interface DaemonSignResult {
  signature: string;
  recoveryId?: number;
}

export interface DaemonPolicy {
  id: string;
  name: string;
  version: number;
  rules?: Array<{ type: string; [key: string]: unknown }>;
}

export interface DaemonApiKey {
  id: string;
  name: string;
  walletIds: string[];
  policyIds: string[];
  token?: string;
}

async function daemonFetch<T>(
  daemonUrl: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${daemonUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error ?? `Daemon request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export class OWSDaemonClient {
  constructor(
    private daemonUrl: string,
    private sessionToken: string | null = null,
  ) {}

  setAuth(token: string | null): void {
    this.sessionToken = token;
  }

  // -- Wallets --

  async createWallet(name: string, passphrase?: string): Promise<DaemonWallet> {
    const res = await daemonFetch<{ wallet: DaemonWallet; solanaAddress: string | null }>(
      this.daemonUrl,
      '/api/v1/ows/wallets',
      { method: 'POST', body: { name, passphrase }, token: this.sessionToken },
    );
    return { ...res.wallet, solanaAddress: res.solanaAddress };
  }

  async listWallets(): Promise<DaemonWallet[]> {
    const res = await daemonFetch<{ wallets: DaemonWallet[] }>(
      this.daemonUrl,
      '/api/v1/ows/wallets',
      { token: this.sessionToken },
    );
    return res.wallets;
  }

  async getWallet(id: string): Promise<DaemonWallet> {
    const res = await daemonFetch<{ wallet: DaemonWallet; solanaAddress: string | null }>(
      this.daemonUrl,
      `/api/v1/ows/wallets/${encodeURIComponent(id)}`,
      { token: this.sessionToken },
    );
    return { ...res.wallet, solanaAddress: res.solanaAddress };
  }

  async deleteWallet(id: string): Promise<void> {
    await daemonFetch(
      this.daemonUrl,
      `/api/v1/ows/wallets/${encodeURIComponent(id)}`,
      { method: 'DELETE', token: this.sessionToken },
    );
  }

  async exportWallet(nameOrId: string, passphrase?: string): Promise<string> {
    const res = await daemonFetch<{ secret: string }>(
      this.daemonUrl,
      '/api/v1/ows/wallets/export',
      { method: 'POST', body: { nameOrId, passphrase }, token: this.sessionToken },
    );
    return res.secret;
  }

  async importMnemonic(name: string, mnemonic: string, passphrase?: string): Promise<DaemonWallet> {
    const res = await daemonFetch<{ wallet: DaemonWallet; solanaAddress: string | null }>(
      this.daemonUrl,
      '/api/v1/ows/wallets/import/mnemonic',
      { method: 'POST', body: { name, mnemonic, passphrase }, token: this.sessionToken },
    );
    return { ...res.wallet, solanaAddress: res.solanaAddress };
  }

  async importPrivateKey(
    name: string,
    privateKeyHex: string,
    chain?: string,
    passphrase?: string,
  ): Promise<DaemonWallet> {
    const res = await daemonFetch<{ wallet: DaemonWallet; solanaAddress: string | null }>(
      this.daemonUrl,
      '/api/v1/ows/wallets/import/private-key',
      { method: 'POST', body: { name, privateKeyHex, chain, passphrase }, token: this.sessionToken },
    );
    return { ...res.wallet, solanaAddress: res.solanaAddress };
  }

  // -- Signing (policy-gated) --

  async signMessage(params: {
    wallet: string;
    chain: string;
    message: string;
    credential?: string;
    policyIds?: string[];
    amount?: number;
    program?: string;
  }): Promise<DaemonSignResult> {
    return daemonFetch<DaemonSignResult>(
      this.daemonUrl,
      '/api/v1/ows/sign/message',
      { method: 'POST', body: params, token: this.sessionToken },
    );
  }

  async signTransaction(params: {
    wallet: string;
    chain: string;
    txHex: string;
    credential?: string;
    policyIds?: string[];
    amount?: number;
    program?: string;
  }): Promise<DaemonSignResult> {
    return daemonFetch<DaemonSignResult>(
      this.daemonUrl,
      '/api/v1/ows/sign/transaction',
      { method: 'POST', body: params, token: this.sessionToken },
    );
  }

  async signAndSend(params: {
    wallet: string;
    chain: string;
    txHex: string;
    credential?: string;
    rpcUrl?: string;
    policyIds?: string[];
    amount?: number;
    program?: string;
  }): Promise<{ txHash: string }> {
    return daemonFetch<{ txHash: string }>(
      this.daemonUrl,
      '/api/v1/ows/sign/send',
      { method: 'POST', body: params, token: this.sessionToken },
    );
  }

  // -- Policies --

  async createPolicy(policy: {
    id: string;
    name: string;
    rules?: Array<{ type: string; [key: string]: unknown }>;
    executable?: string | null;
    config?: Record<string, unknown> | null;
  }): Promise<void> {
    await daemonFetch(
      this.daemonUrl,
      '/api/v1/ows/policies',
      { method: 'POST', body: policy, token: this.sessionToken },
    );
  }

  async listPolicies(): Promise<DaemonPolicy[]> {
    const res = await daemonFetch<{ policies: DaemonPolicy[] }>(
      this.daemonUrl,
      '/api/v1/ows/policies',
      { token: this.sessionToken },
    );
    return res.policies;
  }

  async getPolicy(id: string): Promise<DaemonPolicy> {
    const res = await daemonFetch<{ policy: DaemonPolicy }>(
      this.daemonUrl,
      `/api/v1/ows/policies/${encodeURIComponent(id)}`,
      { token: this.sessionToken },
    );
    return res.policy;
  }

  async deletePolicy(id: string): Promise<void> {
    await daemonFetch(
      this.daemonUrl,
      `/api/v1/ows/policies/${encodeURIComponent(id)}`,
      { method: 'DELETE', token: this.sessionToken },
    );
  }

  // -- API Keys --

  async createApiKey(params: {
    name: string;
    walletIds: string[];
    policyIds: string[];
    passphrase: string;
    expiresAt?: string;
  }): Promise<DaemonApiKey & { token: string }> {
    return daemonFetch<DaemonApiKey & { token: string }>(
      this.daemonUrl,
      '/api/v1/ows/keys',
      { method: 'POST', body: params, token: this.sessionToken },
    );
  }

  async listApiKeys(): Promise<DaemonApiKey[]> {
    const res = await daemonFetch<{ keys: DaemonApiKey[] }>(
      this.daemonUrl,
      '/api/v1/ows/keys',
      { token: this.sessionToken },
    );
    return res.keys;
  }

  async revokeApiKey(id: string): Promise<void> {
    await daemonFetch(
      this.daemonUrl,
      `/api/v1/ows/keys/${encodeURIComponent(id)}`,
      { method: 'DELETE', token: this.sessionToken },
    );
  }

  // -- Audit --

  async getAuditLog(limit = 50): Promise<Array<unknown>> {
    const res = await daemonFetch<{ log: Array<unknown> }>(
      this.daemonUrl,
      `/api/v1/ows/audit?limit=${limit}`,
      { token: this.sessionToken },
    );
    return res.log;
  }

  // -- Utility --

  async generateMnemonic(words: 12 | 24 = 12): Promise<string> {
    const res = await daemonFetch<{ mnemonic: string }>(
      this.daemonUrl,
      '/api/v1/ows/mnemonic/generate',
      { method: 'POST', body: { words }, token: this.sessionToken },
    );
    return res.mnemonic;
  }

  async deriveAddress(mnemonic: string, chain: string, index = 0): Promise<string> {
    const res = await daemonFetch<{ address: string }>(
      this.daemonUrl,
      '/api/v1/ows/derive',
      { method: 'POST', body: { mnemonic, chain, index }, token: this.sessionToken },
    );
    return res.address;
  }
}
