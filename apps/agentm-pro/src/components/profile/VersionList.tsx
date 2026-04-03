import type { AgentProfile } from '@/types';

export function VersionList({
    selectedProfile,
    relatedProfiles,
}: {
    selectedProfile: AgentProfile | null;
    relatedProfiles: AgentProfile[];
}) {
    if (!selectedProfile) {
        return null;
    }

    const versions = relatedProfiles
        .filter((profile) => profile.name === selectedProfile.name)
        .sort((a, b) => b.updatedAt - a.updatedAt);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Version History</h3>
            {versions.length === 0 && <p className="text-sm text-gray-500">No versions yet.</p>}
            {versions.map((profile) => (
                <div
                    key={profile.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                >
                    <div>
                        <p className="text-sm font-medium">v{profile.version}</p>
                        <p className="text-xs text-gray-500">{new Date(profile.updatedAt).toLocaleString()}</p>
                    </div>
                    <span className="text-xs text-gray-400">{profile.status}</span>
                </div>
            ))}
        </div>
    );
}
