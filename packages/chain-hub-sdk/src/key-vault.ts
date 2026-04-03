import type { InvokeInput, VaultPolicy } from "./types";

export class KeyVaultError extends Error {}
export class PolicyViolationError extends Error {}

export interface KeyVaultAdapter {
  resolveSecret(keyRef: string): string;
  guard(policy: VaultPolicy | undefined, input: Pick<InvokeInput, "capability" | "method" | "amount">): void;
  buildAuthHeaders(secretRef: string): Record<string, string>;
}

export class EnvKeyVaultAdapter implements KeyVaultAdapter {
  resolveSecret(keyRef: string): string {
    const envKey = keyRef.startsWith("env:") ? keyRef.slice(4) : keyRef;
    const secret = process.env[envKey];
    if (!secret) {
      throw new KeyVaultError(`Missing secret for keyRef: ${keyRef}`);
    }
    return secret;
  }

  guard(
    policy: VaultPolicy | undefined,
    input: Pick<InvokeInput, "capability" | "method" | "amount">
  ): void {
    if (!policy) {
      return;
    }

    if (!policy.allowedCapabilities.includes(input.capability)) {
      throw new PolicyViolationError(`Capability not allowed: ${input.capability}`);
    }

    const method = input.method ?? "POST";
    if (policy.allowedMethods && !policy.allowedMethods.includes(method)) {
      throw new PolicyViolationError(`Method not allowed: ${method}`);
    }

    if (
      typeof policy.maxAmount === "number" &&
      typeof input.amount === "number" &&
      input.amount > policy.maxAmount
    ) {
      throw new PolicyViolationError(`Amount exceeds policy max: ${input.amount}`);
    }
  }

  buildAuthHeaders(secretRef: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.resolveSecret(secretRef)}`,
    };
  }
}
