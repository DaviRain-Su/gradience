'use client';

import type { AgentProfile } from '@/types/profile';

const c = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
};

interface ProfileCardProps {
  profile: AgentProfile;
  onEdit: (profile: AgentProfile) => void;
  onPublish: (profile: AgentProfile) => void;
  onDeprecate: (profile: AgentProfile) => void;
  onDelete: (profile: AgentProfile) => void;
  disabled?: boolean;
}

export function ProfileCard({
  profile,
  onEdit,
  onPublish,
  onDeprecate,
  onDelete,
  disabled = false,
}: ProfileCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return { border: '#10B981', text: '#10B981', bg: '#ECFDF5' };
      case 'deprecated':
        return { border: '#F59E0B', text: '#F59E0B', bg: '#FFFBEB' };
      default:
        return { border: '#6B7280', text: '#6B7280', bg: '#F9FAFB' };
    }
  };

  const statusColors = getStatusColor(profile.status);

  return (
    <div
      data-testid="profile-card"
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h3
            data-testid="profile-card-name"
            style={{
              fontFamily: "'Oswald', sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: c.ink,
              margin: 0,
              marginBottom: '4px',
            }}
          >
            {profile.name}
          </h3>
          <p style={{ fontSize: '14px', color: c.ink, opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
            {profile.description}
          </p>
        </div>
        <span
          data-testid="profile-status-badge"
          style={{
            fontSize: '12px',
            padding: '4px 12px',
            borderRadius: '9999px',
            border: `1.5px solid ${statusColors.border}`,
            color: statusColors.text,
            background: statusColors.bg,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          {profile.status}
        </span>
      </div>

      {/* Meta Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            background: c.bg,
            borderRadius: '8px',
            border: `1.5px solid ${c.ink}`,
            fontWeight: 500,
          }}
        >
          v{profile.version}
        </span>
        <span
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            background: c.bg,
            borderRadius: '8px',
            border: `1.5px solid ${c.ink}`,
            fontWeight: 500,
            textTransform: 'capitalize',
          }}
        >
          {profile.pricing.model.replace('_', ' ')}
        </span>
        <span
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            background: c.lavender,
            borderRadius: '8px',
            border: `1.5px solid ${c.ink}`,
            fontWeight: 500,
          }}
        >
          {profile.pricing.amount.toLocaleString()} lamports
        </span>
        {profile.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              background: c.lime,
              borderRadius: '8px',
              border: `1.5px solid ${c.ink}`,
              fontWeight: 500,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Updated Time */}
      <div style={{ fontSize: '12px', color: c.ink, opacity: 0.5 }}>
        Last updated {new Date(profile.updatedAt).toLocaleString()}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: `1px dashed ${c.ink}30` }}>
        <button
          onClick={() => onEdit(profile)}
          data-testid="profile-edit-button"
          disabled={disabled}
          style={{
            padding: '8px 16px',
            background: c.bg,
            color: c.ink,
            border: `1.5px solid ${c.ink}`,
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = c.lavender;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = c.bg;
          }}
        >
          Edit
        </button>
        {profile.status !== 'published' && (
          <button
            onClick={() => onPublish(profile)}
            data-testid="profile-publish-button"
            disabled={disabled}
            style={{
              padding: '8px 16px',
              background: '#10B981',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = '#059669';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#10B981';
            }}
          >
            Publish
          </button>
        )}
        {profile.status === 'published' && (
          <button
            onClick={() => onDeprecate(profile)}
            data-testid="profile-deprecate-button"
            disabled={disabled}
            style={{
              padding: '8px 16px',
              background: '#F59E0B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.background = '#D97706';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F59E0B';
            }}
          >
            Deprecate
          </button>
        )}
        <button
          onClick={() => onDelete(profile)}
          data-testid="profile-delete-button"
          disabled={disabled}
          style={{
            padding: '8px 16px',
            background: '#FEE2E2',
            color: '#DC2626',
            border: `1.5px solid #DC2626`,
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 0.2s ease',
            marginLeft: 'auto',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = '#FECACA';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FEE2E2';
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
