/**
 * Cross-Chain Adapters - Main Entry Point
 * 
 * @module cross-chain-adapters
 */

// Export types
export * from './types/index.js';

// Export adapters
export { LayerZeroAdapter, type LayerZeroAdapterOptions } from './adapters/layerzero-adapter.js';
export { WormholeAdapter, type WormholeAdapterOptions } from './adapters/wormhole-adapter.js';
export { DebridgeAdapter, type DebridgeAdapterOptions } from './adapters/debridge-adapter.js';
export { CrossChainAdapter, type CrossChainAdapterOptions } from './adapters/cross-chain-adapter.js';

// Version
export const VERSION = '1.0.0';
