const http = require("node:http");
const { createHmac, timingSafeEqual } = require("node:crypto");

const bs58Module = require("bs58");
const nacl = require("tweetnacl");
const { ethers } = require("ethers");

const bs58 = bs58Module.default ?? bs58Module;

const verifierAbi = [
    "function submitReputation((bytes32 agentPubkey,uint16 globalScore,uint16[8] categoryScores,bytes32 sourceChain,uint64 timestamp) payload, bytes32 signatureR, bytes32 signatureS) returns (bool)",
];

function toHex32(bytes) {
    return `0x${Buffer.from(bytes).toString("hex")}`;
}

function parseSecretKey(hex) {
    const raw = hex?.startsWith("0x") ? hex.slice(2) : hex;
    if (!raw || !/^[0-9a-fA-F]+$/.test(raw)) {
        throw new Error("ED25519_SECRET_KEY_HEX must be hex");
    }
    const bytes = Uint8Array.from(Buffer.from(raw, "hex"));
    if (bytes.length === 32) {
        return nacl.sign.keyPair.fromSeed(bytes);
    }
    if (bytes.length === 64) {
        return nacl.sign.keyPair.fromSecretKey(bytes);
    }
    throw new Error("ED25519_SECRET_KEY_HEX must be 32-byte seed or 64-byte secret key");
}

function parseAgentPubkey(agentPubkey) {
    const decoded = bs58.decode(agentPubkey);
    if (decoded.length !== 32) {
        throw new Error(`agentPubkey must decode to 32 bytes; got ${decoded.length}`);
    }
    return toHex32(decoded);
}

