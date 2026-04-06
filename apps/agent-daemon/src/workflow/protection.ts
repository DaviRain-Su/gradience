/**
 * Workflow Protection & Pricing Module
 * 
 * Implements:
 * 1. Tiered pricing: Base free + Premium steps
 * 2. Workflow encryption: Hide core algorithms
 * 3. Anti-copy: Fingerprint + ZK verification
 */

import { encrypt, decrypt, hash } from './crypto.js';

// Workflow visibility levels
export type Visibility = 'public' | 'protected' | 'encrypted';

export interface WorkflowStep {
  id: string;
  name: string;
  skillRef: string;           // Reference to atomic skill
  
  // Pricing tier
  tier: 'free' | 'premium';
  price?: bigint;              // Only for premium steps
  
  // Visibility
  visibility: Visibility;
  
  // Encrypted logic (for protected/encrypted steps)
  encryptedLogic?: string;      // Encrypted algorithm
  encryptedParams?: string;   // Encrypted default params
  
  // Public interface (always visible)
  publicInterface: {
    inputs: string[];         // What inputs it expects
    outputs: string[];        // What outputs it produces
    description: string;        // Human-readable description
  };
  
  // Fingerprint for anti-copy
  fingerprint?: string;       // Hash of step logic
}

export interface ProtectedWorkflow {
  id: string;
  name: string;
  author: string;
  
  // Public metadata (always visible)
  metadata: {
    description: string;
    category: string;
    tags: string[];
    reputation: number;
    usageCount: number;
  };
  
  // Pricing model C: Free + Premium steps
  pricing: {
    basePrice: bigint;        // 0n for free workflows
    stepPricing: Map<string, bigint>; // Per-step prices
    subscription?: {         // Optional subscription
      monthlyPrice: bigint;
      includedSteps: string[];
    };
  };
  
  // Steps with varying visibility
  steps: WorkflowStep[];
  
  // Global workflow fingerprint
  fingerprint: string;        // Hash of entire workflow structure
  
  // ZK proof of validity (optional advanced)
  zkProof?: string;          // Proves workflow is valid without revealing logic
}

// Encryption service for workflow authors
export class WorkflowProtectionService {
  private masterKey: Buffer;
  
  constructor(masterKey: string) {
    this.masterKey = Buffer.from(masterKey, 'hex');
  }
  
  /**
   * Encrypt sensitive workflow logic
   * Only decrypted at execution time in secure enclave
   */
  async encryptStep(
    step: Omit<WorkflowStep, 'encryptedLogic'>,
    logic: string,              // The actual algorithm
    params: Record<string, any>   // Default parameters
  ): Promise<WorkflowStep> {
    // Generate unique key for this step
    const stepKey = this.deriveKey(step.id);
    
    // Encrypt logic
    const encryptedLogic = await encrypt(logic, stepKey);
    const encryptedParams = await encrypt(JSON.stringify(params), stepKey);
    
    // Generate fingerprint for anti-copy
    const fingerprint = hash(logic + JSON.stringify(params));
    
    return {
      ...step,
      encryptedLogic,
      encryptedParams,
      fingerprint,
    };
  }
  
  /**
   * Decrypt step for execution
   * Only called in secure execution environment
   */
  async decryptStep(
    step: WorkflowStep,
    executionKey: string          // Ephemeral key for this execution
  ): Promise<{
    logic: string;
    params: Record<string, any>;
  }> {
    if (!step.encryptedLogic || !step.encryptedParams) {
      throw new Error('Step not encrypted');
    }
    
    const stepKey = this.deriveKey(step.id);
    const combinedKey = hash(stepKey + executionKey);
    
    const logic = await decrypt(step.encryptedLogic, combinedKey);
    const params = JSON.parse(await decrypt(step.encryptedParams, combinedKey));
    
    return { logic, params };
  }
  
  /**
   * Verify workflow authenticity
   * Prevents copycat workflows
   */
  verifyFingerprint(workflow: ProtectedWorkflow): boolean {
    // Calculate expected fingerprint
    const stepsHash = workflow.steps
      .map(s => s.fingerprint)
      .join('');
    
    const expected = hash(
      workflow.author + 
      workflow.metadata.description +
      stepsHash
    );
    
    return expected === workflow.fingerprint;
  }
  
