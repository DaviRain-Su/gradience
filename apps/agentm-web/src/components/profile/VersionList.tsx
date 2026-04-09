'use client';

import type { AgentProfile } from '@/types/profile';

const c = {
    bg: '#F3F3F8',
    surface: '#FFFFFF',
    ink: '#16161A',
    lavender: '#C6BBFF',
    lime: '#CDFF4D',
};

interface VersionListProps {
    selectedProfile: AgentProfile | null;
    relatedProfiles: AgentProfile[];
}

export function VersionList({ selectedProfile, relatedProfiles }: VersionListProps) {
    if (!selectedProfile) {
        return null;
    }

    const versions = relatedProfiles
        .filter((profile) => profile.name === selectedProfile.name)
        .sort((a, b) => b.updatedAt - a.updatedAt);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published':
                return '#10B981';
            case 'deprecated':
                return '#F59E0B';
            default:
                return '#6B7280';
        }
    };

    return (
        <div
            style={{
                background: c.surface,
                border: `1.5px solid ${c.ink}`,
                borderRadius: '24px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}
        >
            <h3
                style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: '18px',
                    fontWeight: 700,
                    color: c.ink,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                }}
            >
                Version History
            </h3>

            {versions.length === 0 && (
                <p style={{ fontSize: '14px', color: c.ink, opacity: 0.6, margin: 0 }}>No versions yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {versions.map((profile) => (
                    <div
                        key={profile.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: c.bg,
                            border: `1.5px solid ${c.ink}`,
                            borderRadius: '12px',
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: c.ink,
                                    margin: 0,
                                    marginBottom: '2px',
                                }}
                            >
                                v{profile.version}
                            </p>
                            <p style={{ fontSize: '12px', color: c.ink, opacity: 0.5, margin: 0 }}>
                                {new Date(profile.updatedAt).toLocaleString()}
                            </p>
                        </div>
                        <span
                            style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: getStatusColor(profile.status),
                                padding: '4px 10px',
                                background: `${getStatusColor(profile.status)}15`,
                                borderRadius: '9999px',
                            }}
                        >
                            {profile.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
