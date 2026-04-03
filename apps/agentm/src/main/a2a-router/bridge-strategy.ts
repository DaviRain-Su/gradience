/**
 * Cross-Chain Bridge Strategy Manager
 *
 * Manages multiple cross-chain bridges (LayerZero, Wormhole, etc.)
 * and selects the optimal bridge based on strategy
 *
 * @module a2a-router/bridge-strategy
 */

import type { A2AMessage, A2AResult } from '../../shared/a2a-router-types.js';
import type { LayerZeroAdapter } from './adapters/layerzero-adapter.js';
import type { WormholeAdapter } from './adapters/wormhole-adapter.js';
import type { DebridgeAdapter } from './adapters/debridge-adapter.js';

export type BridgeType = 'layerzero' | 'wormhole' | 'debridge';

export interface BridgeStrategy {
  /** Strategy name */
  name: string;
  /** Select bridge for message */
  selectBridge(message: A2AMessage, context: BridgeContext): BridgeType;
  /** Handle bridge failure */
  onFailure(bridge: BridgeType, error: Error): BridgeType | null;
}

export interface BridgeContext {
  /** Message priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Message value (for high-value messages) */
  value?: bigint;
  /** Target chain */
  targetChain: string;
  /** Source chain */
  sourceChain: string;
  /** Max acceptable latency (seconds) */
  maxLatency?: number;
  /** Max acceptable cost (in source chain native token) */
  maxCost?: bigint;
}

export interface BridgeMetrics {
  bridge: BridgeType;
  successRate: number;
  averageLatency: number;
  averageCost: bigint;
  lastUsed: number;
  failureCount: number;
}

/**
 * Speed-first strategy: Use fastest bridge
 */
export class SpeedStrategy implements BridgeStrategy {
  readonly name = 'speed';
  private latencyMap: Record<BridgeType, number> = {
    layerzero: 120,  // 2 minutes
    wormhole: 900,   // 15 minutes
    debridge: 300,   // 5 minutes
  };

  selectBridge(_message: A2AMessage, context: BridgeContext): BridgeType {
    if (context.maxLatency !== undefined) {
      // Find fastest bridge within latency constraint
      const bridges = Object.entries(this.latencyMap) as [BridgeType, number][];
      const validBridges = bridges.filter(([_, latency]) => latency <= context.maxLatency!);
      
      if (validBridges.length > 0) {
        return validBridges.sort((a, b) => a[1] - b[1])[0][0];
      }
    }
    
    // Default to fastest
    return 'layerzero';
  }

  onFailure(bridge: BridgeType, _error: Error): BridgeType | null {
    // Try next fastest
    if (bridge === 'layerzero') return 'debridge';
    if (bridge === 'debridge') return 'wormhole';
    return null;
  }
}

/**
 * Cost-first strategy: Use cheapest bridge
 */
export class CostStrategy implements BridgeStrategy {
  readonly name = 'cost';
  private costMap: Record<BridgeType, bigint> = {
    layerzero: BigInt(5000000000000000),  // ~$10
    wormhole: BigInt(1000000000000000),   // ~$2
    debridge: BigInt(1500000000000000),   // ~$3 (lower than LayerZero)
  };

  selectBridge(_message: A2AMessage, context: BridgeContext): BridgeType {
    if (context.maxCost !== undefined) {
      const bridges = Object.entries(this.costMap) as [BridgeType, bigint][];
      const validBridges = bridges.filter(([_, cost]) => cost <= context.maxCost!);
      
      if (validBridges.length > 0) {
        return validBridges.sort((a, b) => Number(a[1] - b[1]))[0][0];
      }
    }
    
    // Default to cheapest
    return 'wormhole';
  }

  onFailure(bridge: BridgeType, _error: Error): BridgeType | null {
    // Try next cheapest
    if (bridge === 'wormhole') return 'debridge';
    if (bridge === 'debridge') return 'layerzero';
    return null;
  }
}

/**
 * Reliability-first strategy: Use most reliable bridge
 */
export class ReliabilityStrategy implements BridgeStrategy {
  readonly name = 'reliability';
  private metrics: Map<BridgeType, BridgeMetrics> = new Map();

  selectBridge(_message: A2AMessage, _context: BridgeContext): BridgeType {
    // Sort by success rate
    const bridges = Array.from(this.metrics.entries());
    bridges.sort((a, b) => b[1].successRate - a[1].successRate);
    
    if (bridges.length > 0 && bridges[0][1].successRate > 0.8) {
      return bridges[0][0];
    }
    
    // Default to LayerZero (generally most reliable)
    return 'layerzero';
  }

  onFailure(bridge: BridgeType, _error: Error): BridgeType | null {
    // Update metrics
    const metric = this.metrics.get(bridge);
    if (metric) {
      metric.failureCount++;
      metric.successRate = Math.max(0, metric.successRate - 0.1);
    }
    
    // Try next most reliable
    const bridges = Array.from(this.metrics.entries());
    bridges.sort((a, b) => b[1].successRate - a[1].successRate);
    
    for (const [b, m] of bridges) {
      if (b !== bridge && m.successRate > 0.5) {
        return b;
      }
    }
    
    return null;
  }

  updateMetrics(bridge: BridgeType, success: boolean, latency: number, cost: bigint): void {
    let metric = this.metrics.get(bridge);
    if (!metric) {
      metric = {
        bridge,
        successRate: 1.0,
        averageLatency: latency,
        averageCost: cost,
        lastUsed: Date.now(),
        failureCount: 0,
      };
      this.metrics.set(bridge, metric);
    }

    // Update with exponential moving average
    const alpha = 0.3;
    metric.successRate = success 
      ? metric.successRate * (1 - alpha) + alpha 
      : metric.successRate * (1 - alpha);
    metric.averageLatency = metric.averageLatency * (1 - alpha) + latency * alpha;
    metric.averageCost = (metric.averageCost * BigInt(100 - Math.floor(alpha * 100)) + cost * BigInt(Math.floor(alpha * 100))) / BigInt(100);
    metric.lastUsed = Date.now();
  }
}

