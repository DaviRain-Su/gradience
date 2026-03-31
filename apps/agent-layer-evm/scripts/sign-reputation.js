const bs58Module = require("bs58");
const nacl = require("tweetnacl");
const { ethers } = require("ethers");

const bs58 = bs58Module.default ?? bs58Module;

const verifierAbi = [
    "function verifyReputation((bytes32 agentPubkey,uint16 globalScore,uint16[8] categoryScores,bytes32 sourceChain,uint64 timestamp) payload, bytes32 signatureR, bytes32 signatureS) view returns (bool)",
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
        throw new Error(`AGENT_PUBKEY must decode to 32 bytes; got ${decoded.length}`);
    }
    return toHex32(decoded);
}

function parseCategoryScores(value) {
    if (!value) {
        return [0, 0, 0, 0, 0, 0, 0, 0];
    }
    const parsed = value.split(",").map((item) => Number(item.trim()));
    if (parsed.length !== 8 || parsed.some((item) => !Number.isInteger(item) || item < 0 || item > 1000)) {
        throw new Error("CATEGORY_SCORES must be comma-separated 8 integers (0..1000)");
    }
    return parsed;
}

async function resolveGlobalScore(env) {
    if (env.GLOBAL_SCORE) {
        return Number(env.GLOBAL_SCORE);
    }
    const endpoint = env.INDEXER_ENDPOINT || "http://127.0.0.1:3001";
    const agentPubkey = env.AGENT_PUBKEY;
    const url = `${endpoint.replace(/\/$/, "")}/api/agents/${agentPubkey}/reputation`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch reputation from ${url}: ${response.status}`);
    }
    const reputation = await response.json();
    if (!reputation || typeof reputation.global_avg_score !== "number") {
        throw new Error("Indexer response missing global_avg_score");
    }
    return Math.max(0, Math.min(100, Math.round(reputation.global_avg_score)));
}

function encodePayload(payload) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
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

async function verifyOnChainIfConfigured(env, payload, signature) {
    if (!env.VERIFIER_ADDRESS || !env.EVM_RPC_URL) {
        return null;
    }
    const provider = new ethers.JsonRpcProvider(env.EVM_RPC_URL);
    const verifier = new ethers.Contract(env.VERIFIER_ADDRESS, verifierAbi, provider);
    return verifier.verifyReputation(payload, signature.r, signature.s);
}

async function main() {
    const env = process.env;
    if (!env.AGENT_PUBKEY) {
        throw new Error("AGENT_PUBKEY is required");
    }
    if (!env.ED25519_SECRET_KEY_HEX) {
        throw new Error("ED25519_SECRET_KEY_HEX is required");
    }

    const keypair = parseSecretKey(env.ED25519_SECRET_KEY_HEX);
    const agentPubkey = parseAgentPubkey(env.AGENT_PUBKEY);
    const globalScore = await resolveGlobalScore(env);
    const categoryScores = parseCategoryScores(env.CATEGORY_SCORES);
    const sourceChain = ethers.keccak256(ethers.toUtf8Bytes(env.SOURCE_CHAIN || "solana"));
    const timestamp = BigInt(env.TIMESTAMP || Math.floor(Date.now() / 1000));

    const payload = {
        agentPubkey,
        globalScore,
        categoryScores,
        sourceChain,
        timestamp,
    };
    const message = encodePayload(payload);
    const detached = nacl.sign.detached(ethers.getBytes(message), keypair.secretKey);
    const signature = {
        r: toHex32(detached.slice(0, 32)),
        s: toHex32(detached.slice(32, 64)),
    };
    const verifiedOnChain = await verifyOnChainIfConfigured(env, payload, signature);

    const output = {
        payload: {
            ...payload,
            timestamp: payload.timestamp.toString(),
        },
        signerPubkey: toHex32(keypair.publicKey),
        signature,
        verifiedOnChain,
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
});
