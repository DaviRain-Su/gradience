import { Connection, PublicKey } from '@solana/web3.js';
import { getDomainKey, NameRegistryState, reverseLookup } from '@bonfida/spl-name-service';
import { Provider, SNSProviderConfig, ProviderError } from '../types';

export class SNSProvider implements Provider {
  public readonly name = 'SNS';
  private connection: Connection;
  private timeout: number;

  constructor(config: SNSProviderConfig = {}) {
    // Default to mainnet-beta if no connection provided
    const connectionUrl = typeof config.connection === 'string' 
      ? config.connection 
      : 'https://api.mainnet-beta.solana.com';
    
    this.connection = config.connection instanceof Connection
      ? config.connection
      : new Connection(connectionUrl, 'confirmed');
    
    this.timeout = config.timeout || 30000; // 30 second default timeout
  }

  supports(domain: string): boolean {
    return domain.endsWith('.sol');
  }

  async resolve(domain: string): Promise<string | null> {
    if (!this.supports(domain)) {
      throw new ProviderError(
        `Domain ${domain} is not supported by SNS provider`,
        this.name,
        domain
      );
    }

    const domainName = domain.replace('.sol', '');
    
    if (!this.isValidSolDomain(domainName)) {
      throw new ProviderError(
        `Invalid .sol domain format: ${domain}`,
        this.name,
        domain
      );
    }

    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ProviderError(
            `SNS resolution timeout after ${this.timeout}ms`,
            this.name,
            domain
          ));
        }, this.timeout);
      });

      const resolutionPromise = this.performResolution(domainName);
      
      return await Promise.race([resolutionPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
      throw new ProviderError(
        `Failed to resolve ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        domain,
        error instanceof Error ? error : undefined
      );
    }
  }

  async reverse(address: string): Promise<string | null> {
    try {
      const pubkey = new PublicKey(address);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ProviderError(
            `SNS reverse lookup timeout after ${this.timeout}ms`,
            this.name
          ));
        }, this.timeout);
      });

      const reversePromise = this.performReverseLookup(pubkey);
      
      const result = await Promise.race([reversePromise, timeoutPromise]);
      return result ? `${result}.sol` : null;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
      throw new ProviderError(
        `Failed to reverse lookup ${address}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async performResolution(domainName: string): Promise<string | null> {
    try {
      const { pubkey } = await getDomainKey(domainName);
      const nameAccount = await NameRegistryState.retrieve(this.connection, pubkey);
      
      // Check if the name account has an owner - handle both possible structures
      const owner = nameAccount.registry ? nameAccount.registry.owner : (nameAccount as any).owner;
      
      if (!owner) {
        return null; // Domain not registered or no owner
      }
      
      return owner.toBase58();
    } catch (error) {
      // Handle specific SNS errors
      if (error instanceof Error) {
        if (error.message.includes('Account does not exist')) {
          return null; // Domain not registered
        }
      }
      throw error;
    }
  }

  private async performReverseLookup(pubkey: PublicKey): Promise<string | null> {
    try {
      const domains = await reverseLookup(this.connection, pubkey);
      // Return the first domain if any found
      return domains.length > 0 ? domains[0] : null;
    } catch (error) {
      // Handle case where no reverse lookup records exist
      if (error instanceof Error && error.message.includes('Account does not exist')) {
        return null;
      }
      throw error;
    }
  }

  private isValidSolDomain(domain: string): boolean {
    // Basic validation for .sol domains
    if (!domain || domain.length === 0) {
      return false;
    }
    
    // Check length constraints (SNS domains are typically 1-32 characters)
    if (domain.length > 32) {
      return false;
    }
    
    // Check for valid characters (letters, numbers, hyphens, but not starting/ending with hyphen)
    const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    if (!validPattern.test(domain)) {
      return false;
    }
    
    // Additional constraints
    if (domain.includes('--')) {
      return false; // No consecutive hyphens
    }
    
    return true;
  }

  // Helper method to update connection if needed
  updateConnection(connection: Connection): void {
    this.connection = connection;
  }

  getConnection(): Connection {
    return this.connection;
  }
}