const { ethers, network } = require('hardhat');

function requireHex32(value, label) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value || '')) {
        throw new Error(`${label} must be a 32-byte hex string`);
    }
    return value;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const signerPubkey = requireHex32(process.env.ED25519_SIGNER_PUBKEY_HEX, 'ED25519_SIGNER_PUBKEY_HEX');
    const maxAttestationAge = BigInt(process.env.MAX_ATTESTATION_AGE_SECONDS || String(7 * 24 * 60 * 60));

    const factory = await ethers.getContractFactory('ReputationVerifier');
    const verifier = await factory.deploy(signerPubkey, maxAttestationAge);
    await verifier.waitForDeployment();

    console.log('network:', network.name);
    console.log('deployer:', deployer.address);
    console.log('ed25519_signer:', signerPubkey);
    console.log('max_attestation_age_seconds:', maxAttestationAge.toString());
    console.log('reputation_verifier:', await verifier.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
