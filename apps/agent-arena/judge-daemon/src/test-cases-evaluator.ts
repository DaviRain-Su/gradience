import { Worker } from 'node:worker_threads';

import type { EvaluationRequest, EvaluationResult, ScoreEvaluator } from './evaluators.js';

interface TestCaseSpec {
    input: string;
    expected_output: string;
    weight: number;
}

interface TestCasesCriteria {
    type?: string;
    test_cases?: unknown;
    min_pass_rate?: unknown;
    wasm_ref?: unknown;
    wasm_base64?: unknown;
}

export interface BytesRefReader {
    fetchBytes(reference: string): Promise<Uint8Array>;
}

export interface WasmTestCasesEvaluatorOptions {
    timeoutMs?: number;
}

export class WasmTestCasesEvaluator implements ScoreEvaluator {
    private readonly timeoutMs: number;

    constructor(
        private readonly reader: BytesRefReader,
        options: WasmTestCasesEvaluatorOptions = {},
    ) {
        this.timeoutMs = options.timeoutMs ?? 2_000;
    }

    async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
        const criteria = parseCriteria(request.criteria);
        const testCases = parseTestCases(criteria.test_cases);
        const minPassRate = parseOptionalNumber(criteria.min_pass_rate) ?? 0.6;

        const wasmBytes = await resolveWasmBytes(criteria, this.reader);
        if (wasmBytes) {
            validateWasmDeterministic(wasmBytes);
            const score = clampScore(await executeWasmScore(wasmBytes, this.timeoutMs));
            return {
                score,
                reasoning: 'wasm_exec score',
                dimensionScores: { min_pass_rate: minPassRate },
                confidence: 1,
                mode: 'type_c1',
            };
        }

        if (testCases.length === 0) {
            throw new Error('test_cases evaluator requires non-empty test_cases or wasm_ref');
        }

        const { score, passRate } = evaluateByTestCases(testCases, request.result);
        return {
            score,
            reasoning:
                passRate >= minPassRate
                    ? 'test_cases passed'
                    : `test_cases failed: pass_rate=${passRate.toFixed(3)}`,
            dimensionScores: {
                pass_rate: Number(passRate.toFixed(4)),
                min_pass_rate: minPassRate,
            },
            confidence: 1,
            mode: 'type_c1',
        };
    }
}

function parseCriteria(raw: Record<string, unknown>): TestCasesCriteria {
    const criteria = raw as TestCasesCriteria;
    if (criteria.type && criteria.type !== 'test_cases') {
        throw new Error(`Unsupported evaluation type for C-1: ${criteria.type}`);
    }
    return criteria;
}

function parseTestCases(raw: unknown): TestCaseSpec[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item): TestCaseSpec | null => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const record = item as Record<string, unknown>;
            const input = asString(record.input);
            const expectedOutput = asString(record.expected_output);
            const weight = parseOptionalNumber(record.weight) ?? 1;
            if (!input || !expectedOutput || !Number.isFinite(weight) || weight <= 0) {
                return null;
            }
            return {
                input,
                expected_output: expectedOutput,
                weight,
            };
        })
        .filter((value): value is TestCaseSpec => value !== null);
}

async function resolveWasmBytes(
    criteria: TestCasesCriteria,
    reader: BytesRefReader,
): Promise<Uint8Array | null> {
    const wasmRef = asString(criteria.wasm_ref);
    if (wasmRef) {
        return reader.fetchBytes(wasmRef);
    }
    const wasmBase64 = asString(criteria.wasm_base64);
    if (wasmBase64) {
        return Buffer.from(wasmBase64, 'base64');
    }
    return null;
}

function evaluateByTestCases(
    testCases: TestCaseSpec[],
    resultContent: string,
): { score: number; passRate: number } {
    const parsedResult = safeParseJsonRecord(resultContent);
    let totalWeight = 0;
    let passedWeight = 0;
    for (const testCase of testCases) {
        totalWeight += testCase.weight;
        const passed = parsedResult
            ? toComparable(parsedResult[testCase.input]) === testCase.expected_output
            : resultContent.includes(testCase.expected_output);
        if (passed) {
            passedWeight += testCase.weight;
        }
    }
    const passRate = totalWeight === 0 ? 0 : passedWeight / totalWeight;
    return {
        score: clampScore(Math.round(passRate * 100)),
        passRate,
    };
}

