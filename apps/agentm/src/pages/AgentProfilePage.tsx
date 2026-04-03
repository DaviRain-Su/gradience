/**
 * Agent Profile Page with Domain
 *
 * Example page showing Agent Profile with SNS/ENS domain integration
 *
 * @module pages/AgentProfilePage
 */

import { useState } from 'react';
import {
    DomainBadge,
    DomainBadgeLink,
    DomainLinkForm,
} from '../components/social/profile';
import { useDomainProfile } from '../renderer/hooks/useDomain';

interface AgentProfilePageProps {
    /** Agent wallet address */
    address: string;
    /** Agent display name */
    displayName?: string;
    /** Agent bio */
    bio?: string;
    /** Agent capabilities */
    capabilities?: string[];
}

/**
 * Agent Profile Page with Domain Support
 */
export function AgentProfilePage({
    address,
    displayName,
    bio,
    capabilities = [],
}: AgentProfilePageProps) {
    const [linkedDomain, setLinkedDomain] = useState<string | undefined>();
    const [isLinking, setIsLinking] = useState(false);

    const { domain, loading: domainLoading } = useDomainProfile({
        address,
        autoResolve: true,
    });

    const handleLinkDomain = async (domain: string) => {
        setIsLinking(true);
        // TODO: Call API to link domain to profile
        console.log('Linking domain:', domain);
        await new Promise((r) => setTimeout(r, 1000));
        setLinkedDomain(domain);
        setIsLinking(false);
    };

    const handleUnlinkDomain = async () => {
        setIsLinking(true);
        // TODO: Call API to unlink domain
        console.log('Unlinking domain');
        await new Promise((r) => setTimeout(r, 1000));
        setLinkedDomain(undefined);
        setIsLinking(false);
    };

    const effectiveDomain = linkedDomain || domain || undefined;

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        {/* Domain Badge */}
                        <div className="flex items-center gap-3">
                            {domainLoading ? (
                                <span className="text-sm text-gray-500">Loading domain...</span>
                            ) : effectiveDomain ? (
                                <DomainBadgeLink
                                    domain={effectiveDomain}
                                    size="lg"
                                />
                            ) : (
                                <DomainBadge
                                    address={address}
                                    size="lg"
                                    showCopy
                                />
                            )}
                        </div>

                        {/* Display Name */}
                        <h1 className="text-2xl font-bold text-white">
                            {displayName || effectiveDomain || 'Unnamed Agent'}
                        </h1>

                        {/* Address (if domain exists) */}
                        {effectiveDomain && (
                            <p className="text-sm text-gray-400 font-mono">
                                {address.slice(0, 6)}...{address.slice(-4)}
                            </p>
                        )}
                    </div>

                    {/* Avatar placeholder */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-3xl">
                        🤖
                    </div>
                </div>

                {/* Bio */}
                {bio && (
                    <p className="mt-4 text-gray-300">{bio}</p>
                )}

                {/* Capabilities */}
                {capabilities.length > 0 && (
                    <div className="mt-4">
                        <p className="text-sm text-gray-400 mb-2">Capabilities</p>
                        <div className="flex flex-wrap gap-2">
                            {capabilities.map((cap, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-sm"
                                >
                                    {cap}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Domain Management */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">Domain Management</h2>
                <DomainLinkForm
                    currentDomain={effectiveDomain}
                    walletAddress={address}
                    onLink={handleLinkDomain}
                    onUnlink={handleUnlinkDomain}
                    loading={isLinking}
                />
            </div>

            {/* Share Profile */}
            {effectiveDomain && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Share Profile</h2>
                    <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg">
                        <code className="flex-1 text-sm text-purple-300">
                            https://gradience.io/agent/{effectiveDomain}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`https://gradience.io/agent/${effectiveDomain}`);
                            }}
                            className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AgentProfilePage;
