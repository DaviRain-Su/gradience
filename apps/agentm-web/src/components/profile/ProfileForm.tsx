'use client';

import { useEffect, useState } from 'react';
import type { AgentProfile, ProfileDraft, PricingModel } from '@/types/profile';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

const EMPTY_DRAFT: ProfileDraft = {
    name: '',
    description: '',
    version: '1.0.0',
    capabilities: [{ id: 'default-capability', name: '', description: '' }],
    pricing: { model: 'per_call', amount: 1000000, currency: 'SOL' },
    tags: [],
    website: '',
};

interface ProfileFormProps {
    initialProfile?: AgentProfile | null;
    submitting: boolean;
    onSubmit: (draft: ProfileDraft) => Promise<void>;
    onCancel: () => void;
}

export function ProfileForm({ initialProfile, submitting, onSubmit, onCancel }: ProfileFormProps) {
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

    const pushTag = (raw: string) => {
        const tag = raw.trim();
        if (!tag) return;
        setDraft((prev) => (prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] }));
        setTagInput('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        await onSubmit(normalizeDraft(draft));
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                background: c.surface,
                border: `1.5px solid ${c.ink}`,
                borderRadius: '24px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
            }}
        >
            <h2
                style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '24px',
                    fontWeight: 700,
                    color: c.ink,
                    margin: 0,
                }}
            >
                {initialProfile ? 'Edit Profile' : 'Create Profile'}
            </h2>

            {/* Name */}
            <div>
                <label
                    style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: c.ink, marginBottom: '6px' }}
                >
                    Name
                </label>
                <input
                    data-testid="profile-name-input"
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: c.bg,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: c.ink,
                        outline: 'none',
                    }}
                    placeholder="My Agent"
                    required
                />
            </div>

            {/* Description */}
            <div>
                <label
                    style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: c.ink, marginBottom: '6px' }}
                >
                    Description
                </label>
                <textarea
                    data-testid="profile-description-input"
                    value={draft.description}
                    onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: c.bg,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: c.ink,
                        minHeight: '100px',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                    }}
                    placeholder="Describe what your agent does"
                    required
                />
            </div>

            {/* Version, Pricing Model, Price */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: c.ink,
                            marginBottom: '6px',
                        }}
                    >
                        Version
                    </label>
                    <input
                        data-testid="profile-version-input"
                        value={draft.version}
                        onChange={(e) => setDraft((prev) => ({ ...prev, version: e.target.value }))}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: c.bg,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: c.ink,
                            outline: 'none',
                        }}
                        placeholder="1.0.0"
                        required
                    />
                </div>
                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: c.ink,
                            marginBottom: '6px',
                        }}
                    >
                        Pricing Model
                    </label>
                    <select
                        data-testid="profile-pricing-model-select"
                        value={draft.pricing.model}
                        onChange={(e) =>
                            setDraft((prev) => ({
                                ...prev,
                                pricing: { ...prev.pricing, model: e.target.value as PricingModel },
                            }))
                        }
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: c.bg,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: c.ink,
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="fixed">fixed</option>
                        <option value="per_call">per_call</option>
                        <option value="per_token">per_token</option>
                    </select>
                </div>
                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: c.ink,
                            marginBottom: '6px',
                        }}
                    >
                        Price (lamports)
                    </label>
                    <input
                        data-testid="profile-pricing-amount-input"
                        type="number"
                        min={1}
                        value={draft.pricing.amount}
                        onChange={(e) =>
                            setDraft((prev) => ({
                                ...prev,
                                pricing: { ...prev.pricing, amount: Number(e.target.value) || 0 },
                            }))
                        }
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: c.bg,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: c.ink,
                            outline: 'none',
                        }}
                        required
                    />
                </div>
            </div>

            {/* Capability */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: c.ink }}>Capability</label>
                <input
                    data-testid="profile-capability-name-input"
                    value={draft.capabilities[0]?.name ?? ''}
                    onChange={(e) =>
                        setDraft((prev) => ({
                            ...prev,
                            capabilities: [
                                {
                                    id: prev.capabilities[0]?.id ?? 'default-capability',
                                    name: e.target.value,
                                    description: prev.capabilities[0]?.description ?? '',
                                },
                            ],
                        }))
                    }
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: c.bg,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: c.ink,
                        outline: 'none',
                    }}
                    placeholder="text-generation"
                />
                <textarea
                    data-testid="profile-capability-description-input"
                    value={draft.capabilities[0]?.description ?? ''}
                    onChange={(e) =>
                        setDraft((prev) => ({
                            ...prev,
                            capabilities: [
                                {
                                    id: prev.capabilities[0]?.id ?? 'default-capability',
                                    name: prev.capabilities[0]?.name ?? '',
                                    description: e.target.value,
                                },
                            ],
                        }))
                    }
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: c.bg,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: c.ink,
                        minHeight: '80px',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'inherit',
                    }}
                    placeholder="What this capability can do"
                />
            </div>

            {/* Website */}
            <div>
                <label
                    style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: c.ink, marginBottom: '6px' }}
                >
                    Website (optional)
                </label>
                <input
                    data-testid="profile-website-input"
                    value={draft.website ?? ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, website: e.target.value }))}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: c.bg,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: c.ink,
                        outline: 'none',
                    }}
                    placeholder="https://your-agent.site"
                />
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: c.ink }}>Tags</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        data-testid="profile-tag-input"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            pushTag(tagInput);
                        }}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            background: c.bg,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: c.ink,
                            outline: 'none',
                        }}
                        placeholder="Add tag and press Enter"
                    />
                    <button
                        type="button"
                        onClick={() => pushTag(tagInput)}
                        data-testid="profile-add-tag-button"
                        style={{
                            padding: '12px 20px',
                            background: c.lavender,
                            color: c.ink,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#B8ACFF';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = c.lavender;
                        }}
                    >
                        Add
                    </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                            style={{
                                fontSize: '12px',
                                padding: '6px 12px',
                                background: c.lime,
                                border: `1.5px solid ${c.ink}`,
                                borderRadius: '8px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#C5F54A';
                                e.currentTarget.style.opacity = '0.8';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = c.lime;
                                e.currentTarget.style.opacity = '1';
                            }}
                        >
                            {tag} ×
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button
                    type="submit"
                    data-testid="profile-submit-button"
                    disabled={submitting}
                    style={{
                        padding: '12px 24px',
                        background: c.ink,
                        color: c.surface,
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!submitting) {
                            e.currentTarget.style.background = '#2D2D33';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = c.ink;
                    }}
                >
                    {submitting ? 'Saving...' : initialProfile ? 'Save Changes' : 'Create Profile'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        padding: '12px 24px',
                        background: 'transparent',
                        color: c.ink,
                        border: `1.5px solid ${c.ink}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = c.bg;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
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
