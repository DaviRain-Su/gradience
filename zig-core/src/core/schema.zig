pub const protocol_version = "0.1.0";

pub const supported_actions = [_][]const u8{
    "schema",
    "providersList",
    "runtimeInfo",
    "cachePolicy",
    "policyCheck",
    "normalizeChain",
    "assetsResolve",
    "normalizeAmount",
    "cachePut",
    "cacheGet",
    "rpcCallCached",
    "getBalance",
    "getErc20Balance",
    "getBlockNumber",
    "buildTransferNative",
    "buildTransferErc20",
    "buildErc20Approve",
    "buildDexSwap",
    "estimateGas",
    "sendSignedTransaction",
};
