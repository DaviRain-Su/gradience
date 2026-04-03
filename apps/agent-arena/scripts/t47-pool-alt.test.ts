import assert from 'node:assert/strict';
import test from 'node:test';

import type { T47DrillCase, T47DrillResult } from './t47-pool-alt.ts';
import { buildCoverage } from './t47-pool-alt.ts';

test('buildCoverage marks unimplemented n50/n100 cells', () => {
    const cases: T47DrillCase[] = [
        {
            id: 'pool-n20',
            scenario: 'pool_settlement',
            scale: 'n20',
            description: 'pool',
            command: 'echo',
            required: true,
        },
    ];
    const results: T47DrillResult[] = [
        {
            id: 'pool-n20',
            scenario: 'pool_settlement',
            scale: 'n20',
            description: 'pool',
            command: 'echo',
            required: true,
            success: true,
            exitCode: 0,
            durationMs: 1,
            stdout: '',
            stderr: '',
        },
    ];

    const coverage = buildCoverage(cases, results);
    const pool = coverage.find(entry => entry.scenario === 'pool_settlement');
    assert.ok(pool);
    assert.equal(pool.overall, 'pass');
    assert.equal(pool.cells.find(entry => entry.scale === 'n50')?.status, 'not_implemented');
});

test('buildCoverage marks required alt failure correctly', () => {
    const cases: T47DrillCase[] = [
        {
            id: 'alt-fail',
            scenario: 'alt_switch',
            scale: 'n50',
            description: 'alt',
            command: 'echo',
            required: true,
        },
    ];
    const results: T47DrillResult[] = [
        {
            id: 'alt-fail',
            scenario: 'alt_switch',
            scale: 'n50',
            description: 'alt',
            command: 'echo',
            required: true,
            success: false,
            exitCode: 1,
            durationMs: 1,
            stdout: '',
            stderr: '',
        },
    ];

    const coverage = buildCoverage(cases, results);
    const alt = coverage.find(entry => entry.scenario === 'alt_switch');
    assert.ok(alt);
    assert.equal(alt.overall, 'fail');
    assert.equal(alt.cells.find(entry => entry.scale === 'n50')?.status, 'fail');
});