function safeParseJsonRecord(value: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

function toComparable(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return JSON.stringify(value);
}

async function executeWasmScore(bytes: Uint8Array, timeoutMs: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const worker = new Worker(
            `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  try {
    const moduleBytes = Uint8Array.from(workerData.bytes);
    const module = await WebAssembly.compile(moduleBytes);
    const instance = await WebAssembly.instantiate(module, {});
    const fn = instance.exports.evaluate || instance.exports.score;
    if (typeof fn !== 'function') {
      throw new Error('WASM module must export evaluate() or score()');
    }
    const result = fn();
    const score = typeof result === 'bigint' ? Number(result) : Number(result);
    if (!Number.isFinite(score)) {
      throw new Error('WASM score must be numeric');
    }
    parentPort.postMessage({ ok: true, score });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    parentPort.postMessage({ ok: false, error: message });
  }
})();`,
            {
                eval: true,
                workerData: { bytes: Array.from(bytes) },
            },
        );

        const timeout = setTimeout(() => {
            void worker.terminate();
            reject(new Error(`WASM execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        worker.once('message', (message: unknown) => {
            clearTimeout(timeout);
            void worker.terminate();
            const payload = message as { ok: boolean; score?: number; error?: string };
            if (!payload.ok) {
                reject(new Error(payload.error ?? 'WASM execution failed'));
                return;
            }
            resolve(payload.score ?? 0);
        });
        worker.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

function validateWasmDeterministic(bytes: Uint8Array): void {
    if (bytes.length < 8 || !hasWasmMagicAndVersion(bytes)) {
        throw new Error('Invalid wasm binary');
    }

    let offset = 8;
    while (offset < bytes.length) {
        const sectionId = bytes[offset];
        offset += 1;
        const sectionSize = readLebU32(bytes, offset);
        offset = sectionSize.nextOffset;
        const sectionEnd = offset + sectionSize.value;
        if (sectionEnd > bytes.length) {
            throw new Error('Corrupted wasm section length');
        }

        if (sectionId === 2 && sectionSize.value > 0) {
            throw new Error('Deterministic subset forbids imports');
        }
        if (sectionId === 1) {
            ensureTypeSectionNoFloat(bytes.subarray(offset, sectionEnd));
        }
        if (sectionId === 10) {
            ensureCodeSectionNoFloat(bytes.subarray(offset, sectionEnd));
        }
        offset = sectionEnd;
    }
}

function hasWasmMagicAndVersion(bytes: Uint8Array): boolean {
    return (
        bytes[0] === 0x00 &&
        bytes[1] === 0x61 &&
        bytes[2] === 0x73 &&
        bytes[3] === 0x6d &&
        bytes[4] === 0x01 &&
        bytes[5] === 0x00 &&
        bytes[6] === 0x00 &&
        bytes[7] === 0x00
    );
}

function ensureTypeSectionNoFloat(section: Uint8Array): void {
    let offset = 0;
    const count = readLebU32(section, offset);
    offset = count.nextOffset;
    for (let i = 0; i < count.value; i += 1) {
        const form = readByte(section, offset, 'Corrupted wasm type section');
        offset += 1;
        if (form !== 0x60) {
            throw new Error('Unsupported wasm type form');
        }
        const params = readLebU32(section, offset);
        offset = params.nextOffset;
        for (let p = 0; p < params.value; p += 1) {
            assertNoFloatValType(readByte(section, offset, 'Corrupted wasm type params'));
            offset += 1;
        }
        const results = readLebU32(section, offset);
        offset = results.nextOffset;
        for (let r = 0; r < results.value; r += 1) {
            assertNoFloatValType(readByte(section, offset, 'Corrupted wasm type results'));
            offset += 1;
        }
    }
}

function ensureCodeSectionNoFloat(section: Uint8Array): void {
    let offset = 0;
    const functionCount = readLebU32(section, offset);
    offset = functionCount.nextOffset;
    for (let i = 0; i < functionCount.value; i += 1) {
        const bodySize = readLebU32(section, offset);
        offset = bodySize.nextOffset;
        const bodyEnd = offset + bodySize.value;
        if (bodyEnd > section.length) {
            throw new Error('Corrupted wasm function body');
        }
        let cursor = offset;
        const localDeclCount = readLebU32(section, cursor);
        cursor = localDeclCount.nextOffset;
        for (let j = 0; j < localDeclCount.value; j += 1) {
            const localCount = readLebU32(section, cursor);
            cursor = localCount.nextOffset;
            assertNoFloatValType(readByte(section, cursor, 'Corrupted wasm local declaration'));
            cursor += 1;
        }
        const code = section.subarray(cursor, bodyEnd);
        ensureInstructionBytesNoFloat(code);
        offset = bodyEnd;
    }
}

function ensureInstructionBytesNoFloat(code: Uint8Array): void {
    let offset = 0;
    while (offset < code.length) {
        const opcode = readByte(code, offset, 'Corrupted wasm instruction stream');
        offset += 1;

        if (isFloatingPointOpcode(opcode)) {
            throw new Error(
                `Deterministic subset forbids floating-point opcode 0x${opcode.toString(16)}`,
            );
        }

        if (isNoImmediateOpcode(opcode)) {
            continue;
        }

        if (opcode === 0xfc || opcode === 0xfd || opcode === 0xfe) {
            throw new Error(
                `Deterministic subset forbids opcode prefix 0x${opcode.toString(16)}`,
            );
        }

        if (opcode === 0x02 || opcode === 0x03 || opcode === 0x04) {
            offset = skipBlockType(code, offset);
            continue;
        }

        if (
            opcode === 0x0c ||
            opcode === 0x0d ||
            opcode === 0x10 ||
            (opcode >= 0x20 && opcode <= 0x26) ||
            opcode === 0xd2
        ) {
            offset = readLebU32(code, offset).nextOffset;
            continue;
        }

        if (opcode === 0x0e) {
            const labelCount = readLebU32(code, offset);
            offset = labelCount.nextOffset;
            for (let i = 0; i < labelCount.value; i += 1) {
                offset = readLebU32(code, offset).nextOffset;
            }
            offset = readLebU32(code, offset).nextOffset;
            continue;
        }

        if (opcode === 0x11) {
            offset = readLebU32(code, offset).nextOffset;
            offset = readLebU32(code, offset).nextOffset;
            continue;
        }

        if (opcode === 0x1c) {
            const typeCount = readLebU32(code, offset);
            offset = typeCount.nextOffset;
            for (let i = 0; i < typeCount.value; i += 1) {
                assertNoFloatValType(
                    readByte(code, offset, 'Corrupted wasm select type immediate'),
                );
                offset += 1;
            }
            continue;
        }

        if (opcode >= 0x28 && opcode <= 0x3e) {
            offset = readLebU32(code, offset).nextOffset;
            offset = readLebU32(code, offset).nextOffset;
            continue;
        }

        if (opcode === 0x3f || opcode === 0x40) {
            const reserved = readByte(code, offset, 'Corrupted wasm memory immediate');
            if (reserved !== 0x00) {
                throw new Error('Deterministic subset forbids non-zero memory immediate');
            }
            offset += 1;
            continue;
        }

        if (opcode === 0x41) {
            offset = readLebSigned(code, offset, 32).nextOffset;
            continue;
        }

        if (opcode === 0x42) {
            offset = readLebSigned(code, offset, 64).nextOffset;
            continue;
        }

        if (opcode === 0xd0) {
            assertNoFloatValType(readByte(code, offset, 'Corrupted wasm ref.null type'));
            offset += 1;
            continue;
        }

        throw new Error(`Unsupported wasm opcode 0x${opcode.toString(16)}`);
    }
}

function isFloatingPointOpcode(opcode: number): boolean {
    return (
        opcode === 0x43 ||
        opcode === 0x44 ||
        (opcode >= 0x5b && opcode <= 0x66) ||
        (opcode >= 0x8b && opcode <= 0xa6) ||
        (opcode >= 0xb2 && opcode <= 0xbf)
    );
}

function isNoImmediateOpcode(opcode: number): boolean {
    return (
        opcode === 0x00 ||
        opcode === 0x01 ||
        opcode === 0x05 ||
        opcode === 0x0b ||
        opcode === 0x0f ||
        opcode === 0x1a ||
        opcode === 0x1b ||
        opcode === 0xd1 ||
        (opcode >= 0x45 && opcode <= 0xc4)
    );
}

function skipBlockType(code: Uint8Array, offset: number): number {
    const head = readByte(code, offset, 'Corrupted wasm block type');
    if (head === 0x40) {
        return offset + 1;
    }
    if (isWasmValueType(head)) {
        assertNoFloatValType(head);
        return offset + 1;
    }
    return readLebSigned(code, offset, 33).nextOffset;
}

function isWasmValueType(value: number): boolean {
    return (
        value === 0x7f ||
        value === 0x7e ||
        value === 0x7d ||
        value === 0x7c ||
        value === 0x7b ||
        value === 0x70 ||
        value === 0x6f
    );
}

function assertNoFloatValType(valueType: number): void {
    if (valueType === 0x7c || valueType === 0x7d) {
        throw new Error('Deterministic subset forbids floating-point value types');
    }
}

function readByte(bytes: Uint8Array, offset: number, errorMessage: string): number {
    if (offset < 0 || offset >= bytes.length) {
        throw new Error(errorMessage);
    }
    const byte = bytes[offset];
    if (byte === undefined) {
        throw new Error(errorMessage);
    }
    return byte;
}

function readLebU32(bytes: Uint8Array, startOffset: number): { value: number; nextOffset: number } {
    let result = 0;
    let shift = 0;
    let offset = startOffset;
    while (offset < bytes.length) {
        const byte = readByte(bytes, offset, 'Invalid leb128 encoding in wasm');
        offset += 1;
        result |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) {
            return { value: result >>> 0, nextOffset: offset };
        }
        shift += 7;
        if (shift > 35) {
            break;
        }
    }
    throw new Error('Invalid leb128 encoding in wasm');
}

function readLebSigned(
    bytes: Uint8Array,
    startOffset: number,
    maxBits: number,
): { nextOffset: number } {
    let shift = 0;
    let offset = startOffset;
    while (offset < bytes.length) {
        const byte = readByte(bytes, offset, 'Invalid signed leb128 encoding in wasm');
        offset += 1;
        shift += 7;
        if ((byte & 0x80) === 0) {
            return { nextOffset: offset };
        }
        if (shift > maxBits + 7) {
            break;
        }
    }
    throw new Error('Invalid signed leb128 encoding in wasm');
}

function parseOptionalNumber(value: unknown): number | null {
    if (typeof value !== 'number') {
        return null;
    }
    return Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function clampScore(score: number): number {
    if (!Number.isFinite(score)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}