/**
 * Smart strategy: Balance speed, cost, and reliability
 */
export class SmartStrategy implements BridgeStrategy {
  readonly name = 'smart';
  private metrics: Map<BridgeType, BridgeMetrics> = new Map();

  selectBridge(message: A2AMessage, context: BridgeContext): BridgeType {
    const scores = new Map<BridgeType, number>();

    for (const [bridge, metric] of this.metrics) {
      let score = 0;

      // Speed score (lower latency = higher score)
      const latencyScore = Math.max(0, 1000 - metric.averageLatency) / 1000;
      score += latencyScore * 0.3;

      // Cost score (lower cost = higher score)
      const costScore = 1 / (1 + Number(metric.averageCost) / 1e18);
      score += costScore * 0.3;

      // Reliability score
      score += metric.successRate * 0.4;

      // Adjust for message priority
      if (context.priority === 'urgent') {
        score *= latencyScore > 0.5 ? 1.5 : 0.5;
      }
      if (context.priority === 'low') {
        score *= costScore > 0.5 ? 1.5 : 0.5;
      }

      scores.set(bridge, score);
    }

    // Select highest score
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      return sorted[0][0];
    }

    // Default based on message type
    if (context.priority === 'urgent') return 'layerzero';
    if (context.value && context.value > BigInt(1e18)) return 'layerzero';
    return 'wormhole';
  }

  onFailure(bridge: BridgeType, error: Error): BridgeType | null {
    // Update metrics
    const metric = this.metrics.get(bridge);
    if (metric) {
      metric.failureCount++;
      metric.successRate *= 0.8;
    }

    // Try alternative
    const alternatives: BridgeType[] = ['layerzero', 'wormhole', 'debridge'];
    for (const alt of alternatives) {
      if (alt !== bridge) {
        const altMetric = this.metrics.get(alt);
        if (!altMetric || altMetric.successRate > 0.5) {
          return alt;
        }
      }
    }

    return null;
  }

  updateMetrics(bridge: BridgeType, success: boolean, latency: number, cost: bigint): void {
    let metric = this.metrics.get(bridge);
    if (!metric) {
      metric = {
        bridge,
        successRate: 1.0,
        averageLatency: latency,
        averageCost: cost,
        lastUsed: Date.now(),
        failureCount: 0,
      };
      this.metrics.set(bridge, metric);
    }

    const alpha = 0.2;
    metric.successRate = success 
      ? metric.successRate * (1 - alpha) + alpha 
      : metric.successRate * (1 - alpha);
    metric.averageLatency = metric.averageLatency * (1 - alpha) + latency * alpha;
    metric.averageCost = (metric.averageCost * BigInt(100 - Math.floor(alpha * 100)) + cost * BigInt(Math.floor(alpha * 100))) / BigInt(100);
    metric.lastUsed = Date.now();
  }
}

/**
 * Bridge Strategy Manager
 */
export class BridgeStrategyManager {
  private strategy: BridgeStrategy;
  private bridges: Map<BridgeType, LayerZeroAdapter | WormholeAdapter | DebridgeAdapter> = new Map();
  private currentBridge: BridgeType | null = null;

  constructor(strategy: BridgeStrategy) {
    this.strategy = strategy;
  }

  registerBridge(bridge: BridgeType, adapter: LayerZeroAdapter | WormholeAdapter | DebridgeAdapter): void {
    this.bridges.set(bridge, adapter);
  }

  async sendWithStrategy(
    message: A2AMessage,
    context: BridgeContext
  ): Promise<A2AResult> {
    let bridgeType = this.strategy.selectBridge(message, context);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const bridge = this.bridges.get(bridgeType);
      if (!bridge) {
        return {
          success: false,
          messageId: message.id,
          protocol: bridgeType,
          error: `Bridge ${bridgeType} not registered`,
          errorCode: 'BRIDGE_NOT_REGISTERED',
          timestamp: Date.now(),
        };
      }

      this.currentBridge = bridgeType;
      const startTime = Date.now();

      try {
        const result = await bridge.send(message);
        
        // Update metrics if using smart/reliability strategy
        if (this.strategy instanceof ReliabilityStrategy || this.strategy instanceof SmartStrategy) {
          this.strategy.updateMetrics(
            bridgeType,
            result.success,
            Date.now() - startTime,
            BigInt(0) // TODO: Get actual cost
          );
        }

        if (result.success) {
          return result;
        }

        // Try fallback
        const fallback = this.strategy.onFailure(bridgeType, new Error(result.error));
        if (!fallback) {
          return result;
        }
        bridgeType = fallback;
      } catch (error) {
        const fallback = this.strategy.onFailure(bridgeType, error as Error);
        if (!fallback) {
          return {
            success: false,
            messageId: message.id,
            protocol: bridgeType,
            error: (error as Error).message,
            errorCode: 'BRIDGE_ERROR',
            timestamp: Date.now(),
          };
        }
        bridgeType = fallback;
      }

      attempts++;
    }

    return {
      success: false,
      messageId: message.id,
      protocol: bridgeType,
      error: 'Max retry attempts reached',
      errorCode: 'MAX_RETRIES',
      timestamp: Date.now(),
    };
  }

  setStrategy(strategy: BridgeStrategy): void {
    this.strategy = strategy;
  }

  getCurrentBridge(): BridgeType | null {
    return this.currentBridge;
  }
}

export default BridgeStrategyManager;
