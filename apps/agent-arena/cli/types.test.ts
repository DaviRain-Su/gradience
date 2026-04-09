/**
 * Arena CLI Unit Tests
 *
 * Tests for the Gradience CLI commands and utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    parseFlags,
    parseU64,
    parseAddress,
    requiredFlag,
    isTaskCommand,
    isJudgeCommand,
    isMockTaskMode,
    parseCategories,
    CliError,
    TEXT_ENCODER,
    MAX_CATEGORIES,
    CATEGORY_NAME_TO_ID,
} from '../types.js';

describe('CLI Utilities', () => {
    describe('parseFlags', () => {
        it('should parse basic flags', () => {
            const flags = parseFlags(['--task-id', '123', '--reward', '1000000']);
            expect(flags.get('task-id')).toBe('123');
            expect(flags.get('reward')).toBe('1000000');
        });

        it('should handle empty flags', () => {
            const flags = parseFlags([]);
            expect(flags.size).toBe(0);
        });

        it('should ignore values starting with --', () => {
            const flags = parseFlags(['--flag1', '--flag2']);
            expect(flags.get('flag1')).toBeUndefined();
        });
    });

    describe('parseU64', () => {
        it('should parse valid u64', () => {
            expect(parseU64('1000', 'test')).toBe(1000n);
            expect(parseU64('0', 'test')).toBe(0n);
        });

        it('should throw on negative numbers', () => {
            expect(() => parseU64('-1', 'test')).toThrow(CliError);
        });

        it('should throw on invalid input', () => {
            expect(() => parseU64('abc', 'test')).toThrow(CliError);
            expect(() => parseU64(undefined, 'test')).toThrow(CliError);
        });
    });

    describe('parseAddress', () => {
        it('should return valid address', () => {
            const addr = '11111111111111111111111111111111';
            expect(parseAddress(addr, 'test')).toBe(addr);
        });

        it('should throw on empty address', () => {
            expect(() => parseAddress(undefined, 'test')).toThrow(CliError);
            expect(() => parseAddress('', 'test')).toThrow(CliError);
        });
    });

    describe('requiredFlag', () => {
        it('should return flag value', () => {
            const flags = new Map([['key', 'value']]);
            expect(requiredFlag(flags, 'key')).toBe('value');
        });

        it('should throw on missing flag', () => {
            const flags = new Map();
            expect(() => requiredFlag(flags, 'missing')).toThrow(CliError);
        });
    });

    describe('Command type guards', () => {
        it('should identify task commands', () => {
            expect(isTaskCommand('post')).toBe(true);
            expect(isTaskCommand('apply')).toBe(true);
            expect(isTaskCommand('submit')).toBe(true);
            expect(isTaskCommand('judge')).toBe(true);
            expect(isTaskCommand('cancel')).toBe(true);
            expect(isTaskCommand('refund')).toBe(true);
            expect(isTaskCommand('invalid')).toBe(false);
        });

        it('should identify judge commands', () => {
            expect(isJudgeCommand('register')).toBe(true);
            expect(isJudgeCommand('unstake')).toBe(true);
            expect(isJudgeCommand('invalid')).toBe(false);
        });
    });

    describe('isMockTaskMode', () => {
        it('should detect mock mode', () => {
            expect(isMockTaskMode({ GRADIENCE_CLI_MOCK_TASK: 'true' })).toBe(true);
            expect(isMockTaskMode({})).toBe(false);
            expect(isMockTaskMode({ GRADIENCE_CLI_MOCK_TASK: 'false' })).toBe(false);
        });
    });

    describe('parseCategories', () => {
        it('should parse category names', () => {
            const cats = parseCategories('ml,llm,vision');
            expect(cats).toContain(0); // ml
            expect(cats).toContain(1); // llm
            expect(cats).toContain(2); // vision
        });

        it('should parse category IDs', () => {
            const cats = parseCategories('0,1,2');
            expect(cats).toEqual([0, 1, 2]);
        });

        it('should throw on invalid category', () => {
            expect(() => parseCategories('invalid')).toThrow(CliError);
            expect(() => parseCategories('99')).toThrow(CliError);
        });

        it('should handle empty string', () => {
            expect(parseCategories('')).toEqual([]);
        });
    });
});

describe('Constants', () => {
    it('should have correct TEXT_ENCODER', () => {
        expect(TEXT_ENCODER).toBeInstanceOf(TextEncoder);
    });

    it('should have correct MAX_CATEGORIES', () => {
        expect(MAX_CATEGORIES).toBe(8);
        expect(CATEGORY_NAME_TO_ID.size).toBe(8);
    });

    it('should map category names correctly', () => {
        expect(CATEGORY_NAME_TO_ID.get('ml')).toBe(0);
        expect(CATEGORY_NAME_TO_ID.get('llm')).toBe(1);
        expect(CATEGORY_NAME_TO_ID.get('vision')).toBe(2);
        expect(CATEGORY_NAME_TO_ID.get('other')).toBe(7);
    });
});
