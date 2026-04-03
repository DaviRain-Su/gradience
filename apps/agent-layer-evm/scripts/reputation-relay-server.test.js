const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");
const os = require("node:os");
const path = require("node:path");
const { mkdtemp } = require("node:fs/promises");

const bs58Module = require("bs58");
const { ethers } = require("ethers");

const {
    createRelayServer,
    signHttpPayload,
    toVerifierPayload,
} = require("./reputation-relay-server.js");

const bs58 = bs58Module.default ?? bs58Module;

function makeAgentPubkey(seed = 0) {
    const bytes = new Uint8Array(32);
    bytes.fill(seed);
    return bs58.encode(bytes);
}

test("toVerifierPayload normalizes scores and source chain", () => {
    const payload = toVerifierPayload({
        agentPubkey: makeAgentPubkey(),
        globalScore: 140,
        categoryScores: [120, -2],
        sourceChain: "solana",
        timestamp: 1710000000,
    });
    assert.equal(payload.globalScore, 100);
    assert.equal(payload.categoryScores.length, 8);
    assert.equal(payload.categoryScores[0], 100);
    assert.equal(payload.categoryScores[1], 0);
    assert.equal(typeof payload.sourceChain, "string");
});

test("relay server accepts signed submit and updates status", async () => {
    const keySeed = "11".repeat(32);
    const relayClient = {
        verifier: {
            submitReputation: async () => ({
                hash: "0xtx123",
                wait: async () => ({ blockNumber: 99 }),
            }),
        },
    };
    const server = createRelayServer({
        env: {
            ED25519_SECRET_KEY_HEX: keySeed,
            RELAY_AUTH_TOKEN: "token-1",
            RELAY_SIGNING_SECRET: "secret-1",
            RELAY_DRY_RUN: "1",
        },
        relayClient,
        logger: { error: () => {} },
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
        const body = JSON.stringify({
            event: "submit_reputation",
            payload: {
                agentPubkey: makeAgentPubkey(),
                globalScore: 81,
                categoryScores: [0, 81],
                sourceChain: "solana",
                timestamp: 1710000100,
            },
        });
        const ts = String(Math.floor(Date.now() / 1000));
        const signature = signHttpPayload("secret-1", ts, body);
        const response = await fetch(`${baseUrl}/relay/submit-reputation`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: "Bearer token-1",
                "x-gradience-signature-ts": ts,
                "x-gradience-signature": signature,
            },
            body,
        });
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.ok, true);
        assert.equal(result.txHash, "0xtx123");

        const statusResponse = await fetch(`${baseUrl}/status`);
        assert.equal(statusResponse.status, 200);
        const status = await statusResponse.json();
        assert.equal(status.success, 1);
        assert.equal(status.lastTxHash, "0xtx123");
    } finally {
        server.close();
    }
});

test("relay server supports ERC-8004 registration and feedback routes", async () => {
    const authToken = "token-1";
    const signingSecret = "secret-1";
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "gradience-erc8004-"));
    const mapFile = path.join(tmpDir, "agent-map.json");

    let registerCalls = 0;
    const feedbackCalls = [];
    const identityInterface = new ethers.Interface([
        "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
    ]);
    const identityRegistry = {
        interface: identityInterface,
        register: async () => {
            registerCalls += 1;
            const encoded = identityInterface.encodeEventLog(
                identityInterface.getEvent("Registered"),
                [42n, "data:application/json;base64,eyJvayI6dHJ1ZX0=", "0x0000000000000000000000000000000000000001"],
            );
            return {
                hash: "0xidentity42",
                wait: async () => ({ logs: [{ ...encoded }] }),
            };
        },
    };
    const reputationRegistry = {
        giveFeedback: async (...args) => {
            feedbackCalls.push(args);
            return {
                hash: "0xfeedback42",
                wait: async () => ({ blockNumber: 123 }),
            };
        },
    };

    const server = createRelayServer({
        env: {
            RELAY_AUTH_TOKEN: authToken,
            RELAY_SIGNING_SECRET: signingSecret,
            ERC8004_AGENT_MAP_FILE: mapFile,
            ERC8004_AUTO_REGISTER_ON_FEEDBACK: "true",
        },
        registryClient: { identityRegistry, reputationRegistry },
        logger: { error: () => {} },
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const agent = makeAgentPubkey(0);

    async function postSigned(pathname, bodyObject) {
        const body = JSON.stringify(bodyObject);
        const ts = String(Math.floor(Date.now() / 1000));
        const signature = signHttpPayload(signingSecret, ts, body);
        return fetch(`${baseUrl}${pathname}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${authToken}`,
                "x-gradience-signature-ts": ts,
                "x-gradience-signature": signature,
            },
            body,
        });
    }

    try {
        const registrationPayload = {
            type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
            agentPubkey: agent,
            registrations: [
                {
                    agentId: agent,
                    agentRegistry: "solana:101:metaplex",
                },
            ],
            services: [{ name: "a2a", endpoint: "a2a:gradience", version: "0.1" }],
            supportedTrust: ["reputation", "crypto-economic"],
        };

        const registerResponse = await postSigned(
            "/relay/erc8004/register-identity",
            registrationPayload,
        );
        assert.equal(registerResponse.status, 200);
        const registerResult = await registerResponse.json();
        assert.equal(registerResult.ok, true);
        assert.equal(registerResult.agentId, "42");
        assert.equal(registerResult.reused, false);

        const registerAgainResponse = await postSigned(
            "/relay/erc8004/register-identity",
            registrationPayload,
        );
        assert.equal(registerAgainResponse.status, 200);
        const registerAgainResult = await registerAgainResponse.json();
        assert.equal(registerAgainResult.reused, true);
        assert.equal(registerCalls, 1);

        const feedbackResponse = await postSigned(
            "/relay/erc8004/give-feedback",
            {
                agentPubkey: agent,
                value: 88,
                valueDecimals: 0,
                tag1: "taskScore",
                tag2: "category-1",
                endpoint: "solana:gradience",
                gradience: {
                    taskId: 1201,
                    winner: agent,
                    category: 1,
                    reasonRef: "cid://reason-1",
                    chainTx: "solana-tx-1",
                },
            },
        );
        assert.equal(feedbackResponse.status, 200);
        const feedbackResult = await feedbackResponse.json();
        assert.equal(feedbackResult.ok, true);
        assert.equal(feedbackResult.agentId, "42");
        assert.equal(feedbackCalls.length, 1);
        assert.equal(feedbackCalls[0][0], 42n);
        assert.equal(feedbackCalls[0][1], 88n);

        const statusResponse = await fetch(`${baseUrl}/status`);
        assert.equal(statusResponse.status, 200);
        const status = await statusResponse.json();
        assert.equal(status.erc8004.identity.success, 2);
        assert.equal(status.erc8004.feedback.success, 1);
        assert.equal(status.erc8004.knownAgents, 1);
    } finally {
        server.close();
    }
});
