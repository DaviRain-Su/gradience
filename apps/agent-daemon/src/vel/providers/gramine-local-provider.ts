/**
 * Gramine Local Provider
 *
 * In mock mode (default), it spawns a mock enclave Node.js process that
 * simulates TEE isolation. In real mode, it would connect to a Gramine
 * enclave via a Unix socket.
 */

import { spawn, ChildProcess } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findPackageRoot(startDir: string): string {
    let dir = startDir;
    while (dir !== '/' && dir !== resolve(dir, '..')) {
        if (existsSync(resolve(dir, 'package.json'))) return dir;
        dir = resolve(dir, '..');
    }
    throw new Error('package.json not found when locating mock enclave script');
}
import type {
    TeeProviderConfig,
    EnclavePayload,
    EnclaveResponse,
    AttestationBundle,
    VerificationReport,
} from '../types.js';
import { VelError, VEL_ERROR_ENCLAVE_CRASH, VEL_ERROR_EXECUTION_TIMEOUT } from '../errors.js';
import { TeeProvider, serializePayload, deserializeEnclaveResponse, validateBundleIntegrity } from './base-provider.js';

export class GramineLocalProvider implements TeeProvider {
    readonly name = 'gramine-local';
    private config?: TeeProviderConfig;
    private mockProcess?: ChildProcess;

    async initialize(config: TeeProviderConfig): Promise<void> {
        if (config.allowedPcrValues.length === 0) {
            throw new Error('GramineLocalProvider: allowedPcrValues must contain at least 1 entry');
        }
        this.config = config;
    }

    async executeInEnclave(payload: EnclavePayload, timeoutMs = 300_000): Promise<EnclaveResponse> {
        if (!this.config) {
            throw new Error('GramineLocalProvider not initialized');
        }

        // Default to mock enclave script path next to this file.
        const packageRoot = findPackageRoot(__dirname);
        const mockScript = this.config.commandOverride || resolve(packageRoot, 'scripts/mock-gramine-enclave.mjs');

        const port = await findFreePort();
        const child = spawn('node', [mockScript, String(port)], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: this.config.workingDir,
        });
        this.mockProcess = child;

        const startupTimeout = this.config.startupTimeoutMs ?? 10_000;

        try {
            await waitForPort(port, startupTimeout);
            const responseJson = await sendPayloadToPort(port, serializePayload(payload), timeoutMs);
            const response = deserializeEnclaveResponse(responseJson);
            return response;
        } catch (err) {
            throw new VelError(
                VEL_ERROR_ENCLAVE_CRASH,
                `Mock enclave execution failed: ${err instanceof Error ? err.message : String(err)}`,
                err,
            );
        } finally {
            child.kill('SIGTERM');
        }
    }

    async verifyAttestation(bundle: AttestationBundle): Promise<VerificationReport> {
        validateBundleIntegrity(bundle);

        try {
            const reportJson = Buffer.from(bundle.attestationReport, 'base64').toString('utf-8');
            const report = JSON.parse(reportJson) as {
                pcr0: string;
                userDataHash: string;
                signerIdentity: string;
            };

            if (!this.config || !this.config.allowedPcrValues.includes(report.pcr0)) {
                return {
                    valid: false,
                    reason: `VEL_0005: PCR ${report.pcr0} not in allowlist`,
                };
            }

            if (report.userDataHash !== bundle.resultHash + bundle.logHash) {
                return {
                    valid: false,
                    reason: 'VEL_0006: userDataHash mismatch with bundle resultHash+logHash',
                };
            }

            return {
                valid: true,
                pcrValues: { pcr0: report.pcr0 },
                signerIdentity: report.signerIdentity,
            };
        } catch (e) {
            return {
                valid: false,
                reason: `VEL_0004: Failed to verify mock attestation: ${e instanceof Error ? e.message : String(e)}`,
            };
        }
    }

    async terminate(): Promise<void> {
        if (this.mockProcess && !this.mockProcess.killed) {
            this.mockProcess.kill('SIGTERM');
        }
    }
}

async function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const port = (server.address() as import('node:net').AddressInfo).port;
            server.close(() => resolve(port));
        });
    });
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await new Promise<void>((resolve, reject) => {
                const socket = createConnection(port, '127.0.0.1', () => {
                    socket.end();
                    resolve();
                });
                socket.on('error', reject);
            });
            return;
        } catch {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    throw new VelError(VEL_ERROR_EXECUTION_TIMEOUT, `Mock enclave did not start within ${timeoutMs}ms`);
}

async function sendPayloadToPort(port: number, payload: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new VelError(VEL_ERROR_EXECUTION_TIMEOUT, `Enclave response timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const socket = createConnection(port, '127.0.0.1', () => {
            socket.write(payload);
            socket.end();
        });

        let data = '';
        socket.on('data', (chunk) => {
            data += chunk.toString('utf-8');
        });
        socket.on('end', () => {
            clearTimeout(timer);
            resolve(data);
        });
        socket.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
