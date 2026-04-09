/**
 * Soul Profile Hook
 *
 * Manage Soul Profile state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import type { SoulProfile } from '@gradiences/soul-engine';
import { SoulParser } from '@gradiences/soul-engine';
import { useIPFSStorage } from './useIPFSStorage.ts';

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

    /** Upload to IPFS */
    uploadToIPFS: () => Promise<string | null>;

    /** Current CID if uploaded */
    cid: string | null;
}

export function useSoulProfile(options: UseSoulProfileOptions = {}): UseSoulProfileReturn {
    const [profile, setProfile] = useState<SoulProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cid, setCid] = useState<string | null>(null);

    const { upload, uploading: uploadingToIPFS } = useIPFSStorage();

    // Load profile from localStorage
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const stored = localStorage.getItem('soul-profile');
            const storedCid = localStorage.getItem('soul-profile-cid');

            if (stored) {
                const data = JSON.parse(stored);
                setProfile(data);
            }

            if (storedCid) {
                setCid(storedCid);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load profile');
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
                // Merge with existing profile or create new
                const updated: SoulProfile = profile
                    ? { ...profile, ...partial, updatedAt: Date.now() }
                    : ({
                          id: crypto.randomUUID(),
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

                localStorage.setItem('soul-profile', JSON.stringify(updated));
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

    // Upload to IPFS
    const uploadToIPFS = useCallback(async (): Promise<string | null> => {
        if (!profile) return null;

        try {
            const markdown = SoulParser.stringify(profile);
            const newCid = await upload(markdown, `${profile.identity.displayName}-soul.md`);

            localStorage.setItem('soul-profile-cid', newCid);
            setCid(newCid);

            // Update profile with CID
            const updated = { ...profile, storage: { ...profile.storage, cid: newCid } };
            localStorage.setItem('soul-profile', JSON.stringify(updated));
            setProfile(updated);

            console.log('[useSoulProfile] Uploaded to IPFS:', newCid);
            return newCid;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload to IPFS');
            return null;
        }
    }, [profile, upload]);

    // Delete profile
    const remove = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            localStorage.removeItem('soul-profile');
            localStorage.removeItem('soul-profile-cid');
            setProfile(null);
            setCid(null);
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
            return SoulParser.stringify(profile);
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
        loading: loading || uploadingToIPFS,
        error,
        load,
        save,
        remove,
        exportMarkdown,
        uploadToIPFS,
        cid,
    };
}
