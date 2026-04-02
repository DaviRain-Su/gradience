import assert from 'node:assert/strict';
import test from 'node:test';

import type { DrillCase, DrillCaseResult } from './t46-abnormal-paths.ts';
import { buildCoverage } from './t46-abnormal-paths.ts';

test('buildCoverage marks missing asset coverage as not_implemented', () => {
    const cases: DrillCase[] = [
        {
            id: 'sol-low-score',
            scenario: 'low_score_refund',
            asset: 'sol',
            description: 'sol low score',
            command: 'echo',
            required: true,
        },
    ];
    const results: DrillCaseResult[] = [
        {
            id: 'sol-low-score',
            scenario: 'low_score_refund',
            asset: 'sol',
            description: 'sol low score',
            command: 'echo',
            required: true,
            success: true,
            exitCode: 0,
            durationMs: 10,
        },
    ];

    const coverage = buildCoverage(cases, results);
    const lowScore = coverage.find((entry) => entry.scenario === 'low_score_refund');
    assert.ok(lowScore);
    assert.equal(lowScore.overall, 'pass');
    assert.equal(
        lowScore.cells.find((entry) => entry.asset === 'spl')?.status,
        'not_implemented',
    );
});

test('buildCoverage marks required failures as fail', () => {
    const cases: DrillCase[] = [
        {
            id: 'force-sol',
            scenario: 'force_refund',
            asset: 'sol',
            description: 'force sol',
            command: 'echo',
            required: true,
        },
    ];
    const results: DrillCaseResult[] = [
        {
            id: 'force-sol',
            scenario: 'force_refund',
            asset: 'sol',
            description: 'force sol',
            command: 'echo',
            required: true,
            success: false,
            exitCode: 1,
            durationMs: 20,
        },
    ];

    const coverage = buildCoverage(cases, results);
    const force = coverage.find((entry) => entry.scenario === 'force_refund');
    assert.ok(force);
    assert.equal(force.overall, 'fail');
    assert.equal(
        force.cells.find((entry) => entry.asset === 'sol')?.status,
        'fail',
    );
});
