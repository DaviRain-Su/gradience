const http = require("node:http");
const path = require("node:path");
const { createHmac, timingSafeEqual } = require("node:crypto");
const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");

const bs58Module = require("bs58");
const nacl = require("tweetnacl");
const { ethers } = require("ethers");

const bs58 = bs58Module.default ?? bs58Module;

const verifierAbi = [
    "function submitReputation((bytes32 agentPubkey,uint16 globalScore,uint16[8] categoryScores,bytes32 sourceChain,uint64 timestamp) payload, bytes32 signatureR, bytes32 signatureS) returns (bool)",
];

const identityRegistryAbi = [
    "function register(string agentURI,(string metadataKey,bytes metadataValue)[] metadata) returns (uint256)",
    "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

const reputationRegistryAbi = [
    "function giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash)",
];

const DEFAULT_ERC8004_TESTNET_ADDRESSES = {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
};

const DEFAULT_ERC8004_MAINNET_ADDRESSES = {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
};

const INT128_MIN = -(1n << 127n);
const INT128_MAX = (1n << 127n) - 1n;

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

function normalizeRegistryNetwork(value) {
    if (value === "mainnet" || value === "testnet") {
        return value;
    }
    return "testnet";
}

function resolveRegistryAddresses(env) {
    const defaults =
        normalizeRegistryNetwork(env.ERC8004_NETWORK) === "mainnet"
            ? DEFAULT_ERC8004_MAINNET_ADDRESSES
            : DEFAULT_ERC8004_TESTNET_ADDRESSES;
    return {
        identityRegistry:
            env.ERC8004_IDENTITY_REGISTRY_ADDRESS ?? defaults.identityRegistry,
        reputationRegistry:
            env.ERC8004_REPUTATION_REGISTRY_ADDRESS ?? defaults.reputationRegistry,
    };
}

class AgentIdStore {
    constructor(filePath) {
        this.filePath = filePath || null;
        this.records = {};
        this.loaded = false;
    }

    async ensureLoaded() {
        if (this.loaded) {
            return;
        }
        this.loaded = true;
        if (!this.filePath) {
            return;
        }
        try {
            const raw = await readFile(this.filePath, "utf8");
            if (!raw.trim()) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                return;
            }
            for (const [agentPubkey, record] of Object.entries(parsed)) {
                if (!record || typeof record !== "object") {
                    continue;
                }
                const agentId = asNonEmptyString(record.agentId);
                const registrationTxHash = asNonEmptyString(record.registrationTxHash);
                const updatedAt = Number(record.updatedAt ?? Date.now());
                if (!agentId) {
                    continue;
                }
                this.records[agentPubkey] = {
                    agentId,
                    registrationTxHash: registrationTxHash ?? null,
                    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
                };
            }
        } catch {
            this.records = {};
        }
    }

    async get(agentPubkey) {
        await this.ensureLoaded();
        return this.records[agentPubkey] ?? null;
    }

    async set(agentPubkey, record) {
        await this.ensureLoaded();
        this.records[agentPubkey] = {
            agentId: record.agentId,
            registrationTxHash: record.registrationTxHash ?? null,
            updatedAt: record.updatedAt ?? Date.now(),
        };
        await this.persist();
    }

    async count() {
        await this.ensureLoaded();
        return Object.keys(this.records).length;
    }

    async persist() {
        if (!this.filePath) {
            return;
        }
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const tmpPath = `${this.filePath}.tmp`;
        await writeFile(tmpPath, JSON.stringify(this.records, null, 2), "utf8");
        await rename(tmpPath, this.filePath);
    }
}

function toDataUri(payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    return `data:application/json;base64,${body}`;
}

function parseOptionalBigInt(value, fieldName) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (typeof value === "bigint") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`${fieldName} must be a non-negative integer`);
        }
        return BigInt(value);
    }
    if (typeof value === "string") {
        if (!/^\d+$/.test(value)) {
            throw new Error(`${fieldName} must be a decimal uint string`);
        }
        return BigInt(value);
    }
    throw new Error(`${fieldName} must be a uint-compatible value`);
}

