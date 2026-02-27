export type SignRequest = {
  txRequest: Record<string, unknown>;
  fromAddress?: string;
  chainId?: number;
};

export type SignResponse = {
  signedTxHex: string;
  signer: string;
};

export interface SignerAdapter {
  id: string;
  sign(request: SignRequest): Promise<SignResponse>;
}

export class DisabledSignerAdapter implements SignerAdapter {
  id = "disabled";

  async sign(_request: SignRequest): Promise<SignResponse> {
    throw new Error("signer adapter is not configured");
  }
}

export class HttpSignerAdapter implements SignerAdapter {
  id = "http";

  constructor(private readonly signerUrl: string) {}

  async sign(request: SignRequest): Promise<SignResponse> {
    const response = await fetch(this.signerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`http signer failed with status ${response.status}`);
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const signedTxHex = payload.signedTxHex;
    if (typeof signedTxHex !== "string" || !signedTxHex.startsWith("0x")) {
      throw new Error("http signer response missing signedTxHex");
    }
    const signer = typeof payload.signer === "string" && payload.signer ? payload.signer : this.id;
    return { signedTxHex, signer };
  }
}

export function createSignerAdapterFromEnv(env = process.env): SignerAdapter {
  const signerUrl = env.GRADIENCE_SIGNER_URL;
  if (signerUrl && signerUrl.trim()) {
    return new HttpSignerAdapter(signerUrl.trim());
  }
  return new DisabledSignerAdapter();
}
