'use client';

import { useEffect, useState } from 'react';
import type { AgentProfile, ProfileDraft, PricingModel } from '@/types';

const EMPTY_DRAFT: ProfileDraft = {
    name: '',
    description: '',
    version: '1.0.0',
    capabilities: [{ id: 'default-capability', name: '', description: '' }],
    pricing: { model: 'per_call', amount: 1000000, currency: 'SOL' },
    tags: [],
    website: '',
};

export function ProfileForm({
    initialProfile,
    submitting,
    onSubmit,
    onCancel,
}: {
    initialProfile?: AgentProfile | null;
    submitting: boolean;
    onSubmit: (draft: ProfileDraft) => Promise<void>;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (!initialProfile) {
            setDraft(EMPTY_DRAFT);
            return;
        }
        setDraft({
            name: initialProfile.name,
            description: initialProfile.description,
            version: initialProfile.version,
            capabilities: initialProfile.capabilities,
            pricing: initialProfile.pricing,
            tags: initialProfile.tags,
            website: initialProfile.website ?? '',
        });
    }, [initialProfile]);

    return (
        <form
            className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-5"
            onSubmit={async (event) => {
                event.preventDefault();
                await onSubmit(normalizeDraft(draft));
            }}
        >
            <h2 className="text-xl font-semibold">{initialProfile ? 'Edit Profile' : 'Create Profile'}</h2>

            <label className="block text-sm">
                <span className="text-gray-300">Name</span>
                <input
                    data-testid="profile-name-input"
                    value={draft.name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                    className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="My Agent"
                    required
                />
            </label>

            <label className="block text-sm">
                <span className="text-gray-300">Description</span>
                <textarea
                    data-testid="profile-description-input"
                    value={draft.description}
                    onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                    className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 min-h-28"
                    placeholder="Describe what your agent does"
                    required
                />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block text-sm">
                    <span className="text-gray-300">Version</span>
                    <input
                        data-testid="profile-version-input"
                        value={draft.version}
                        onChange={(event) => setDraft((prev) => ({ ...prev, version: event.target.value }))}
                        className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                        placeholder="1.0.0"
                        required
                    />
                </label>
                <label className="block text-sm">
                    <span className="text-gray-300">Pricing Model</span>
                    <select
                        data-testid="profile-pricing-model-select"
                        value={draft.pricing.model}
                        onChange={(event) =>
                            setDraft((prev) => ({
                                ...prev,
                                pricing: { ...prev.pricing, model: event.target.value as PricingModel },
                            }))
                        }
                        className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                    >
                        <option value="fixed">fixed</option>
                        <option value="per_call">per_call</option>
                        <option value="per_token">per_token</option>
                    </select>
                </label>
                <label className="block text-sm">
                    <span className="text-gray-300">Price (lamports)</span>
                    <input
                        data-testid="profile-pricing-amount-input"
                        type="number"
                        min={1}
                        value={draft.pricing.amount}
                        onChange={(event) =>
                            setDraft((prev) => ({
                                ...prev,
                                pricing: { ...prev.pricing, amount: Number(event.target.value) || 0 },
                            }))
                        }
                        className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                        required
                    />
                </label>
            </div>

            <div className="space-y-2">
                <p className="text-sm text-gray-300">Capability</p>
                <input
                    data-testid="profile-capability-name-input"
                    value={draft.capabilities[0]?.name ?? ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            capabilities: [
                                {
                                    id: prev.capabilities[0]?.id ?? 'default-capability',
                                    name: event.target.value,
                                    description: prev.capabilities[0]?.description ?? '',
                                },
                            ],
                        }))
                    }
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="text-generation"
                />
                <textarea
                    data-testid="profile-capability-description-input"
                    value={draft.capabilities[0]?.description ?? ''}
                    onChange={(event) =>
                        setDraft((prev) => ({
                            ...prev,
                            capabilities: [
                                {
                                    id: prev.capabilities[0]?.id ?? 'default-capability',
                                    name: prev.capabilities[0]?.name ?? '',
                                    description: event.target.value,
                                },
                            ],
                        }))
                    }
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 min-h-20"
                    placeholder="What this capability can do"
                />
            </div>

            <label className="block text-sm">
                <span className="text-gray-300">Website (optional)</span>
                <input
                    data-testid="profile-website-input"
                    value={draft.website ?? ''}
                    onChange={(event) => setDraft((prev) => ({ ...prev, website: event.target.value }))}
                    className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                    placeholder="https://your-agent.site"
                />
            </label>

            <div className="space-y-2">
                <p className="text-sm text-gray-300">Tags</p>
                <div className="flex gap-2">
                    <input
                        data-testid="profile-tag-input"
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            pushTag(tagInput);
                        }}
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                        placeholder="Add tag and press Enter"
                    />
                    <button
                        type="button"
                        onClick={() => pushTag(tagInput)}
                        data-testid="profile-add-tag-button"
                        className="px-3 py-2 border border-gray-700 rounded-lg hover:border-gray-500 transition"
                    >
                        Add
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {draft.tags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() =>
                                setDraft((prev) => ({
                                    ...prev,
                                    tags: prev.tags.filter((candidate) => candidate !== tag),
                                }))
                            }
                            className="px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700"
                        >
                            {tag} ×
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    type="submit"
                    data-testid="profile-submit-button"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                    {submitting ? 'Saving...' : initialProfile ? 'Save Changes' : 'Create Profile'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-700 hover:border-gray-500 rounded-lg text-sm transition"
                >
                    Cancel
                </button>
            </div>
        </form>
    );

    function pushTag(raw: string) {
        const tag = raw.trim();
        if (!tag) return;
        setDraft((prev) => (prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] }));
        setTagInput('');
    }
}

function normalizeDraft(draft: ProfileDraft): ProfileDraft {
    return {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        version: draft.version.trim(),
        website: draft.website?.trim() || undefined,
        tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
        capabilities: draft.capabilities
            .map((capability, index) => ({
                id: capability.id || `capability-${index + 1}`,
                name: capability.name.trim(),
                description: capability.description.trim(),
            }))
            .filter((capability) => capability.name.length > 0 || capability.description.length > 0),
    };
}
