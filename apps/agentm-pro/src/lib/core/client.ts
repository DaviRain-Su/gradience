/**
 * AgentM Core SDK Client
 *
 * TypeScript client for the AgentM Core Solana program.
 * Handles agent registration, profile management, and reputation queries.
 *
 * NOTE: This is a preparatory SDK. The on-chain program (GRA-77) is not yet deployed.
 * Transaction building methods will be implemented once the program is live.
 */

import type {
    AgentAccount,
    AgentProfileOnChain,
    RegisterAgentInput,
    UpdateProfileInput,
} from './types';

const PROGRAM_ID = 'TBD'; // Will be set after GRA-77 deployment

/** PDA derivation seeds */
const AGENT_SEED = 'agent';
const PROFILE_SEED = 'profile';

export class AgentMCoreClient {
    private rpcUrl: string;

    constructor(rpcUrl?: string) {
        this.rpcUrl = rpcUrl ?? 'https://api.devnet.solana.com';
    }

    /** Derive AgentAccount PDA for a given owner */
    getAgentPDA(owner: string): { address: string; seeds: string[] } {
        return {
            address: `PDA(${AGENT_SEED}, ${owner})`,
            seeds: [AGENT_SEED, owner],
        };
    }

    /** Derive AgentProfile PDA for a given agent account */
    getProfilePDA(agentAccount: string): { address: string; seeds: string[] } {
        return {
            address: `PDA(${PROFILE_SEED}, ${agentAccount})`,
            seeds: [PROFILE_SEED, agentAccount],
        };
    }

    /** Fetch agent account from chain */
    async getAgent(owner: string): Promise<AgentAccount | null> {
        const pda = this.getAgentPDA(owner);
        const account = await this.fetchAccount(pda.address);
        if (!account) return null;
        return this.deserializeAgent(account);
    }

    /** Fetch agent profile from chain */
    async getProfile(agentAccount: string): Promise<AgentProfileOnChain | null> {
        const pda = this.getProfilePDA(agentAccount);
        const account = await this.fetchAccount(pda.address);
        if (!account) return null;
        return this.deserializeProfile(account);
    }

    /** Build register_agent instruction data */
    buildRegisterAgentData(input: RegisterAgentInput): Uint8Array {
        const encoder = new TextEncoder();
        const nameBytes = encoder.encode(input.name.slice(0, 64));
        const descBytes = encoder.encode(input.description.slice(0, 256));
        const websiteBytes = encoder.encode((input.website ?? '').slice(0, 128));
        const pricingModelByte = ['fixed', 'per_call', 'per_token'].indexOf(input.pricingModel);

        // Discriminator 0 = register_agent
        const data = new Uint8Array(1 + 4 + nameBytes.length + 4 + descBytes.length + 1 + 1 + 8 + 4 + websiteBytes.length);
        let offset = 0;

        data[offset++] = 0; // discriminator
        new DataView(data.buffer).setUint32(offset, nameBytes.length, true); offset += 4;
        data.set(nameBytes, offset); offset += nameBytes.length;
        new DataView(data.buffer).setUint32(offset, descBytes.length, true); offset += 4;
        data.set(descBytes, offset); offset += descBytes.length;
        data[offset++] = input.category;
        data[offset++] = pricingModelByte;
        // pricing_amount as u64 LE
        const view = new DataView(data.buffer);
        view.setBigUint64(offset, BigInt(input.pricingAmount), true); offset += 8;
        view.setUint32(offset, websiteBytes.length, true); offset += 4;
        data.set(websiteBytes, offset);

        return data;
    }

    /** Build update_profile instruction data */
    buildUpdateProfileData(input: UpdateProfileInput): Uint8Array {
        // Same structure as register, but discriminator = 1
        const data = this.buildRegisterAgentData(input as RegisterAgentInput);
        data[0] = 1; // update_profile discriminator
        return data;
    }

    private async fetchAccount(address: string): Promise<Uint8Array | null> {
        try {
            const res = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getAccountInfo',
                    params: [address, { encoding: 'base64' }],
                }),
            });
            const json = await res.json();
            if (!json.result?.value) return null;
            const base64Data = json.result.value.data[0];
            return Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        } catch {
            return null;
        }
    }

    private deserializeAgent(data: Uint8Array): AgentAccount {
        // Skip discriminator(1) + version(1)
        const view = new DataView(data.buffer, data.byteOffset);
        const statusByte = data[66]; // offset 2 + 32(owner) + 8(created_at) = 42... simplified
        return {
            owner: Array.from(data.slice(2, 34)).map((b) => b.toString(16).padStart(2, '0')).join(''),
            createdAt: Number(view.getBigInt64(34, true)),
            status: statusByte === 0 ? 'active' : 'deactivated',
            metaplexMint: null, // TODO: parse optional field
        };
    }

    private deserializeProfile(data: Uint8Array): AgentProfileOnChain {
        // Simplified — full implementation after program deployment
        const decoder = new TextDecoder();
        return {
            agent: '',
            name: decoder.decode(data.slice(36, 100)).replace(/\0/g, ''),
            description: decoder.decode(data.slice(104, 360)).replace(/\0/g, ''),
            category: data[360],
            pricingModel: (['fixed', 'per_call', 'per_token'] as const)[data[361]] ?? 'fixed',
            pricingAmount: 0,
            website: '',
            reputationAvgScore: 0,
            reputationCompleted: 0,
            reputationWinRate: 0,
            updatedAt: 0,
        };
    }
}
