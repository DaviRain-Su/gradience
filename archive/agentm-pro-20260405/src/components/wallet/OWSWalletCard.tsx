'use client';

import { useOWS, isOWSAvailable } from '@/hooks/useOWS';
import { useAuth } from '@/hooks/useAuth';

export function OWSWalletCard() {
    const { connected, connecting, identity, error, connect, disconnect } = useOWS();
    const { publicKey } = useAuth();

    const displayAddress = identity?.address ?? publicKey;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-400">Wallet</p>
                    <p className="text-lg font-semibold mt-1">
                        {connected ? 'OWS Connected' : publicKey ? 'Privy (Embedded)' : 'Not Connected'}
                    </p>
                </div>
                <StatusDot connected={connected || !!publicKey} />
            </div>

            {displayAddress && (
                <div className="bg-gray-950 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm font-mono mt-1 truncate">{displayAddress}</p>
                </div>
            )}

            {identity?.did && (
                <div className="bg-gray-950 rounded-lg p-3">
                    <p className="text-xs text-gray-500">DID</p>
                    <p className="text-sm font-mono mt-1 truncate">{identity.did}</p>
                </div>
            )}

            {identity?.credentials && identity.credentials.length > 0 && (
                <div className="bg-gray-950 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Credentials</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {identity.credentials.map((cred, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                                {cred.type}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
                {!connected && isOWSAvailable() && (
                    <button
                        onClick={connect}
                        disabled={connecting}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                    >
                        {connecting ? 'Connecting...' : 'Connect OWS Wallet'}
                    </button>
                )}
                {connected && (
                    <button
                        onClick={disconnect}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        Disconnect
                    </button>
                )}
            </div>
        </div>
    );
}

function StatusDot({ connected }: { connected: boolean }) {
    return <span className={`inline-block w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />;
}
