import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Keypair, PublicKey } from '@solana/web3.js';

import {
    buildUpgradeConfigInstruction,
    decodeProgramConfigUpgradeAuthority,
    deriveConfigPda,
    encodeUpgradeConfigData,
    parseSplTokenMintAddress,
} from './t42-governance.js';

test('encodeUpgradeConfigData encodes both optional fields when provided', () => {
    const treasury = Keypair.generate().publicKey;
    const data = encodeUpgradeConfigData({
        newTreasury: treasury,
        newMinJudgeStake: 1_000_000_000n,
    });

    assert.equal(data[0], 10);
    assert.equal(data[1], 1);
    assert.deepEqual(data.subarray(2, 34), treasury.toBuffer());
    assert.equal(data[34], 1);
    assert.equal(data.readBigUInt64LE(35), 1_000_000_000n);
    assert.equal(data.length, 43);
});

test('buildUpgradeConfigInstruction sets authority signer and writable config', () => {
    const programId = Keypair.generate().publicKey;
    const authority = Keypair.generate().publicKey;
    const config = Keypair.generate().publicKey;

    const instruction = buildUpgradeConfigInstruction({
        programId,
        authority,
        config,
        newTreasury: null,
        newMinJudgeStake: 9n,
    });

    assert.equal(instruction.programId.toBase58(), programId.toBase58());
    assert.equal(instruction.keys[0]?.pubkey.toBase58(), authority.toBase58());
    assert.equal(instruction.keys[0]?.isSigner, true);
    assert.equal(instruction.keys[0]?.isWritable, false);
    assert.equal(instruction.keys[1]?.pubkey.toBase58(), config.toBase58());
    assert.equal(instruction.keys[1]?.isWritable, true);
    assert.equal(instruction.data[0], 10);
});

test('decodeProgramConfigUpgradeAuthority reads upgrade authority bytes', () => {
    const treasury = Keypair.generate().publicKey.toBuffer();
    const upgradeAuthority = Keypair.generate().publicKey;
    const minStake = Buffer.alloc(8);
    minStake.writeBigUInt64LE(2_000_000_000n);

    const encoded = Buffer.concat([Buffer.from([0x09, 0x01]), treasury, upgradeAuthority.toBuffer(), minStake]);
    const decoded = decodeProgramConfigUpgradeAuthority(encoded);
    assert.equal(decoded.toBase58(), upgradeAuthority.toBase58());
});

test('deriveConfigPda remains deterministic for a known program id', () => {
    const programId = new PublicKey('5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs');
    const pdaA = deriveConfigPda(programId);
    const pdaB = deriveConfigPda(programId);
    assert.equal(pdaA.toBase58(), pdaB.toBase58());
});

test('parseSplTokenMintAddress extracts mint from spl-token output', () => {
    const mint = '9xQeWvG816bUx9EPfFJ6x2j8fS3nKzQ5f8G4hYQxwJ7';
    const output = `Creating token ${mint}\nSignature: 5abc...`;
    assert.equal(parseSplTokenMintAddress(output), mint);
});
