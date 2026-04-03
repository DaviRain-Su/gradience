export interface DomainRecord {
  domain: string;
  address: string;
  resolvedAt: number;
  ttl: number;
}

export interface ResolverConfig {
  cache?: {
    maxSize?: number;
    ttl?: number; // in milliseconds
  };
  providers?: {
    sns?: SNSProviderConfig;
    ens?: ENSProviderConfig;
  };
}

export interface SNSProviderConfig {
  connection?: string | object; // RPC URL or Connection object
  timeout?: number;
}

export interface ENSProviderConfig {
  provider?: string | object; // Provider URL or provider object
  timeout?: number;
}

export interface Provider {
  name: string;
  supports(domain: string): boolean;
  resolve(domain: string): Promise<string | null>;
  reverse?(address: string): Promise<string | null>;
}

export interface CacheEntry {
  value: string | null;
  timestamp: number;
  ttl: number;
}

export class DomainResolverError extends Error {
  constructor(
    message: string,
    public code: string,
    public domain?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'DomainResolverError';
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public domain?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public domain: string) {
    super(message);
    this.name = 'ValidationError';
  }
}