  /**
   * Check if workflow is a copy of another
   */
  async detectCopy(
    newWorkflow: ProtectedWorkflow,
    existingWorkflows: ProtectedWorkflow[]
  ): Promise<{ isCopy: boolean; similarity: number; original?: string }> {
    let maxSimilarity = 0;
    let mostSimilar: string | undefined;
    
    for (const existing of existingWorkflows) {
      // Compare step fingerprints
      const matchingSteps = newWorkflow.steps.filter(newStep =>
        existing.steps.some(existingStep =>
          existingStep.fingerprint === newStep.fingerprint
        )
      ).length;
      
      const similarity = matchingSteps / Math.max(newWorkflow.steps.length, existing.steps.length);
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilar = existing.id;
      }
    }
    
    // Threshold: 80% similar = copy
    return {
      isCopy: maxSimilarity > 0.8,
      similarity: maxSimilarity,
      original: mostSimilar,
    };
  }
  
  /**
   * Calculate execution cost for pricing model C
   * Base free + premium steps
   */
  calculateExecutionCost(
    workflow: ProtectedWorkflow,
    selectedSteps?: string[]        // If partial execution
  ): {
    baseCost: bigint;
    premiumSteps: { id: string; price: bigint }[];
    total: bigint;
  } {
    const stepsToExecute = selectedSteps 
      ? workflow.steps.filter(s => selectedSteps.includes(s.id))
      : workflow.steps;
    
    let baseCost = workflow.pricing.basePrice;
    const premiumSteps: { id: string; price: bigint }[] = [];
    
    for (const step of stepsToExecute) {
      if (step.tier === 'premium' && step.price) {
        premiumSteps.push({ id: step.id, price: step.price });
        baseCost += step.price;
      }
    }
    
    return {
      baseCost: workflow.pricing.basePrice,
      premiumSteps,
      total: baseCost,
    };
  }
  
  private deriveKey(stepId: string): Buffer {
    // Use HKDF or similar to derive step-specific key
    return hash(this.masterKey + stepId) as Buffer;
  }
}

// Pricing tier definitions
export const PRICING_TIERS = {
  free: {
    description: 'Basic workflow execution',
    features: ['Public steps only', 'Standard support'],
  },
  premium: {
    description: 'Advanced workflow with encrypted steps',
    features: ['Access to premium steps', 'Encrypted algorithms', 'Priority execution'],
  },
};

// Example: Protected DeFi Workflow
export const EXAMPLE_PROTECTED_WORKFLOW: ProtectedWorkflow = {
  id: "arb-v2-optimized",
  name: "Arbitrage Optimizer v2",
  author: "0xTraderPro",
  metadata: {
    description: "Advanced cross-exchange arbitrage with ML price prediction",
    category: "DeFi",
    tags: ["arbitrage", "ML", "high-frequency"],
    reputation: 95,
    usageCount: 1234,
  },
  pricing: {
    basePrice: 0n, // Free to use
    stepPricing: new Map([
      ["price-prediction", 500000n], // 0.0005 SOL - premium ML model
      ["execution-optimization", 300000n], // 0.0003 SOL - optimized routing
    ]),
  },
  steps: [
    {
      id: "fetch-prices",
      name: "Fetch Market Prices",
      skillRef: "market-query",
      tier: "free",
      visibility: "public",
      publicInterface: {
        inputs: ["exchange_list"],
        outputs: ["price_matrix"],
        description: "Queries prices from multiple DEXs",
      },
    },
    {
      id: "price-prediction",
      name: "ML Price Prediction",
      skillRef: "ml-inference",
      tier: "premium",
      price: 500000n,
      visibility: "encrypted", // Core algorithm hidden
      publicInterface: {
        inputs: ["price_matrix", "time_window"],
        outputs: ["predicted_prices", "confidence"],
        description: "Predicts future prices using proprietary ML model",
      },
      // encryptedLogic and encryptedParams set during publish
    },
    {
      id: "calculate-arb",
      name: "Calculate Arbitrage",
      skillRef: "arb-calculator",
      tier: "free",
      visibility: "protected",
      publicInterface: {
        inputs: ["price_matrix", "predicted_prices"],
        outputs: ["arb_opportunities"],
        description: "Finds profitable arbitrage paths",
      },
    },
    {
      id: "execution-optimization",
      name: "Optimal Execution",
      skillRef: "execution-engine",
      tier: "premium",
      price: 300000n,
      visibility: "encrypted", // Optimization algorithm hidden
      publicInterface: {
        inputs: ["arb_opportunities", "slippage_tolerance"],
        outputs: ["execution_plan"],
        description: "Optimizes execution order for minimal slippage",
      },
    },
  ],
  fingerprint: "abc123...", // Generated on publish
};

export default {
  WorkflowProtectionService,
  PRICING_TIERS,
  EXAMPLE_PROTECTED_WORKFLOW,
};
