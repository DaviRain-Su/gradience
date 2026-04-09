'use client';
/**
 * Soul Profile Hook
 *
 * Manage Soul Profile state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import type { SoulProfile } from '@/types/soul';

interface UseSoulProfileOptions {
    /** Auto-load on mount */
    autoLoad?: boolean;
}

interface UseSoulProfileReturn {
    /** Current profile */
    profile: SoulProfile | null;

    /** Loading state */
    loading: boolean;

    /** Error message */
    error: string | null;

    /** Load profile from storage */
    load: () => Promise<void>;

    /** Save profile to storage */
    save: (profile: Partial<SoulProfile>) => Promise<void>;

    /** Delete profile */
    remove: () => Promise<void>;

    /** Export as Markdown */
    exportMarkdown: () => string | null;

    /** Current CID if uploaded */
    cid: string | null;
}

const STORAGE_KEY = 'agentm-soul-profile';
const CID_KEY = 'agentm-soul-profile-cid';

export function useSoulProfile(options: UseSoulProfileOptions = {}): UseSoulProfileReturn {
    const [profile, setProfile] = useState<SoulProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cid, setCid] = useState<string | null>(null);

    // Load profile from localStorage
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Check if we're in a browser environment
            if (typeof window === 'undefined') {
                setLoading(false);
                return;
            }

            const stored = localStorage.getItem(STORAGE_KEY);
            const storedCid = localStorage.getItem(CID_KEY);

            if (stored) {
                const data = JSON.parse(stored) as SoulProfile;
                setProfile(data);
            }

            if (storedCid) {
                setCid(storedCid);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load profile');
            console.error('[useSoulProfile] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Save profile to localStorage
    const save = useCallback(
        async (partial: Partial<SoulProfile>) => {
            setLoading(true);
            setError(null);

            try {
                if (typeof window === 'undefined') {
                    throw new Error('Cannot save profile: not in browser environment');
                }

                // Merge with existing profile or create new
                const updated: SoulProfile = profile
                    ? { ...profile, ...partial, updatedAt: Date.now() }
                    : ({
                          id: generateId(),
                          version: '1.0',
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                          storage: {
                              contentHash: '',
                              embeddingHash: '',
                              storageType: 'ipfs',
                              cid: cid || '',
                          },
                          ...partial,
                      } as SoulProfile);

                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                setProfile(updated);

                console.log('[useSoulProfile] Profile saved:', updated.id);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save profile');
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [profile, cid],
    );

    // Delete profile
    const remove = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (typeof window === 'undefined') {
                throw new Error('Cannot remove profile: not in browser environment');
            }

            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CID_KEY);
            setProfile(null);
            setCid(null);

            console.log('[useSoulProfile] Profile removed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete profile');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Export as Markdown
    const exportMarkdown = useCallback(() => {
        if (!profile) return null;

        try {
            return stringifySoulProfile(profile);
        } catch (err) {
            console.error('[useSoulProfile] Export failed:', err);
            return null;
        }
    }, [profile]);

    // Auto-load on mount
    useEffect(() => {
        if (options.autoLoad) {
            void load();
        }
    }, [options.autoLoad, load]);

    return {
        profile,
        loading,
        error,
        load,
        save,
        remove,
        exportMarkdown,
        cid,
    };
}

// Generate a unique ID
function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// Convert SoulProfile to Markdown
function stringifySoulProfile(profile: SoulProfile): string {
    const sections = [
        `# ${profile.identity.displayName}`,
        '',
        `**Type:** ${profile.soulType}`,
        `**ID:** ${profile.id}`,
        `**Version:** ${profile.version}`,
        '',
        '## Bio',
        profile.identity.bio,
        '',
        '## Core Values',
        ...profile.values.core.map((v) => `- ${v}`),
        '',
        '## Priorities',
        ...profile.values.priorities.map((p) => `- ${p}`),
        '',
        '## Interests',
        ...profile.interests.topics.map((t) => `- ${t}`),
        '',
        '## Skills',
        ...profile.interests.skills.map((s) => `- ${s}`),
        '',
        '## Communication Style',
        `- **Tone:** ${profile.communication.tone}`,
        `- **Pace:** ${profile.communication.pace}`,
        `- **Depth:** ${profile.communication.depth}`,
        '',
        '## Boundaries',
        `- **Privacy Level:** ${profile.boundaries.privacyLevel}`,
        `- **Max Conversation Length:** ${profile.boundaries.maxConversationLength} turns`,
        ...(profile.boundaries.forbiddenTopics.length > 0
            ? ['', '### Forbidden Topics', ...profile.boundaries.forbiddenTopics.map((t) => `- ${t}`)]
            : []),
        '',
        '---',
        `*Generated on ${new Date(profile.updatedAt).toISOString()}*`,
    ];

    return sections.join('\n');
}
