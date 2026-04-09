/**
 * Template Parser Tests
 * Based on docs/workflow-engine/05-test-spec.md
 */
import { describe, it, expect } from 'vitest';
import {
    parseTemplate,
    parseTemplateValue,
    hasTemplateVariables,
    extractTemplateVariables,
    type TemplateContext,
} from '../src/utils/template-parser.js';
import type { StepResult } from '../src/schema/types.js';

// Helper to create a StepResult
function createStepResult(overrides?: Partial<StepResult>): StepResult {
    return {
        stepId: 'step1',
        status: 'completed',
        chain: 'solana',
        action: 'log',
        duration: 100,
        retryCount: 0,
        ...overrides,
    };
}

describe('TemplateParser', () => {
    describe('parseTemplate()', () => {
        // ═══════════════════════════════════════════════════════════════
        // Happy Path
        // ═══════════════════════════════════════════════════════════════

        it('should parse simple variable', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { value: 100 } })]]);
            expect(parseTemplate('{{step1.output.value}}', context)).toBe('100');
        });

        it('should parse multiple variables', () => {
            const context: TemplateContext = new Map([
                ['step1', createStepResult({ output: { a: 'hello' } })],
                ['step2', createStepResult({ stepId: 'step2', output: { b: 'world' } })],
            ]);
            expect(parseTemplate('{{step1.output.a}} {{step2.output.b}}', context)).toBe('hello world');
        });

        it('should parse nested object access', () => {
            const context: TemplateContext = new Map([
                ['step1', createStepResult({ output: { data: { nested: { value: 42 } } } })],
            ]);
            expect(parseTemplate('{{step1.output.data.nested.value}}', context)).toBe('42');
        });

        it('should parse step properties directly', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ txHash: '0xabc123' })]]);
            expect(parseTemplate('{{step1.txHash}}', context)).toBe('0xabc123');
        });

        it('should parse status property', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ status: 'completed' })]]);
            expect(parseTemplate('{{step1.status}}', context)).toBe('completed');
        });

        it('should handle mixed text and variables', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { amount: '1000' } })]]);
            expect(parseTemplate('Amount: {{step1.output.amount}} USDC', context)).toBe('Amount: 1000 USDC');
        });

        it('should handle number values', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { price: 99.99 } })]]);
            expect(parseTemplate('Price: {{step1.output.price}}', context)).toBe('Price: 99.99');
        });

        it('should handle boolean values', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { success: true } })]]);
            expect(parseTemplate('Result: {{step1.output.success}}', context)).toBe('Result: true');
        });

        // ═══════════════════════════════════════════════════════════════
        // Edge Cases
        // ═══════════════════════════════════════════════════════════════

        it('should keep original text if step not found', () => {
            const context: TemplateContext = new Map();
            expect(parseTemplate('{{step1.output.value}}', context)).toBe('{{step1.output.value}}');
        });

        it('should keep original text if field not found', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: {} })]]);
            expect(parseTemplate('{{step1.output.missing}}', context)).toBe('{{step1.output.missing}}');
        });

        it('should handle null output', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: undefined })]]);
            expect(parseTemplate('{{step1.output.value}}', context)).toBe('{{step1.output.value}}');
        });

        it('should handle empty string', () => {
            expect(parseTemplate('', new Map())).toBe('');
        });

        it('should handle text without variables', () => {
            expect(parseTemplate('plain text', new Map())).toBe('plain text');
        });

        it('should handle malformed variables gracefully', () => {
            const context: TemplateContext = new Map();
            expect(parseTemplate('{{invalid}}', context)).toBe('{{invalid}}');
            expect(parseTemplate('{{}}', context)).toBe('{{}}');
            expect(parseTemplate('{{ step1.output }}', context)).toBe('{{ step1.output }}');
        });

        it('should handle deeply nested null values', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { data: null } })]]);
            expect(parseTemplate('{{step1.output.data.value}}', context)).toBe('{{step1.output.data.value}}');
        });

        it('should handle array values in output', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { items: [1, 2, 3] } })]]);
            expect(parseTemplate('{{step1.output.items}}', context)).toBe('1,2,3');
        });

        it('should handle object values in output', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { obj: { a: 1 } } })]]);
            expect(parseTemplate('{{step1.output.obj}}', context)).toBe('[object Object]');
        });
    });

    describe('parseTemplateValue()', () => {
        it('should parse strings', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { value: 'test' } })]]);
            expect(parseTemplateValue('{{step1.output.value}}', context)).toBe('test');
        });

        it('should parse objects recursively', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { amount: '100' } })]]);
            const input = {
                message: 'Amount is {{step1.output.amount}}',
                nested: {
                    value: '{{step1.output.amount}}',
                },
            };
            const result = parseTemplateValue(input, context);
            expect(result).toEqual({
                message: 'Amount is 100',
                nested: {
                    value: '100',
                },
            });
        });

        it('should parse arrays recursively', () => {
            const context: TemplateContext = new Map([['step1', createStepResult({ output: { a: '1', b: '2' } })]]);
            const input = ['{{step1.output.a}}', '{{step1.output.b}}'];
            expect(parseTemplateValue(input, context)).toEqual(['1', '2']);
        });

        it('should return primitives unchanged', () => {
            const context: TemplateContext = new Map();
            expect(parseTemplateValue(123, context)).toBe(123);
            expect(parseTemplateValue(true, context)).toBe(true);
            expect(parseTemplateValue(null, context)).toBe(null);
            expect(parseTemplateValue(undefined, context)).toBe(undefined);
        });
    });

    describe('hasTemplateVariables()', () => {
        it('should return true for strings with variables', () => {
            expect(hasTemplateVariables('{{step1.output.value}}')).toBe(true);
            expect(hasTemplateVariables('text {{step1.output.value}} more')).toBe(true);
        });

        it('should return false for strings without variables', () => {
            expect(hasTemplateVariables('plain text')).toBe(false);
            expect(hasTemplateVariables('')).toBe(false);
            expect(hasTemplateVariables('{{invalid}}')).toBe(false);
        });
    });

    describe('extractTemplateVariables()', () => {
        it('should extract single variable', () => {
            const result = extractTemplateVariables('{{step1.output.value}}');
            expect(result).toEqual([{ stepId: 'step1', propertyPath: 'output.value' }]);
        });

        it('should extract multiple variables', () => {
            const result = extractTemplateVariables('{{step1.output.a}} and {{step2.output.b}}');
            expect(result).toEqual([
                { stepId: 'step1', propertyPath: 'output.a' },
                { stepId: 'step2', propertyPath: 'output.b' },
            ]);
        });

        it('should extract nested paths', () => {
            const result = extractTemplateVariables('{{step1.output.data.nested.value}}');
            expect(result).toEqual([{ stepId: 'step1', propertyPath: 'output.data.nested.value' }]);
        });

        it('should return empty array for no variables', () => {
            expect(extractTemplateVariables('plain text')).toEqual([]);
            expect(extractTemplateVariables('')).toEqual([]);
        });
    });
});
