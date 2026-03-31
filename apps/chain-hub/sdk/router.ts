import { EnvKeyVaultAdapter, KeyVaultError, type KeyVaultAdapter } from "./key-vault";
import type {
  CpiInvokeInput,
  CpiInvoker,
  HttpClient,
  InvokeInput,
  InvokeResult,
  RestInvokeInput,
} from "./types";

export class InvokeRouteError extends Error {}

export class DefaultHttpClient implements HttpClient {
  async request(input: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    payload?: unknown;
  }): Promise<unknown> {
    const response = await fetch(input.url, {
      method: input.method,
      headers: {
        "Content-Type": "application/json",
        ...(input.headers ?? {}),
      },
      body: input.method === "POST" ? JSON.stringify(input.payload ?? {}) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new InvokeRouteError(`REST invoke failed (${response.status}): ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

export class ChainHubRouter {
  constructor(
    private readonly cpiInvoker: CpiInvoker,
    private readonly httpClient: HttpClient = new DefaultHttpClient(),
    private readonly keyVault: KeyVaultAdapter = new EnvKeyVaultAdapter()
  ) {}

  async invoke(input: InvokeInput): Promise<InvokeResult> {
    ensureProtocolActive(input.protocol.status);
    this.keyVault.guard(input.policy, {
      capability: input.capability,
      method: input.method,
      amount: input.amount,
    });

    if (input.protocol.protocolType === "rest-api") {
      return this.invokeRest(input as RestInvokeInput);
    }
    return this.invokeCpi(input as CpiInvokeInput);
  }

  async invokeRest(input: RestInvokeInput): Promise<InvokeResult> {
    if (!input.protocol.endpoint) {
      throw new InvokeRouteError("REST protocol missing endpoint");
    }
    const method = input.method ?? "POST";
    const endpoint = input.protocol.endpoint.replace(/\/+$/, "");
    const capabilityPath = input.capability.replace(/^\/+/, "");
    const url = `${endpoint}/${capabilityPath}`;

    let headers: Record<string, string> | undefined;
    if (input.protocol.authMode === "key-vault") {
      if (!input.secretRef) {
        throw new KeyVaultError("secretRef required for key-vault auth mode");
      }
      headers = this.keyVault.buildAuthHeaders(input.secretRef);
    }

    const data = await this.httpClient.request({
      url,
      method,
      headers,
      payload: input.payload,
    });

    return {
      route: "rest-api",
      protocolId: input.protocol.id,
      capability: input.capability,
      data,
    };
  }

  async invokeCpi(input: CpiInvokeInput): Promise<InvokeResult> {
    if (!input.signer) {
      throw new InvokeRouteError("signer required for CPI invoke");
    }
    if (!input.protocol.programId) {
      throw new InvokeRouteError("CPI protocol missing programId");
    }

    const data = await this.cpiInvoker.invoke({
      programId: input.protocol.programId,
      capability: input.capability,
      payload: input.payload,
      signer: input.signer,
    });

    return {
      route: "solana-program",
      protocolId: input.protocol.id,
      capability: input.capability,
      data,
    };
  }
}

function ensureProtocolActive(status: "active" | "paused"): void {
  if (status !== "active") {
    throw new InvokeRouteError(`Protocol is not active: ${status}`);
  }
}
