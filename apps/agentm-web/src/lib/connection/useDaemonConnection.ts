import { useConnection } from './ConnectionContext';

const DEFAULT_DAEMON_URL = 'https://api.gradiences.xyz';

interface DaemonConnection {
    daemonUrl: string;
    isConnected: boolean;
    sessionToken: string | null;
    walletAddress: string | null;
}

export function useDaemonConnection(): DaemonConnection {
    try {
        const conn = useConnection();
        return {
            daemonUrl: conn.daemonUrl || DEFAULT_DAEMON_URL,
            isConnected: conn.isConnected || false,
            sessionToken: conn.sessionToken || null,
            walletAddress: conn.walletAddress || null,
        };
    } catch {
        return { daemonUrl: DEFAULT_DAEMON_URL, isConnected: false, sessionToken: null, walletAddress: null };
    }
}

export default useDaemonConnection;
