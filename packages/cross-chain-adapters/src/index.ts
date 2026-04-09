/**
 * Cross-Chain Adapters - Main Entry Point
 *
 * @module cross-chain-adapters
 */

// Export types
export * from './types/index.js';

// Export adapters
export {
    LayerZeroAdapter,
    type LayerZeroAdapterOptions,
    type CrossChainReputationMessage,
    // LayerZero configuration
    LZ_EIDS,
    LZ_ENDPOINTS,
    LZ_DVNS,
    // Factory functions
    createEthereumAdapter,
    createEthereumTestnetAdapter,
    createPolygonAdapter,
    createPolygonTestnetAdapter,
    // Helper functions
    getEidForChain,
    getEndpointForChain,
} from './adapters/layerzero-adapter.js';

export {
    WormholeAdapter,
    type WormholeAdapterOptions,
    type WormholeMessage,
    // Wormhole configuration
    WORMHOLE_CHAIN_IDS,
    WORMHOLE_CORE_ADDRESSES,
    WORMHOLE_GUARDIAN_RPCS,
    // Factory functions
    createEthereumAdapter as createWormholeEthereumAdapter,
    createEthereumTestnetAdapter as createWormholeEthereumTestnetAdapter,
    createPolygonAdapter as createWormholePolygonAdapter,
    createPolygonTestnetAdapter as createWormholePolygonTestnetAdapter,
    createBSCAdapter,
    createAvalancheAdapter,
    // Helper functions
    getWormholeChainId,
    getWormholeCoreAddress,
} from './adapters/wormhole-adapter.js';
export {
    DeBridgeAdapter,
    type DeBridgeAdapterOptions,
    type DeBridgeMessage,
    // DeBridge configuration
    DEBRIDGE_CHAIN_IDS,
    DEBRIDGE_GATE_ADDRESSES,
    DEBRIDGE_TREASURY_ADDRESSES,
    DEBRIDGE_API_URLS,
} from './adapters/debridge-adapter.js';
export { CrossChainAdapter, type CrossChainAdapterOptions } from './adapters/cross-chain-adapter.js';

// Version
export const VERSION = '1.0.0';
