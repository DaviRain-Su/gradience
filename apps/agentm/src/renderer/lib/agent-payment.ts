/**
 * Agent Payment Service
 *
 * Integrates Triton Cascade for high-performance Solana payments in Agent economy
 */

import { TritonCascadeClient, type CascadeTransactionResponse } from '@gradiences/workflow-engine/triton-cascade';
import type { PaymentRequest, PaymentConfirmation } from '../shared/a2a-payment-types.js';

export interface AgentPaymentConfig {
  /** Triton RPC endpoint */
  tritonEndpoint?: string;
  /** Triton API token */
  tritonApiToken?: string;
  /** Network */
  network: 'mainnet' | 'devnet';
  /** Enable Jito Bundle for MEV protection */
  enableJitoBundle?: boolean;
  /** Default payment token */
  defaultToken: string;
  /** Default token symbol */
  defaultTokenSymbol: string;
  /** Token decimals */
  defaultDecimals: number;
}

export interface PaymentIntent {
  paymentId: string;
  taskId: string;
  payer: string;
  payee: string;
  amount: string;
  displayAmount: string;
  token: string;
  tokenSymbol: string;
  description: string;
  deadline: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  txHash?: string;
  confirmation?: PaymentConfirmation;
  error?: string;
}

export class AgentPaymentService {
  private cascadeClient: TritonCascadeClient;
  private config: Required<AgentPaymentConfig>;

  constructor(config: AgentPaymentConfig) {
    this.config = {
      tritonEndpoint: config.tritonEndpoint || 'https://api.triton.one/rpc',
      tritonApiToken: config.tritonApiToken || '',
      network: config.network,
      enableJitoBundle: config.enableJitoBundle ?? true,
      defaultToken: config.defaultToken,
      defaultTokenSymbol: config.defaultTokenSymbol,
      defaultDecimals: config.defaultDecimals,
    };

    this.cascadeClient = new TritonCascadeClient({
      rpcEndpoint: this.config.tritonEndpoint,
      apiToken: this.config.tritonApiToken,
      network: this.config.network,
      enableJitoBundle: this.config.enableJitoBundle,
      priorityFeeStrategy: 'auto',
    });
  }

  /**
   * Create a payment intent from A2A payment request
   */
  createPaymentIntent(request: PaymentRequest): PaymentIntent {
    return {
      paymentId: request.paymentId,
      taskId: request.taskId,
      payer: request.payer,
      payee: request.payee,
      amount: request.amount,
      displayAmount: request.displayAmount,
      token: request.token,
      tokenSymbol: request.tokenSymbol,
      description: request.description,
      deadline: request.deadline,
    };
  }

  /**
   * Execute payment using Triton Cascade
   */
  async executePayment(
    intent: PaymentIntent,
    signedTransaction: string
  ): Promise<PaymentResult> {
    try {
      // Submit transaction via Triton Cascade
      const response = await this.cascadeClient.sendTransaction(
        signedTransaction,
        {
          transactionType: 'transfer',
          useJitoBundle: this.config.enableJitoBundle,
          commitment: 'confirmed',
          metadata: {
            paymentId: intent.paymentId,
            taskId: intent.taskId,
            payer: intent.payer,
            payee: intent.payee,
            amount: intent.amount,
            token: intent.token,
          },
        }
      );

      if (response.status === 'failed') {
        return {
          success: false,
          paymentId: intent.paymentId,
          error: response.error?.message || 'Transaction failed',
        };
      }

      // Build confirmation
      const confirmation: PaymentConfirmation = {
        paymentId: intent.paymentId,
        taskId: intent.taskId,
        txHash: response.signature,
        blockTime: response.confirmedAt || Date.now(),
        slot: response.confirmation?.slot || 0,
        amount: intent.amount,
        token: intent.token,
        payer: intent.payer,
        payee: intent.payee,
        instructionIndex: 0,
        evaluatorScore: 100, // Auto-approved for direct payments
        settledAt: response.confirmedAt || Date.now(),
      };

      return {
        success: true,
        paymentId: intent.paymentId,
        txHash: response.signature,
        confirmation,
      };
    } catch (error) {
      return {
        success: false,
        paymentId: intent.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get priority fee estimate for payment
   */
  async getFeeEstimate(): Promise<{
    recommended: number;
    high: number;
    veryHigh: number;
  }> {
    const estimate = await this.cascadeClient.getPriorityFeeEstimate('confirmed');
    return {
      recommended: estimate.recommended,
      high: estimate.high,
      veryHigh: estimate.veryHigh,
    };
  }

  /**
   * Check if payment is still valid (not expired)
   */
  isPaymentValid(intent: PaymentIntent): boolean {
    return Date.now() < intent.deadline;
  }

  /**
   * Get time remaining until deadline
   */
  getTimeRemaining(intent: PaymentIntent): number {
    return Math.max(0, intent.deadline - Date.now());
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    await this.cascadeClient.close();
  }
}

// React Hook for using Agent Payment
export function useAgentPayment(config: AgentPaymentConfig) {
  const [service] = useState(() => new AgentPaymentService(config));
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<PaymentResult | null>(null);

  const executePayment = useCallback(async (
    intent: PaymentIntent,
    signedTransaction: string
  ): Promise<PaymentResult> => {
    setIsProcessing(true);
    try {
      const result = await service.executePayment(intent, signedTransaction);
      setLastResult(result);
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [service]);

  const getFeeEstimate = useCallback(async () => {
    return service.getFeeEstimate();
  }, [service]);

  useEffect(() => {
    return () => {
      service.close();
    };
  }, [service]);

  return {
    executePayment,
    getFeeEstimate,
    isProcessing,
    lastResult,
    isPaymentValid: service.isPaymentValid.bind(service),
    getTimeRemaining: service.getTimeRemaining.bind(service),
  };
}

import { useState, useCallback, useEffect } from 'react';
