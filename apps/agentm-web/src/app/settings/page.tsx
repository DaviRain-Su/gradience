'use client';

import { useState, useMemo } from 'react';
import { useDaemonConnection } from '@/lib/connection/useDaemonConnection';
import { useDashboard } from '@/hooks/useDashboard';
import { ZkKycButton } from '@/components/identity/ZkKycButton';
import { Settings, Wallet, Shield, Bell, Globe, Key } from 'lucide-react';

const c = {
  bg: '#F3F3F8',
  surface: '#FFFFFF',
  ink: '#16161A',
  lavender: '#C6BBFF',
  lime: '#CDFF4D',
};

const styles = {
  container: {
    minHeight: '100vh',
    background: c.bg,
  },
  header: {
    borderBottom: `1.5px solid ${c.ink}`,
    background: c.surface,
  },
  headerContent: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
  },
  title: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '28px',
    fontWeight: 700,
    margin: 0,
    color: c.ink,
  },
  subtitle: {
    fontSize: '14px',
    color: c.ink,
    opacity: 0.6,
    marginTop: '4px',
  },
  content: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
  },
  section: {
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '16px',
    marginBottom: '24px',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '20px 24px',
    borderBottom: `1.5px solid ${c.ink}`,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sectionTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    color: c.ink,
  },
  sectionContent: {
    padding: '24px',
  },
  settingItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderBottom: `1px solid ${c.bg}`,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: '15px',
    fontWeight: 600,
    color: c.ink,
    marginBottom: '4px',
  },
  settingDescription: {
    fontSize: '13px',
    color: c.ink,
    opacity: 0.6,
  },
  settingValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: c.ink,
    opacity: 0.8,
  },
  button: {
    padding: '10px 20px',
    background: c.lime,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: c.ink,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  buttonSecondary: {
    padding: '10px 20px',
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: c.ink,
    cursor: 'pointer',
  },
  buttonDanger: {
    padding: '10px 20px',
    background: '#FEE2E2',
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#DC2626',
    cursor: 'pointer',
  },
  toggle: {
    width: '48px',
    height: '26px',
    borderRadius: '13px',
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    position: 'relative' as const,
    cursor: 'pointer',
  },
  toggleOff: {
    width: '48px',
    height: '26px',
    borderRadius: '13px',
    background: c.bg,
    border: `1.5px solid ${c.ink}`,
    position: 'relative' as const,
    cursor: 'pointer',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '10px',
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    position: 'absolute' as const,
    top: '2px',
    right: '2px',
  },
  toggleKnobOff: {
    width: '20px',
    height: '20px',
    borderRadius: '10px',
    background: c.surface,
    border: `1.5px solid ${c.ink}`,
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
  },
  infoCard: {
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
  },
  infoText: {
    fontSize: '14px',
    color: c.ink,
    margin: 0,
  },
  walletCard: {
    background: c.bg,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  walletIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: c.lavender,
    border: `1.5px solid ${c.ink}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: '12px',
    color: c.ink,
    opacity: 0.6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  walletAddress: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: '16px',
    fontWeight: 600,
    color: c.ink,
    marginTop: '4px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: c.lime,
    border: `1.5px solid ${c.ink}`,
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    color: c.ink,
  },
};

export default function SettingsPage() {
  const { walletAddress } = useDaemonConnection();
  const { stats } = useDashboard();
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    mentions: true,
    follows: true,
  });
  
  const [privacy, setPrivacy] = useState({
    publicProfile: true,
    showReputation: true,
    allowDiscovery: true,
  });

  const reputationDisplay = useMemo(() => {
    if (stats.reputationScore > 0) {
      return stats.reputationScore.toFixed(1);
    }
    return 'N/A';
  }, [stats.reputationScore]);

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePrivacy = (key: keyof typeof privacy) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Manage your account, wallet, and preferences
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Wallet Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Wallet size={20} color={c.ink} />
            <h2 style={styles.sectionTitle}>Wallet Connection</h2>
          </div>
          <div style={styles.sectionContent}>
            {walletAddress ? (
              <>
                <div style={styles.walletCard}>
                  <div style={styles.walletIcon}>
                    <Wallet size={24} color={c.ink} />
                  </div>
                  <div style={styles.walletInfo}>
                    <div style={styles.walletLabel}>Connected Wallet</div>
                    <div style={styles.walletAddress}>
                      {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
                    </div>
                  </div>
                  <div style={styles.statusBadge}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: c.ink }} />
                    Active
                  </div>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                  <button style={styles.buttonSecondary}>
                    Copy Address
                  </button>
                  <button style={styles.buttonDanger}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '14px', color: c.ink, opacity: 0.6, marginBottom: '16px' }}>
                  No wallet connected
                </p>
                <button style={styles.button}>
                  <Wallet size={18} />
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Reputation Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Shield size={20} color={c.ink} />
            <h2 style={styles.sectionTitle}>Reputation & Identity</h2>
          </div>
          <div style={styles.sectionContent}>
            <div style={styles.settingItem}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Current Reputation Score</div>
                <div style={styles.settingDescription}>
                  Your reputation based on task completion and community feedback
                </div>
              </div>
              <div style={styles.settingValue}>
                <span style={{ 
                  fontFamily: "'Oswald', sans-serif", 
                  fontSize: '24px', 
                  fontWeight: 700,
                  color: c.ink 
                }}>
                  {reputationDisplay}
                </span>
              </div>
            </div>
            <div style={{ ...styles.settingItem, borderBottom: 'none' }}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Total Profiles</div>
                <div style={styles.settingDescription}>
                  Number of agent profiles you have created
                </div>
              </div>
              <div style={styles.settingValue}>
                <span style={{ fontWeight: 600 }}>{stats.totalProfiles}</span>
              </div>
            </div>
            {walletAddress && (
              <ZkKycButton
                accountId={walletAddress}
                walletAddress={walletAddress}
                appId={process.env.NEXT_PUBLIC_WORLDCOIN_APP_ID}
              />
            )}
          </div>
        </div>

        {/* Notifications Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Bell size={20} color={c.ink} />
            <h2 style={styles.sectionTitle}>Notifications</h2>
          </div>
          <div style={styles.sectionContent}>
            <div style={styles.settingItem}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Email Notifications</div>
                <div style={styles.settingDescription}>
                  Receive updates and alerts via email
                </div>
              </div>
              <div 
                style={notifications.email ? styles.toggle : styles.toggleOff}
                onClick={() => toggleNotification('email')}
              >
                <div style={notifications.email ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
            <div style={styles.settingItem}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Push Notifications</div>
                <div style={styles.settingDescription}>
                  Browser push notifications for real-time updates
                </div>
              </div>
              <div 
                style={notifications.push ? styles.toggle : styles.toggleOff}
                onClick={() => toggleNotification('push')}
              >
                <div style={notifications.push ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
            <div style={styles.settingItem}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Mentions</div>
                <div style={styles.settingDescription}>
                  Notify when someone mentions you
                </div>
              </div>
              <div 
                style={notifications.mentions ? styles.toggle : styles.toggleOff}
                onClick={() => toggleNotification('mentions')}
              >
                <div style={notifications.mentions ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
            <div style={{ ...styles.settingItem, borderBottom: 'none' }}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>New Followers</div>
                <div style={styles.settingDescription}>
                  Notify when someone follows you
                </div>
              </div>
              <div 
                style={notifications.follows ? styles.toggle : styles.toggleOff}
                onClick={() => toggleNotification('follows')}
              >
                <div style={notifications.follows ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Globe size={20} color={c.ink} />
            <h2 style={styles.sectionTitle}>Privacy</h2>
          </div>
          <div style={styles.sectionContent}>
            <div style={styles.settingItem}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Public Profile</div>
                <div style={styles.settingDescription}>
                  Make your profile visible to everyone
                </div>
              </div>
              <div 
                style={privacy.publicProfile ? styles.toggle : styles.toggleOff}
                onClick={() => togglePrivacy('publicProfile')}
              >
                <div style={privacy.publicProfile ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
            <div style={styles.settingItem}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Show Reputation</div>
                <div style={styles.settingDescription}>
                  Display your reputation score publicly
                </div>
              </div>
              <div 
                style={privacy.showReputation ? styles.toggle : styles.toggleOff}
                onClick={() => togglePrivacy('showReputation')}
              >
                <div style={privacy.showReputation ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
            <div style={{ ...styles.settingItem, borderBottom: 'none' }}>
              <div style={styles.settingInfo}>
                <div style={styles.settingLabel}>Allow Discovery</div>
                <div style={styles.settingDescription}>
                  Let others find you in agent discovery
                </div>
              </div>
              <div 
                style={privacy.allowDiscovery ? styles.toggle : styles.toggleOff}
                onClick={() => togglePrivacy('allowDiscovery')}
              >
                <div style={privacy.allowDiscovery ? styles.toggleKnob : styles.toggleKnobOff} />
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Key size={20} color={c.ink} />
            <h2 style={styles.sectionTitle}>Security</h2>
          </div>
          <div style={styles.sectionContent}>
            <div style={styles.infoCard}>
              <p style={styles.infoText}>
                Your wallet connection is secured via Dynamic. 
                Private keys never leave your device.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={styles.buttonSecondary}>
                View Connected Apps
              </button>
              <button style={styles.buttonSecondary}>
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
