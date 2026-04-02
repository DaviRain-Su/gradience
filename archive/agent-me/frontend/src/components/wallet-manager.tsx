'use client';

import { address } from '@solana/kit';
import { useEffect, useMemo, useState } from 'react';
import { OpenWalletAdapter } from '@gradience/sdk';

import {
    loadActiveProfileId,
    loadProfiles,
    saveActiveProfileId,
    saveProfiles,
} from '../lib/wallet-storage';
import {
    createProfile,
    parseKeypairAddress,
    type WalletProfile,
} from '../lib/wallet-utils';

interface WalletManagerProps {
    onActiveAddressChange: (address: string | null) => void;
}

export function WalletManager({ onActiveAddressChange }: WalletManagerProps) {
    const [profiles, setProfiles] = useState<WalletProfile[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [hydrated, setHydrated] = useState(false);
    const [labelInput, setLabelInput] = useState('');
    const [openWalletAddressInput, setOpenWalletAddressInput] = useState('');
    const [keypairInput, setKeypairInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const storedProfiles = loadProfiles();
        const storedActive = loadActiveProfileId();
        setProfiles(storedProfiles);
        const activeExists = storedActive && storedProfiles.some((item) => item.id === storedActive);
        setActiveProfileId(activeExists ? storedActive : storedProfiles[0]?.id ?? null);
        setHydrated(true);
    }, []);

    const activeProfile = useMemo(
        () => profiles.find((item) => item.id === activeProfileId) ?? null,
        [profiles, activeProfileId],
    );

    useEffect(() => {
        if (!hydrated) {
            return;
        }
        saveProfiles(profiles);
    }, [hydrated, profiles]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }
        saveActiveProfileId(activeProfileId);
        onActiveAddressChange(activeProfile?.address ?? null);
    }, [hydrated, activeProfileId, activeProfile, onActiveAddressChange]);

    const addOpenWalletProfile = () => {
        setError(null);
        try {
            const parsedAddress = address(openWalletAddressInput.trim());
            new OpenWalletAdapter(parsedAddress);
            const profile = createProfile(
                'openwallet',
                labelInput,
                String(parsedAddress),
            );
            setProfiles((current) => [profile, ...current]);
            setActiveProfileId(profile.id);
            setLabelInput('');
            setOpenWalletAddressInput('');
        } catch (walletError) {
            setError(walletError instanceof Error ? walletError.message : String(walletError));
        }
    };

    const addLocalKeypairProfile = async () => {
        setError(null);
        try {
            const parsedAddress = await parseKeypairAddress(keypairInput.trim());
            const profile = createProfile(
                'local_keypair',
                labelInput,
                String(parsedAddress),
            );
            setProfiles((current) => [profile, ...current]);
            setActiveProfileId(profile.id);
            setLabelInput('');
            setKeypairInput('');
        } catch (walletError) {
            setError(walletError instanceof Error ? walletError.message : String(walletError));
        }
    };

    const removeProfile = (profileId: string) => {
        setProfiles((current) => {
            const next = current.filter((item) => item.id !== profileId);
            if (activeProfileId === profileId) {
                setActiveProfileId(next[0]?.id ?? null);
            }
            return next;
        });
    };

    return (
        <section className="panel">
            <h2>Wallet Management (OpenWallet)</h2>
            <p className="muted">
                Active wallet is used for reputation and task history queries.
            </p>
            {activeProfile ? (
                <p>
                    Active: <strong>{activeProfile.label}</strong> ({activeProfile.type})<br />
                    <span className="muted">{activeProfile.address}</span>
                </p>
            ) : (
                <p className="muted">No wallet selected.</p>
            )}
            <div className="grid" style={{ marginTop: 12 }}>
                <input
                    value={labelInput}
                    onChange={(event) => setLabelInput(event.target.value)}
                    placeholder="Wallet label (optional)"
                />
                <input
                    value={openWalletAddressInput}
                    onChange={(event) => setOpenWalletAddressInput(event.target.value)}
                    placeholder="OpenWallet address (base58)"
                />
                <button type="button" onClick={addOpenWalletProfile}>
                    Add OpenWallet profile
                </button>
                <textarea
                    value={keypairInput}
                    onChange={(event) => setKeypairInput(event.target.value)}
                    placeholder="Or import local keypair JSON [64 bytes]"
                    rows={4}
                />
                <button type="button" className="secondary" onClick={() => void addLocalKeypairProfile()}>
                    Add Local keypair profile
                </button>
                {error && <p className="error">{error}</p>}
            </div>

            <div style={{ marginTop: 16 }}>
                <h3>Saved profiles</h3>
                {profiles.length === 0 ? (
                    <p className="muted">No saved profiles yet.</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {profiles.map((profile) => (
                            <li
                                key={profile.id}
                                style={{
                                    borderTop: '1px solid #2d3557',
                                    padding: '8px 0',
                                    display: 'grid',
                                    gap: 6,
                                }}
                            >
                                <div>
                                    <strong>{profile.label}</strong> ({profile.type})
                                </div>
                                <div className="muted" style={{ wordBreak: 'break-all' }}>
                                    {profile.address}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveProfileId(profile.id)}
                                        className={activeProfileId === profile.id ? '' : 'secondary'}
                                    >
                                        {activeProfileId === profile.id ? 'Selected' : 'Use wallet'}
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => removeProfile(profile.id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
