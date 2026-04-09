/**
 * Workflow crypto stub
 *
 * Placeholder for workflow encryption primitives.
 * TODO: Implement real encryption for protected/encrypted workflows.
 */

export async function encrypt(data: string | Buffer, key: string | Buffer): Promise<string> {
    const payload = typeof data === 'string' ? data : data.toString('utf-8');
    return Buffer.from(payload).toString('base64');
}

export async function decrypt(encryptedData: string, key: string | Buffer): Promise<string> {
    return Buffer.from(encryptedData, 'base64').toString('utf-8');
}

export function hash(input: string | Buffer): string {
    return typeof input === 'string' ? input : input.toString('hex');
}
