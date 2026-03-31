export type ProtocolType = "rest-api" | "solana-program";
export type ProtocolStatus = "active" | "paused";
export type AuthMode = "none" | "key-vault";

export interface ProtocolMetadata {
  id: string;
  protocolType: ProtocolType;
  status: ProtocolStatus;
  endpoint: string;
  programId: string;
  authMode: AuthMode;
  capabilitiesMask: bigint;
  docsUri: string;
}

export interface InvokeInput {
  protocol: ProtocolMetadata;
  capability: string;
  method?: "GET" | "POST";
  payload?: unknown;
  amount?: number;
  secretRef?: string;
  policy?: VaultPolicy;
}

export interface RestInvokeInput extends InvokeInput {
  protocol: ProtocolMetadata & { protocolType: "rest-api" };
}

export interface CpiInvokeInput extends InvokeInput {
  protocol: ProtocolMetadata & { protocolType: "solana-program" };
  signer: string;
}

export interface VaultPolicy {
  allowedCapabilities: string[];
  allowedMethods?: ("GET" | "POST")[];
  maxAmount?: number;
}

export interface InvokeResult {
  route: ProtocolType;
  protocolId: string;
  capability: string;
  data: unknown;
}

export interface CpiInvoker {
  invoke(input: {
    programId: string;
    capability: string;
    payload?: unknown;
    signer: string;
  }): Promise<unknown>;
}

export interface HttpClient {
  request(input: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<unknown>;
}
