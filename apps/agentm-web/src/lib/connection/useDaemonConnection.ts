/**
 * Daemon Connection Hook
 * 
 * Shared hook for connecting to Agent Daemon
 */

// Default daemon URL - always try localhost:7420
const DEFAULT_DAEMON_URL = 'http://localhost:7420';

interface DaemonConnection {
  daemonUrl: string;
  isConnected: boolean;
}

/**
 * Hook to safely use daemon connection with fallback to default URL
 */
export function useDaemonConnection(): DaemonConnection {
  try {
    // Dynamic import to avoid SSR issues
    const { useConnection } = require('./ConnectionContext');
    const conn = useConnection();
    return {
      daemonUrl: conn.daemonUrl || DEFAULT_DAEMON_URL,
      isConnected: conn.isConnected || false,
    };
  } catch {
    return { daemonUrl: DEFAULT_DAEMON_URL, isConnected: false };
  }
}

export default useDaemonConnection;
