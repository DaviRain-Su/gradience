import type { AgentProfile } from '@/types';

export function ProfileCard({
    profile,
    onEdit,
    onPublish,
    onDeprecate,
    onDelete,
    disabled = false,
}: {
    profile: AgentProfile;
    onEdit: (profile: AgentProfile) => void;
    onPublish: (profile: AgentProfile) => void;
    onDeprecate: (profile: AgentProfile) => void;
    onDelete: (profile: AgentProfile) => void;
    disabled?: boolean;
}) {
    return (
        <div data-testid="profile-card" className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 data-testid="profile-card-name" className="text-lg font-semibold">{profile.name}</h3>
                    <p className="text-sm text-gray-400">{profile.description}</p>
                </div>
                <span
                    data-testid="profile-status-badge"
                    className={`text-xs px-2 py-1 rounded border ${
                        profile.status === 'published'
                            ? 'border-emerald-700 text-emerald-400'
                            : profile.status === 'deprecated'
                            ? 'border-amber-700 text-amber-400'
                            : 'border-gray-700 text-gray-400'
                    }`}
                >
                    {profile.status}
                </span>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-gray-800 rounded">v{profile.version}</span>
                <span className="px-2 py-1 bg-gray-800 rounded">{profile.pricing.model}</span>
                <span className="px-2 py-1 bg-gray-800 rounded">{profile.pricing.amount} lamports</span>
                {profile.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-800 rounded">
                        {tag}
                    </span>
                ))}
            </div>

            <div className="text-xs text-gray-500">
                Last updated {new Date(profile.updatedAt).toLocaleString()}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => onEdit(profile)}
                    data-testid="profile-edit-button"
                    disabled={disabled}
                    className="px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Edit
                </button>
                {profile.status !== 'published' && (
                    <button
                        onClick={() => onPublish(profile)}
                        data-testid="profile-publish-button"
                        disabled={disabled}
                        className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Publish
                    </button>
                )}
                {profile.status === 'published' && (
                    <button
                        onClick={() => onDeprecate(profile)}
                        data-testid="profile-deprecate-button"
                        disabled={disabled}
                        className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Deprecate
                    </button>
                )}
                <button
                    onClick={() => onDelete(profile)}
                    data-testid="profile-delete-button"
                    disabled={disabled}
                    className="px-3 py-2 rounded-lg border border-red-800 text-red-300 hover:bg-red-950 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Delete
                </button>
            </div>
        </div>
    );
}
