import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WasmTestCasesEvaluator } from './test-cases-evaluator.js';

const WASM_SCORE_80 = Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00, 0x07, 0x09, 0x01, 0x05, 0x73, 0x63, 0x6f, 0x72, 0x65, 0x00, 0x00,
    0x0a, 0x07, 0x01, 0x05, 0x00, 0x41, 0xd0, 0x00, 0x0b,
]);

const WASM_FLOAT_OPCODE = Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00, 0x07, 0x09, 0x01, 0x05, 0x73, 0x63, 0x6f, 0x72, 0x65, 0x00, 0x00,
    0x0a, 0x0d, 0x01, 0x0b, 0x00, 0x43, 0x00, 0x00, 0x80, 0x3f, 0x1a, 0x41, 0xd0, 0x00, 0x0b,
]);

const WASM_SCORE_139 = Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00, 0x07, 0x09, 0x01, 0x05, 0x73, 0x63, 0x6f, 0x72, 0x65, 0x00, 0x00,
    0x0a, 0x07, 0x01, 0x05, 0x00, 0x41, 0x8b, 0x01, 0x0b,
]);

const WASM_WITH_IMPORT = Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x02,
    0x0b, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x03, 0x66, 0x6f, 0x6f, 0x00, 0x00,
]);

test('WasmTestCasesEvaluator executes wasm_exec and returns score', async () => {
    const evaluator = new WasmTestCasesEvaluator({
        fetchBytes: async () => WASM_SCORE_80,
    });
    const result = await evaluator.evaluate({
        taskId: 1,
        taskDescription: 'task',
        criteria: {
            type: 'test_cases',
            wasm_ref: 'cid://wasm',
            min_pass_rate: 0.6,
        },
        result: '{}',
        trace: '',
        agent: '11111111111111111111111111111111',
    });
    assert.equal(result.score, 80);
    assert.equal(result.mode, 'type_c1');
});

test('WasmTestCasesEvaluator allows integer immediates containing float-opcode bytes', async () => {
    const evaluator = new WasmTestCasesEvaluator({
        fetchBytes: async () => WASM_SCORE_139,
    });
    const result = await evaluator.evaluate({
        taskId: 3,
        taskDescription: 'task',
        criteria: {
            type: 'test_cases',
            wasm_ref: 'cid://wasm',
        },
        result: '{}',
        trace: '',
        agent: '11111111111111111111111111111111',
    });
    assert.equal(result.score, 100);
});

test('WasmTestCasesEvaluator rejects floating-point opcodes', async () => {
    const evaluator = new WasmTestCasesEvaluator({
        fetchBytes: async () => WASM_FLOAT_OPCODE,
    });
    await assert.rejects(
        () =>
            evaluator.evaluate({
                taskId: 2,
                taskDescription: 'task',
                criteria: {
                    type: 'test_cases',
                    wasm_ref: 'cid://wasm',
                },
                result: '{}',
                trace: '',
                agent: '11111111111111111111111111111111',
            }),
        /floating-point opcode/i,
    );
});

test('WasmTestCasesEvaluator rejects imported functions', async () => {
    const evaluator = new WasmTestCasesEvaluator({
        fetchBytes: async () => WASM_WITH_IMPORT,
    });
    await assert.rejects(
        () =>
            evaluator.evaluate({
                taskId: 4,
                taskDescription: 'task',
                criteria: {
                    type: 'test_cases',
                    wasm_ref: 'cid://wasm',
                },
                result: '{}',
                trace: '',
                agent: '11111111111111111111111111111111',
            }),
        /forbids imports/i,
    );
});
