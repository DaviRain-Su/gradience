import morphoSdk from "@morpho-org/blue-sdk";

export async function fetchMorphoVaultMeta(vaultAddress: string) {
  const sdk = morphoSdk as Record<string, unknown>;
  const resolver = sdk?.getVault as
    | ((address: string) => Promise<Record<string, unknown>>)
    | undefined;
  if (!resolver) {
    return { status: "sdk_missing", vaultAddress };
  }
  const data = await resolver(vaultAddress);
  return { status: "ok", vaultAddress, data };
}