function toInt128(value, fieldName) {
    if (typeof value === "bigint") {
        if (value < INT128_MIN || value > INT128_MAX) {
            throw new Error(`${fieldName} is outside int128 range`);
        }
        return value;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} must be numeric`);
    }
    const integer = BigInt(Math.round(parsed));
    if (integer < INT128_MIN || integer > INT128_MAX) {
        throw new Error(`${fieldName} is outside int128 range`);
    }
    return integer;
}

function parseValueDecimals(value) {
    const parsed = Number(value ?? 0);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 18) {
        throw new Error("valueDecimals must be an integer between 0 and 18");
    }
    return parsed;
}

function asNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseIdentityRegistrationInput(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("invalid identity registration payload");
    }
    const registration = Array.isArray(payload.registrations) ? payload.registrations[0] : null;
    const solanaAgent =
        asNonEmptyString(payload.agentPubkey) ||
        asNonEmptyString(registration?.agentId) ||
        asNonEmptyString(payload.name);
    if (!solanaAgent) {
        throw new Error("missing agent pubkey (agentPubkey or registrations[0].agentId)");
    }
    return { solanaAgent, payload };
}

function parseFeedbackInput(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("invalid feedback payload");
    }
    const gradience =
        payload.gradience && typeof payload.gradience === "object" && !Array.isArray(payload.gradience)
            ? payload.gradience
            : {};
    const solanaAgent =
        asNonEmptyString(payload.agentPubkey) ||
        asNonEmptyString(gradience.winner) ||
        asNonEmptyString(payload.winner);
    const agentId =
        parseOptionalBigInt(payload.agentId, "agentId") ??
        parseOptionalBigInt(gradience.agentId, "gradience.agentId");
    const rawValue = payload.value ?? payload.score ?? gradience.score;
    if (rawValue === undefined || rawValue === null) {
        throw new Error("missing feedback score/value");
    }
    const value = toInt128(rawValue, "value");
    const valueDecimals = parseValueDecimals(payload.valueDecimals);
    const tag1 = asNonEmptyString(payload.tag1) ?? "taskScore";
    const tag2 =
        asNonEmptyString(payload.tag2) ??
        (typeof gradience.category === "number" ? `category-${gradience.category}` : "category-unknown");
    const endpoint = asNonEmptyString(payload.endpoint) ?? "solana:gradience";
    const feedbackURI =
        asNonEmptyString(payload.feedbackURI) ??
        asNonEmptyString(payload.feedbackUri) ??
        asNonEmptyString(gradience.reasonRef) ??
        toDataUri(payload);
    let feedbackHash = asNonEmptyString(payload.feedbackHash);
    if (!feedbackHash || !ethers.isHexString(feedbackHash, 32)) {
        feedbackHash = ethers.keccak256(
            ethers.toUtf8Bytes(JSON.stringify(gradience && Object.keys(gradience).length > 0 ? gradience : payload)),
        );
    }
    return {
        solanaAgent,
        agentId,
        value,
        valueDecimals,
        tag1,
        tag2,
        endpoint,
        feedbackURI,
        feedbackHash,
        gradience,
    };
}

function buildRegistrationMetadata(input) {
    const registrations = Array.isArray(input.payload.registrations)
        ? input.payload.registrations
        : [];
    const firstRegistration =
        registrations.length > 0 && registrations[0] && typeof registrations[0] === "object"
            ? registrations[0]
            : {};
    return [
        {
            metadataKey: "solanaPubkey",
            metadataValue: ethers.toUtf8Bytes(input.solanaAgent),
        },
        {
            metadataKey: "agentRegistry",
            metadataValue: ethers.toUtf8Bytes(
                asNonEmptyString(firstRegistration.agentRegistry) ?? "solana:101:metaplex",
            ),
        },
        {
            metadataKey: "sourceProtocol",
            metadataValue: ethers.toUtf8Bytes("gradience"),
        },
    ];
}

function buildRegistrationUri(input) {
    return (
        asNonEmptyString(input.payload.agentURI) ??
        asNonEmptyString(input.payload.agentUri) ??
        toDataUri(input.payload)
    );
}

function parseRegisteredAgentId(receipt, iface) {
    if (!receipt || !Array.isArray(receipt.logs)) {
        throw new Error("identity registration receipt is missing logs");
    }
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (!parsed || parsed.name !== "Registered") {
                continue;
            }
            const agentId = parsed.args?.agentId ?? parsed.args?.[0];
            return BigInt(agentId.toString());
        } catch {
            continue;
        }
    }
    throw new Error("identity registration did not emit Registered event");
}

async function callIdentityRegister(identityRegistry, agentURI, metadata) {
    const overloaded = identityRegistry["register(string,(string,bytes)[])"];
    if (typeof overloaded === "function") {
        return overloaded(agentURI, metadata);
    }
    return identityRegistry.register(agentURI, metadata);
}

async function ensureAgentRegistration({
    input,
    registryClient,
    agentIdStore,
}) {
    const existing = await agentIdStore.get(input.solanaAgent);
    if (existing) {
        return {
            agentId: BigInt(existing.agentId),
            txHash: existing.registrationTxHash,
            reused: true,
        };
    }
    if (!registryClient?.identityRegistry) {
        throw new Error("ERC-8004 identity registry relay is not configured");
    }
    const metadata = buildRegistrationMetadata(input);
    const agentURI = buildRegistrationUri(input);
    const tx = await callIdentityRegister(
        registryClient.identityRegistry,
        agentURI,
        metadata,
    );
    const receipt = await tx.wait();
    const agentId = parseRegisteredAgentId(
        receipt,
        registryClient.identityRegistry.interface,
    );
    await agentIdStore.set(input.solanaAgent, {
        agentId: agentId.toString(),
        registrationTxHash: tx.hash,
        updatedAt: Date.now(),
    });
    return { agentId, txHash: tx.hash, reused: false };
}

function buildAutoRegistrationPayload(feedbackInput) {
    return {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        name: feedbackInput.solanaAgent,
        agentPubkey: feedbackInput.solanaAgent,
        services: [
            { name: "gradience", endpoint: "solana:gradience", version: "0.3" },
            { name: "a2a", endpoint: "a2a:gradience", version: "0.1" },
        ],
        supportedTrust: ["reputation", "crypto-economic"],
        registrations: [
            {
                agentId: feedbackInput.solanaAgent,
                agentRegistry: "solana:101:metaplex",
            },
        ],
        gradience: {
            taskId: feedbackInput.gradience.taskId ?? null,
            chainTx: feedbackInput.gradience.chainTx ?? null,
        },
    };
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

function createRegistryClient(env) {
    if (env.ERC8004_RELAY_DRY_RUN === "1" || env.RELAY_DRY_RUN === "1") {
        let nextAgentId = 1n;
        const identityInterface = new ethers.Interface(identityRegistryAbi);
        return {
            identityRegistry: {
                interface: identityInterface,
                register: async () => {
                    const agentId = nextAgentId;
                    nextAgentId += 1n;
                    const encoded = identityInterface.encodeEventLog(
                        identityInterface.getEvent("Registered"),
                        [agentId, "", "0x0000000000000000000000000000000000000001"],
                    );
                    return {
                        hash: `0xdryrunidentity${agentId.toString(16).padStart(4, "0")}`,
                        wait: async () => ({ logs: [{ ...encoded }] }),
                    };
                },
            },
            reputationRegistry: {
                giveFeedback: async () => ({
                    hash: `0xdryrunfeedback${Date.now().toString(16)}`,
                    wait: async () => ({ blockNumber: 0 }),
                }),
            },
        };
    }

    const rpcUrl = env.ERC8004_RPC_URL ?? env.EVM_RPC_URL;
    const identityPrivateKey =
        env.ERC8004_IDENTITY_PRIVATE_KEY ?? env.EVM_PRIVATE_KEY;
    const feedbackPrivateKey =
        env.ERC8004_FEEDBACK_PRIVATE_KEY ?? env.EVM_PRIVATE_KEY;

    if (!rpcUrl || !identityPrivateKey || !feedbackPrivateKey) {
        return null;
    }

    const { identityRegistry, reputationRegistry } = resolveRegistryAddresses(env);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const identitySigner = new ethers.Wallet(identityPrivateKey, provider);
    const feedbackSigner = new ethers.Wallet(feedbackPrivateKey, provider);

    return {
        identityRegistry: new ethers.Contract(
            identityRegistry,
            identityRegistryAbi,
            identitySigner,
        ),
        reputationRegistry: new ethers.Contract(
            reputationRegistry,
            reputationRegistryAbi,
            feedbackSigner,
        ),
        identitySignerAddress: identitySigner.address,
        feedbackSignerAddress: feedbackSigner.address,
    };
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
    relayClient,
    registryClient,
    logger = console,
} = {}) {
    const relayToken = env.RELAY_AUTH_TOKEN;
    const signingSecret = env.RELAY_SIGNING_SECRET;
    const keypair = env.ED25519_SECRET_KEY_HEX
        ? parseSecretKey(env.ED25519_SECRET_KEY_HEX)
        : null;
    const autoRegisterOnFeedback = env.ERC8004_AUTO_REGISTER_ON_FEEDBACK !== "false";
    const agentIdStore = new AgentIdStore(
        env.ERC8004_AGENT_MAP_FILE ??
            path.resolve(process.cwd(), ".tmp", "erc8004-agent-map.json"),
    );

    let activeRelayClient = relayClient ?? null;
    let activeRegistryClient = registryClient ?? null;

    const state = {
        total: 0,
        success: 0,
        failed: 0,
        lastTxHash: null,
        lastError: null,
        lastPayload: null,
        erc8004: {
            identity: {
                total: 0,
                success: 0,
                failed: 0,
                lastAgent: null,
                lastAgentId: null,
                lastTxHash: null,
                lastError: null,
            },
            feedback: {
                total: 0,
                success: 0,
                failed: 0,
                lastAgent: null,
                lastAgentId: null,
                lastTxHash: null,
                lastError: null,
            },
        },
    };

    function getRelayClient() {
        if (!activeRelayClient) {
            activeRelayClient = createRelayClient(env);
        }
        return activeRelayClient;
    }

    function getRegistryClient() {
        if (!activeRegistryClient) {
            activeRegistryClient = createRegistryClient(env);
        }
        return activeRegistryClient;
    }

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
        if (url.pathname === "/healthz") {
            return json(res, 200, { ok: true });
        }
        if (url.pathname === "/status") {
            const knownAgents = await agentIdStore.count();
            return json(res, 200, {
                ...state,
                erc8004: {
                    ...state.erc8004,
                    knownAgents,
                },
            });
        }

        const isKnownRoute =
            req.method === "POST" &&
            (url.pathname === "/relay/submit-reputation" ||
                url.pathname === "/relay/erc8004/register-identity" ||
                url.pathname === "/relay/erc8004/give-feedback");
        if (!isKnownRoute) {
            return json(res, 404, { error: "Not found" });
        }

        if (relayToken && req.headers.authorization !== `Bearer ${relayToken}`) {
            return json(res, 401, { error: "Unauthorized" });
        }

        const bodyText = await readBody(req);
        if (!verifyHttpSignature(req.headers, bodyText, signingSecret)) {
            return json(res, 401, { error: "Invalid signature" });
        }

        let parsed;
        try {
            parsed = JSON.parse(bodyText);
        } catch {
            return json(res, 400, { error: "Invalid JSON body" });
        }

        if (url.pathname === "/relay/submit-reputation") {
            try {
                if (!keypair) {
                    throw new Error(
                        "ED25519_SECRET_KEY_HEX is required for /relay/submit-reputation",
                    );
                }
                const relayPayload = parseRelayInput(parsed);
                state.total += 1;
                state.lastPayload = relayPayload;

                const result = await relayReputation({
                    payload: relayPayload,
                    relayClient: getRelayClient(),
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
        }

        if (url.pathname === "/relay/erc8004/register-identity") {
            state.erc8004.identity.total += 1;
            try {
                const input = parseIdentityRegistrationInput(parsed);
                const registry = getRegistryClient();
                if (!registry) {
                    throw new Error("ERC-8004 registry relay is not configured");
                }
                const registration = await ensureAgentRegistration({
                    input,
                    registryClient: registry,
                    agentIdStore,
                });
                state.erc8004.identity.success += 1;
                state.erc8004.identity.lastAgent = input.solanaAgent;
                state.erc8004.identity.lastAgentId = registration.agentId.toString();
                state.erc8004.identity.lastTxHash = registration.txHash ?? null;
                state.erc8004.identity.lastError = null;
                return json(res, 200, {
                    ok: true,
                    agentPubkey: input.solanaAgent,
                    agentId: registration.agentId.toString(),
                    reused: registration.reused,
                    txHash: registration.txHash,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                state.erc8004.identity.failed += 1;
                state.erc8004.identity.lastError = message;
                logger.error(`[evm-relay] identity registration failed: ${message}`);
                return json(res, 500, { error: message });
            }
        }

        state.erc8004.feedback.total += 1;
        try {
            const input = parseFeedbackInput(parsed);
            const registry = getRegistryClient();
            if (!registry?.reputationRegistry) {
                throw new Error("ERC-8004 reputation relay is not configured");
            }

            let agentId = input.agentId;
            let registrationResult = null;

            if (agentId === null) {
                if (!input.solanaAgent) {
                    throw new Error("feedback payload is missing agentPubkey/gradience.winner");
                }
                const existing = await agentIdStore.get(input.solanaAgent);
                if (existing) {
                    agentId = BigInt(existing.agentId);
                } else if (autoRegisterOnFeedback) {
                    registrationResult = await ensureAgentRegistration({
                        input: parseIdentityRegistrationInput(
                            buildAutoRegistrationPayload(input),
                        ),
                        registryClient: registry,
                        agentIdStore,
                    });
                    agentId = registrationResult.agentId;
                } else {
                    throw new Error(
                        `agent ${input.solanaAgent} is not registered; enable ERC8004_AUTO_REGISTER_ON_FEEDBACK or call /relay/erc8004/register-identity first`,
                    );
                }
            }

            const tx = await registry.reputationRegistry.giveFeedback(
                agentId,
                input.value,
                input.valueDecimals,
                input.tag1,
                input.tag2,
                input.endpoint,
                input.feedbackURI,
                input.feedbackHash,
            );
            await tx.wait();

            state.erc8004.feedback.success += 1;
            state.erc8004.feedback.lastAgent = input.solanaAgent;
            state.erc8004.feedback.lastAgentId = agentId.toString();
            state.erc8004.feedback.lastTxHash = tx.hash;
            state.erc8004.feedback.lastError = null;
            return json(res, 200, {
                ok: true,
                agentPubkey: input.solanaAgent,
                agentId: agentId.toString(),
                txHash: tx.hash,
                autoRegistered: registrationResult ? !registrationResult.reused : false,
                identityTxHash: registrationResult?.txHash ?? null,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            state.erc8004.feedback.failed += 1;
            state.erc8004.feedback.lastError = message;
            logger.error(`[evm-relay] feedback relay failed: ${message}`);
            return json(res, 500, { error: message });
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
    createRelayClient,
    createRegistryClient,
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
