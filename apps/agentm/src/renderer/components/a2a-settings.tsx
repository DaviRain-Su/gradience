/**
 * A2A Settings Component
 *
 * Settings for A2A multi-protocol communication
 *
 * @module components/a2a-settings
 */

import { useState, useEffect } from 'react';
import { useA2A } from '../hooks/useA2A.ts';

export interface A2ASettingsProps {
    /** Agent info for broadcasting */
    agentAddress: string;
    displayName: string;
    capabilities: string[];
}

export function A2ASettings({ agentAddress, displayName, capabilities }: A2ASettingsProps) {
    const [broadcastEnabled, setBroadcastEnabled] = useState(true);
    const [preferredProtocol, setPreferredProtocol] = useState<'nostr' | 'libp2p'>('nostr');

    const {
        isInitialized,
        isLoading,
        health,
        agents,
        refreshAgents,
        broadcastCapabilities,
    } = useA2A({
        autoInit: broadcastEnabled,
        enableNostr: true,
        enableXMTP: true,
    });

    // Auto-broadcast when enabled
    useEffect(() => {
        if (isInitialized && broadcastEnabled) {
            void broadcastCapabilities();
        }
    }, [isInitialized, broadcastEnabled]);

    return (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
            <h3 className="text-lg font-semibold">A2A Multi-Protocol</h3>

            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Status:</span>
                {isLoading ? (
                    <span className="text-amber-400">Initializing...</span>
                ) : isInitialized ? (
                    <span className="text-emerald-400">● Connected</span>
                ) : (
                    <span className="text-red-400">● Disconnected</span>
                )}
            </div>

            {/* Protocol Status */}
            {isInitialized && (
                <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-800 rounded">
                        Nostr: {health.protocolStatus.nostr.available ? '✓' : '✗'}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-800 rounded">
                        XMTP: {health.protocolStatus.xmtp.available ? '✓' : '✗'}
                    </span>
                </div>
            )}

            {/* Broadcast Toggle */}
            <div className="flex items-center justify-between">
                <span className="text-sm">Broadcast Presence</span>
                <button
                    onClick={() => setBroadcastEnabled(!broadcastEnabled)}
                    className={`w-12 h-6 rounded-full transition ${
                        broadcastEnabled ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                >
                    <span
                        className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                            broadcastEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {/* Preferred Protocol */}
            <div className="space-y-2">
                <span className="text-sm text-gray-500">Preferred Protocol</span>
                <select
                    value={preferredProtocol}
                    onChange={(e) => setPreferredProtocol(e.target.value as 'nostr' | 'libp2p')}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                    <option value="nostr">Nostr (Relay-based)</option>
                    <option value="libp2p">libp2p (Direct P2P)</option>
                </select>
            </div>

            {/* Discovered Agents */}
            {isInitialized && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Discovered Agents: {agents.length}
                        </span>
                        <button
                            onClick={() => void refreshAgents()}
                            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Broadcast */}
            {isInitialized && (
                <button
                    onClick={() => void broadcastCapabilities()}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition"
                >
                    Broadcast Capabilities Now
                </button>
            )}
        </div>
    );
}

export default A2ASettings;