function clampScore(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeCategoryScores(scores) {
    if (!Array.isArray(scores)) {
        return [0, 0, 0, 0, 0, 0, 0, 0];
    }
    const normalized = scores.slice(0, 8).map((score) => clampScore(score));
    while (normalized.length < 8) {
        normalized.push(0);
    }
    return normalized;
}

function normalizeSourceChain(sourceChain) {
    const chain = sourceChain || "solana";
    if (typeof chain !== "string") {
        throw new Error("sourceChain must be a string");
    }
    return ethers.keccak256(ethers.toUtf8Bytes(chain));
}

function toVerifierPayload(input) {
    if (!input || typeof input !== "object") {
        throw new Error("invalid relay payload");
    }
    return {
        agentPubkey: parseAgentPubkey(input.agentPubkey),
        globalScore: clampScore(input.globalScore),
        categoryScores: normalizeCategoryScores(input.categoryScores),
        sourceChain: normalizeSourceChain(input.sourceChain),
        timestamp: BigInt(input.timestamp || Math.floor(Date.now() / 1000)),
    };
}

function encodePayload(payload) {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    return coder.encode(
        ["bytes32", "uint16", "uint16[8]", "bytes32", "uint64"],
        [
            payload.agentPubkey,
            payload.globalScore,
            payload.categoryScores,
            payload.sourceChain,
            payload.timestamp,
        ],
    );
}

function signVerifierPayload(payload, keypair) {
    const encoded = encodePayload(payload);
    const detached = nacl.sign.detached(ethers.getBytes(encoded), keypair.secretKey);
    return {
        r: toHex32(detached.slice(0, 32)),
        s: toHex32(detached.slice(32, 64)),
    };
}

function signHttpPayload(secret, timestamp, body) {
    return createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
}

function verifyHttpSignature(headers, body, secret) {
    if (!secret) {
        return true;
    }
    const timestamp = headers["x-gradience-signature-ts"];
    const signature = headers["x-gradience-signature"];
    if (!timestamp || !signature || Array.isArray(timestamp) || Array.isArray(signature)) {
        return false;
    }
    const expected = signHttpPayload(secret, timestamp, body);
    try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

function createRelayClient(env) {
    if (env.RELAY_DRY_RUN === "1") {
        return {
            verifier: {
                submitReputation: async () => ({
                    hash: `0xdryrun${Date.now().toString(16)}`,
                    wait: async () => ({ blockNumber: 0 }),
                }),
            },
        };
    }
    if (!env.EVM_RPC_URL || !env.VERIFIER_ADDRESS || !env.EVM_PRIVATE_KEY) {
        throw new Error(
            "EVM_RPC_URL, VERIFIER_ADDRESS and EVM_PRIVATE_KEY are required unless RELAY_DRY_RUN=1",
        );
    }
    const provider = new ethers.JsonRpcProvider(env.EVM_RPC_URL);
    const signer = new ethers.Wallet(env.EVM_PRIVATE_KEY, provider);
    const verifier = new ethers.Contract(env.VERIFIER_ADDRESS, verifierAbi, signer);
    return { verifier };
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function json(res, status, body) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}

function parseRelayInput(payload) {
    if (payload && payload.event === "submit_reputation" && payload.payload) {
        return payload.payload;
    }
    return payload;
}

async function relayReputation({ payload, relayClient, keypair }) {
    const verifierPayload = toVerifierPayload(payload);
    const signature = signVerifierPayload(verifierPayload, keypair);
    const tx = await relayClient.verifier.submitReputation(
        verifierPayload,
        signature.r,
        signature.s,
    );
    const receipt = await tx.wait();
    return {
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? null,
        payload: {
            ...verifierPayload,
            timestamp: verifierPayload.timestamp.toString(),
        },
        signature,
    };
}

function createRelayServer({
    env = process.env,
    relayClient = createRelayClient(env),
    logger = console,
} = {}) {
    const relayToken = env.RELAY_AUTH_TOKEN;
    const signingSecret = env.RELAY_SIGNING_SECRET;
    const keypair = parseSecretKey(env.ED25519_SECRET_KEY_HEX || "");
    const state = {
        total: 0,
        success: 0,
        failed: 0,
        lastTxHash: null,
        lastError: null,
        lastPayload: null,
    };

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
        if (url.pathname === "/healthz") {
            return json(res, 200, { ok: true });
        }
        if (url.pathname === "/status") {
            return json(res, 200, state);
        }

        if (req.method !== "POST" || url.pathname !== "/relay/submit-reputation") {
            return json(res, 404, { error: "Not found" });
        }

        if (relayToken && req.headers.authorization !== `Bearer ${relayToken}`) {
            return json(res, 401, { error: "Unauthorized" });
        }

        try {
            const bodyText = await readBody(req);
            if (!verifyHttpSignature(req.headers, bodyText, signingSecret)) {
                return json(res, 401, { error: "Invalid signature" });
            }
            const parsed = JSON.parse(bodyText);
            const relayPayload = parseRelayInput(parsed);
            state.total += 1;
            state.lastPayload = relayPayload;

            const result = await relayReputation({
                payload: relayPayload,
                relayClient,
                keypair,
            });
            state.success += 1;
            state.lastTxHash = result.txHash;
            state.lastError = null;
            return json(res, 200, { ok: true, ...result });
        } catch (error) {
            state.total += 1;
            state.failed += 1;
            state.lastError = error instanceof Error ? error.message : String(error);
            logger.error(`[evm-relay] relay failed: ${state.lastError}`);
            return json(res, 500, { error: state.lastError });
        }
    });

    return server;
}

async function main() {
    const server = createRelayServer();
    const host = process.env.RELAY_HOST || "127.0.0.1";
    const port = Number(process.env.RELAY_PORT || 8799);
    await new Promise((resolve) => server.listen(port, host, resolve));
    console.log(`[evm-relay] listening on http://${host}:${port}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error("[evm-relay] failed to start", error);
        process.exit(1);
    });
}

module.exports = {
    clampScore,
    createRelayServer,
    normalizeCategoryScores,
    parseAgentPubkey,
    parseSecretKey,
    relayReputation,
    signHttpPayload,
    signVerifierPayload,
    toVerifierPayload,
    verifyHttpSignature,
};
