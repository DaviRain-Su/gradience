/**
 * Configuration utilities for Gradience CLI
 */

import { homedir } from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CliError } from '../types.js';
import type { ConfigKey, GradienceConfig } from '../types.js';

/**
 * Update a configuration key with a new value
 * @param key - The configuration key to update ('rpc' or 'keypair')
 * @param rawValue - The raw value to set
 * @param env - Process environment variables
 * @returns The path to the updated config file
 * @throws {CliError} If the key or value is invalid
 */
export async function updateConfig(key: ConfigKey, rawValue: string, env: NodeJS.ProcessEnv): Promise<string> {
    const home = env.HOME || homedir();
    const configDir = path.join(home, '.gradience');
    const configPath = path.join(configDir, 'config.json');

    const value = key === 'rpc' ? validateRpcUrl(rawValue) : normalizePath(rawValue, home);
    const existing = await readConfig(configPath);
    const next: GradienceConfig = {
        ...existing,
        [key]: value,
        updatedAt: new Date().toISOString(),
    };

    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return configPath;
}

/**
 * Read configuration from a file path
 * @param configPath - Path to the config file
 * @returns The parsed configuration or empty object if not found
 */
export async function readConfig(configPath: string): Promise<GradienceConfig> {
    try {
        const raw = await readFile(configPath, 'utf8');
        return JSON.parse(raw) as GradienceConfig;
    } catch {
        return {};
    }
}

/**
 * Load configuration from the default location
 * @param env - Process environment variables
 * @returns The loaded configuration
 */
export async function loadConfig(env: NodeJS.ProcessEnv): Promise<GradienceConfig> {
    const home = env.HOME || homedir();
    const configPath = path.join(home, '.gradience', 'config.json');
    return readConfig(configPath);
}

/**
 * Validate an RPC URL
 * @param value - The URL string to validate
 * @returns The validated URL string
 * @throws {CliError} If the URL is invalid or not HTTP/HTTPS
 */
export function validateRpcUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new CliError('INVALID_ARGUMENT', `Invalid RPC URL: ${value}`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new CliError('INVALID_ARGUMENT', 'RPC URL must start with http:// or https://');
    }
    return url.toString();
}

/**
 * Normalize a path, expanding ~ to home directory
 * @param value - The path string to normalize
 * @param home - The home directory path
 * @returns The normalized absolute path
 */
export function normalizePath(value: string, home: string): string {
    if (value.startsWith('~/')) {
        return path.join(home, value.slice(2));
    }
    return path.resolve(value);
}
