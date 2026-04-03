/**
 * Google A2A Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleA2AAdapter } from './google-a2a-adapter.js';
import type { A2AMessage, AgentInfo } from '../../../shared/a2a-router-types.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GoogleA2AAdapter', () => {
    let adapter: GoogleA2AAdapter;

    beforeEach(() => {
        adapter = new GoogleA2AAdapter({
            solanaAddress: 'TestAgent111111111111111111111111',
            reputationScore: 85,
            knownPeers: [],
        });
        mockFetch.mockReset();
    });

    afterEach(async () => {
        await adapter.shutdown();
    });

    // ============ Lifecycle ============

    describe('lifecycle', () => {
        it('should initialize and shutdown cleanly', async () => {
            expect(adapter.isAvailable()).toBe(false);
            await adapter.initialize();
            expect(adapter.isAvailable()).toBe(true);
            await adapter.shutdown();
            expect(adapter.isAvailable()).toBe(false);
        });

        it('should report protocol as google-a2a', () => {
            expect(adapter.protocol).toBe('google-a2a');
        });
    });

    // ============ Agent Card ============

    describe('generateAgentCard', () => {
        it('should generate valid Agent Card with Gradience extensions', () => {
            const agentInfo: AgentInfo = {
                address: 'Alice111111111111111111111111111',
                displayName: 'Alice DeFi Agent',
                capabilities: ['smart-contract-audit', 'defi-analysis'],
                reputationScore: 92,
                available: true,
                discoveredVia: 'google-a2a',
                lastSeenAt: Date.now(),
            };

            const card = adapter.generateAgentCard(agentInfo);

            expect(card.name).toBe('Alice DeFi Agent');
            expect(card.url).toBeTruthy();
            expect(card.capabilities).toHaveLength(2);
            expect(card.capabilities[0].name).toBe('smart-contract-audit');
            expect(card.capabilities[0].tags).toContain('gradience');
            expect(card['x-gradience']).toBeDefined();
            expect(card['x-gradience']!.solanaAddress).toBe('Alice111111111111111111111111111');
            expect(card['x-gradience']!.reputationScore).toBe(92);
            expect(card.provider?.organization).toBe('Gradience Protocol');
        });
    });

    // ============ Discovery ============

    describe('discovery', () => {
        it('should discover agents from known peers', async () => {
            const mockCard = {
                name: 'Bob Auditor',
                description: 'Security audit agent',
                url: 'https://bob-agent.example.com/a2a',
                capabilities: [{ id: 'audit', name: 'Security Audit', description: 'Audit smart contracts' }],
                'x-gradience': {
                    solanaAddress: 'Bob111111111111111111111111111111',
                    reputationScore: 88,
                    protocolVersion: '0.1.0',
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCard,
            });

            adapter = new GoogleA2AAdapter({
                knownPeers: ['https://bob-agent.example.com/.well-known/agent.json'],
            });
            await adapter.initialize();

            const agents = await adapter.discoverAgents();
            expect(agents).toHaveLength(1);
            expect(agents[0].displayName).toBe('Bob Auditor');
            expect(agents[0].address).toBe('Bob111111111111111111111111111111');
            expect(agents[0].reputationScore).toBe(88);
            expect(agents[0].discoveredVia).toBe('google-a2a');
            expect(agents[0].googleA2AEndpoint).toBe('https://bob-agent.example.com/a2a');
        });

        it('should filter agents by capabilities', async () => {
            const mockCard = {
                name: 'Charlie Data',
                description: 'Data analysis agent',
                url: 'https://charlie.example.com/a2a',
                capabilities: [
                    { id: 'data', name: 'Data Analysis', description: 'Analyze data' },
                ],
                'x-gradience': {
                    solanaAddress: 'Charlie1111111111111111111111111',
                    reputationScore: 75,
                    protocolVersion: '0.1.0',
                },
            };

            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockCard });

            adapter = new GoogleA2AAdapter({
                knownPeers: ['https://charlie.example.com/.well-known/agent.json'],
            });
            await adapter.initialize();

            const noMatch = await adapter.discoverAgents({ capabilities: ['audit'] });
            expect(noMatch).toHaveLength(0);

            const match = await adapter.discoverAgents({ capabilities: ['Data Analysis'] });
            expect(match).toHaveLength(1);
        });

        it('should handle unreachable peers gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            adapter = new GoogleA2AAdapter({
                knownPeers: ['https://unreachable.example.com/.well-known/agent.json'],
            });
            await adapter.initialize();

            const agents = await adapter.discoverAgents();
            expect(agents).toHaveLength(0);
        });
    });

    // ============ Messaging ============

    describe('send', () => {
        it('should send message via JSON-RPC to discovered agent', async () => {
            const mockCard = {
                name: 'Target Agent',
                url: 'https://target.example.com/a2a',
                capabilities: [],
                'x-gradience': {
                    solanaAddress: 'Target11111111111111111111111111',
                    reputationScore: 90,
                    protocolVersion: '0.1.0',
                },
            };

            // First call: fetch agent card
            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockCard });
            // Second call: send JSON-RPC
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    id: 'msg-1',
                    result: { id: 'task-1', status: { state: 'working' } },
                }),
            });

            adapter = new GoogleA2AAdapter({
                knownPeers: ['https://target.example.com/.well-known/agent.json'],
                solanaAddress: 'Sender11111111111111111111111111',
            });
            await adapter.initialize();

            const message: A2AMessage = {
                id: 'msg-1',
                from: 'Sender11111111111111111111111111',
                to: 'Target11111111111111111111111111',
                type: 'task_proposal',
                timestamp: Date.now(),
                payload: { description: 'Audit my contract', reward: 5000000000 },
            };

            const result = await adapter.send(message);
            expect(result.success).toBe(true);
            expect(result.protocol).toBe('google-a2a');

            // Verify the JSON-RPC request was correct
            const rpcCall = mockFetch.mock.calls[1];
            const body = JSON.parse(rpcCall[1].body);
            expect(body.jsonrpc).toBe('2.0');
            expect(body.method).toBe('tasks/send');
            expect(body.params.metadata['x-gradience-from']).toBe('Sender11111111111111111111111111');
            expect(body.params.metadata['x-gradience-type']).toBe('task_proposal');
        });

        it('should return error for unknown recipient', async () => {
            await adapter.initialize();

            const message: A2AMessage = {
                id: 'msg-2',
                from: 'Sender11111111111111111111111111',
                to: 'Unknown1111111111111111111111111',
                type: 'direct_message',
                timestamp: Date.now(),
                payload: 'Hello!',
            };

            const result = await adapter.send(message);
            expect(result.success).toBe(false);
            expect(result.error).toContain('No Google A2A endpoint found');
        });
    });

    // ============ Incoming Requests ============

    describe('handleIncomingRequest', () => {
        it('should handle tasks/send and dispatch to message handler', async () => {
            await adapter.initialize();

            const received: A2AMessage[] = [];
            await adapter.subscribe((msg) => { received.push(msg); });

            const response = await adapter.handleIncomingRequest({
                jsonrpc: '2.0',
                id: 'req-1',
                method: 'tasks/send',
                params: {
                    id: 'task-42',
                    status: {
                        state: 'submitted',
                        message: {
                            role: 'user',
                            parts: [{ type: 'text', text: 'Please audit this contract' }],
                        },
                    },
                    metadata: {
                        'x-gradience-from': 'ExternalAgent111111111111111111',
                        'x-gradience-type': 'task_proposal',
                    },
                },
            });

            expect(response.result).toBeDefined();
            expect((response.result as Record<string, unknown>).id).toBe('task-42');
            expect(received).toHaveLength(1);
            expect(received[0].from).toBe('ExternalAgent111111111111111111');
            expect(received[0].type).toBe('task_proposal');
            expect(received[0].payload).toBe('Please audit this contract');
        });

        it('should handle tasks/cancel', async () => {
            await adapter.initialize();

            const response = await adapter.handleIncomingRequest({
                jsonrpc: '2.0',
                id: 'req-2',
                method: 'tasks/cancel',
                params: { id: 'task-42' },
            });

            expect((response.result as Record<string, unknown>).id).toBe('task-42');
            const result = response.result as { status: { state: string } };
            expect(result.status.state).toBe('canceled');
        });

        it('should return error for unknown method', async () => {
            await adapter.initialize();

            const response = await adapter.handleIncomingRequest({
                jsonrpc: '2.0',
                id: 'req-3',
                method: 'unknown/method',
            });

            expect(response.error).toBeDefined();
            expect(response.error!.code).toBe(-32601);
        });
    });

    // ============ Health ============

    describe('health', () => {
        it('should report health status', async () => {
            const health = adapter.health();
            expect(health.available).toBe(false);

            await adapter.initialize();
            const healthAfter = adapter.health();
            expect(healthAfter.available).toBe(true);
            expect(healthAfter.peerCount).toBe(0);
        });
    });
});
