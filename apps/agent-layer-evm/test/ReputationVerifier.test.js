const { expect } = require("chai");
require("@nomicfoundation/hardhat-chai-matchers");
const { ethers } = require("hardhat");
const nacl = require("tweetnacl");

describe("ReputationVerifier", function () {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const payloadTypes = ["bytes32", "uint16", "uint16[8]", "bytes32", "uint64"];

    function toHex32(bytes) {
        return `0x${Buffer.from(bytes).toString("hex")}`;
    }

    function signPayload(payload, secretKey) {
        const encoded = abiCoder.encode(payloadTypes, [
            payload.agentPubkey,
            payload.globalScore,
            payload.categoryScores,
            payload.sourceChain,
            payload.timestamp,
        ]);
        const signature = nacl.sign.detached(ethers.getBytes(encoded), secretKey);
        const r = toHex32(signature.slice(0, 32));
        const s = toHex32(signature.slice(32, 64));
        return { r, s };
    }

    async function deployFixture() {
        const [owner] = await ethers.getSigners();
        const seed = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1));
        const keypair = nacl.sign.keyPair.fromSeed(seed);
        const signerPubkey = toHex32(keypair.publicKey);

        const factory = await ethers.getContractFactory("ReputationVerifier", owner);
        const verifier = await factory.deploy(signerPubkey, 7 * 24 * 60 * 60);
        await verifier.waitForDeployment();

        const latestBlock = await ethers.provider.getBlock("latest");
        const timestamp = BigInt(latestBlock.timestamp);
        const payload = {
            agentPubkey: ethers.keccak256(ethers.toUtf8Bytes("agent-solana-pubkey")),
            globalScore: 82,
            categoryScores: [80, 78, 88, 72, 90, 0, 0, 0],
            sourceChain: await verifier.SOLANA_CHAIN_HASH(),
            timestamp,
        };

        return { verifier, keypair, payload };
    }

    it("verifyReputation returns true for valid ed25519 signature", async function () {
        const { verifier, keypair, payload } = await deployFixture();
        const { r, s } = signPayload(payload, keypair.secretKey);

        expect(await verifier.verifyReputation(payload, r, s)).to.equal(true);
    });

    it("submitReputation stores snapshot for valid attestation", async function () {
        const { verifier, keypair, payload } = await deployFixture();
        const { r, s } = signPayload(payload, keypair.secretKey);

        await expect(verifier.submitReputation(payload, r, s))
            .to.emit(verifier, "ReputationStored")
            .withArgs(payload.agentPubkey, payload.globalScore, payload.timestamp);

        const [snapshot, exists] = await verifier.getSnapshot(payload.agentPubkey);
        expect(exists).to.equal(true);
        expect(snapshot.globalScore).to.equal(payload.globalScore);
        expect(snapshot.timestamp).to.equal(payload.timestamp);
    });

    it("verifyReputation returns false for tampered payload", async function () {
        const { verifier, keypair, payload } = await deployFixture();
        const { r, s } = signPayload(payload, keypair.secretKey);
        const tampered = { ...payload, globalScore: 95 };

        expect(await verifier.verifyReputation(tampered, r, s)).to.equal(false);
    });

    it("verifyReputation returns false when sourceChain != solana", async function () {
        const { verifier, keypair, payload } = await deployFixture();
        const invalidPayload = {
            ...payload,
            sourceChain: ethers.keccak256(ethers.toUtf8Bytes("ethereum")),
        };
        const { r, s } = signPayload(invalidPayload, keypair.secretKey);
        expect(await verifier.verifyReputation(invalidPayload, r, s)).to.equal(false);
    });

    it("submitReputation rejects non-monotonic timestamp replay", async function () {
        const { verifier, keypair, payload } = await deployFixture();
        const first = signPayload(payload, keypair.secretKey);
        await verifier.submitReputation(payload, first.r, first.s);

        const replay = signPayload(payload, keypair.secretKey);
        await expect(verifier.submitReputation(payload, replay.r, replay.s)).to.be.revertedWith(
            "NON_MONOTONIC_TIMESTAMP",
        );
    });

    it("verifyReputation remains valid when maxAttestationAge is uint64 max", async function () {
        const { verifier, keypair, payload } = await deployFixture();
        await verifier.setMaxAttestationAge((1n << 64n) - 1n);
        const { r, s } = signPayload(payload, keypair.secretKey);

        expect(await verifier.verifyReputation(payload, r, s)).to.equal(true);
    });
});
