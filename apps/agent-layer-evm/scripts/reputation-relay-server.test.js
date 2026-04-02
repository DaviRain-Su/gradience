const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");

const {
    createRelayServer,
    signHttpPayload,
    toVerifierPayload,
} = require("./reputation-relay-server.js");

function makeAgentPubkey() {
    return "11111111111111111111111111111111";
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
