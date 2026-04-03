import { homedir } from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export type ConfigKey = 'rpc' | 'keypair';

export interface GradienceConfig {
    rpc?: string;
    keypair?: string;
    updatedAt?: string;
}

export class ConfigManager {
    private configDir: string;
    private configPath: string;

    constructor(homeDirectory?: string) {
        const home = homeDirectory ?? homedir();
        this.configDir = path.join(home, '.gradience');
        this.configPath = path.join(this.configDir, 'config.json');
    }

    async load(): Promise<GradienceConfig> {
        try {
            const raw = await readFile(this.configPath, 'utf8');
            return JSON.parse(raw) as GradienceConfig;
        } catch {
            return {};
        }
    }

    async set(key: ConfigKey, rawValue: string): Promise<void> {
        const value = key === 'rpc' ? validateRpcUrl(rawValue) : normalizePath(rawValue);
        const existing = await this.load();
        
        const next: GradienceConfig = {
            ...existing,
            [key]: value,
            updatedAt: new Date().toISOString(),
        };

        await mkdir(this.configDir, { recursive: true });
        await writeFile(this.configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    }

    async get(key: ConfigKey): Promise<string | undefined> {
        const config = await this.load();
        return config[key];
    }

    getPath(): string {
        return this.configPath;
    }
}

function validateRpcUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`Invalid RPC URL: ${value}`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('RPC URL must start with http:// or https://');
    }
    return url.toString();
}

function normalizePath(value: string): string {
    if (value.startsWith('~/')) {
        return path.join(homedir(), value.slice(2));
    }
    return path.resolve(value);
}