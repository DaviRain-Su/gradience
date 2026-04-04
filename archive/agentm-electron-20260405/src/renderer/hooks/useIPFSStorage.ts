/**
 * IPFS Storage Hook
 * 
 * Upload and download Soul Profiles and Matching Reports to IPFS
 */

import { useState, useCallback } from 'react';

interface IPFSConfig {
  /** IPFS gateway URL */
  gateway?: string;
  /** IPFS API endpoint */
  apiUrl?: string;
  /** Web3.Storage token (optional) */
  web3StorageToken?: string;
}

interface UseIPFSStorageOptions {
  config?: IPFSConfig;
}

interface UseIPFSStorageReturn {
  /** Upload content to IPFS */
  upload: (content: string, filename?: string) => Promise<string>;
  /** Download content from IPFS */
  download: (cid: string) => Promise<string>;
  /** Uploading state */
  uploading: boolean;
  /** Downloading state */
  downloading: boolean;
  /** Error message */
  error: string | null;
}

const DEFAULT_CONFIG: IPFSConfig = {
  gateway: 'https://ipfs.io/ipfs',
  apiUrl: 'https://api.web3.storage',
};

export function useIPFSStorage(options: UseIPFSStorageOptions = {}): UseIPFSStorageReturn {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload content to IPFS
   * 
   * In production, use web3.storage or similar service
   * For demo, we'll use a mock implementation
   */
  const upload = useCallback(async (content: string, filename = 'content.md'): Promise<string> => {
    setUploading(true);
    setError(null);

    try {
      // Check if we have Web3.Storage token
      if (config.web3StorageToken) {
        // Real IPFS upload via Web3.Storage
        const blob = new Blob([content], { type: 'text/markdown' });
        const file = new File([blob], filename, { type: 'text/markdown' });

        const response = await fetch('https://api.web3.storage/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.web3StorageToken}`,
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        const cid = data.cid;
        
        console.log('[useIPFSStorage] Uploaded to IPFS:', cid);
        return cid;
      }

      // Demo mode: generate mock CID
      // In real implementation, this would upload to IPFS
      const mockCid = `Qm${Array.from({ length: 44 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
      ).join('')}`;
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store in localStorage for demo purposes
      localStorage.setItem(`ipfs-${mockCid}`, content);
      
      console.log('[useIPFSStorage] Demo upload (stored locally):', mockCid);
      return mockCid;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [config.web3StorageToken]);

  /**
   * Download content from IPFS
   */
  const download = useCallback(async (cid: string): Promise<string> => {
    setDownloading(true);
    setError(null);

    try {
      // First check localStorage (for demo mode)
      const localContent = localStorage.getItem(`ipfs-${cid}`);
      if (localContent) {
        console.log('[useIPFSStorage] Retrieved from localStorage:', cid);
        return localContent;
      }

      // Try to fetch from IPFS gateway
      const response = await fetch(`${config.gateway}/${cid}`);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const content = await response.text();
      console.log('[useIPFSStorage] Downloaded from IPFS:', cid);
      return content;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setError(message);
      throw err;
    } finally {
      setDownloading(false);
    }
  }, [config.gateway]);

  return {
    upload,
    download,
    uploading,
    downloading,
    error,
  };
}

/**
 * Generate IPFS URL from CID
 */
export function getIPFSUrl(cid: string, gateway = 'https://ipfs.io/ipfs'): string {
  return `${gateway}/${cid}`;
}

/**
 * Check if a string is a valid IPFS CID
 */
export function isValidCID(cid: string): boolean {
  // Basic CID validation (v0 and v1)
  // CIDv0: Qm + 44 base58 characters
  // CIDv1: multibase prefix + multicodec + hash
  
  if (cid.startsWith('Qm') && cid.length === 46) {
    // CIDv0
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
  }
  
  // CIDv1 (simplified check)
  if (cid.length > 10) {
    return true; // Accept for now, can be more strict
  }
  
  return false;
}
