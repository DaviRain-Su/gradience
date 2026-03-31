import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createProfile,
    isByte,
    parseKeypairAddress,
} from './wallet-utils';

test('isByte validates range', () => {
    assert.equal(isByte(0), true);
    assert.equal(isByte(255), true);
    assert.equal(isByte(-1), false);
    assert.equal(isByte(256), false);
    assert.equal(isByte('1'), false);
});

test('createProfile assigns metadata', () => {
    const profile = createProfile('openwallet', 'Primary', '11111111111111111111111111111111');
    assert.equal(profile.type, 'openwallet');
    assert.equal(profile.label, 'Primary');
    assert.equal(profile.address, '11111111111111111111111111111111');
    assert.ok(profile.id.startsWith('openwallet-'));
});

test('parseKeypairAddress rejects malformed keypair input', async () => {
    await assert.rejects(
        () => parseKeypairAddress('[1,2,3]'),
        /64-byte JSON array/i,
    );
});
