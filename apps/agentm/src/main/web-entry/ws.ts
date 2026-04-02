import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export interface WsPeer {
    sendJson(value: unknown): void;
    close(code?: number, reason?: string): void;
    onMessage(handler: (message: string) => void): void;
    onClose(handler: () => void): void;
}

export function acceptWebSocketUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    options: { maxMessageBytes: number },
): WsPeer | null {
    const key = req.headers['sec-websocket-key'];
    const upgrade = req.headers.upgrade;
    if (!key || upgrade?.toLowerCase() !== 'websocket') {
        return null;
    }

    const accept = createHash('sha1')
        .update(`${key}${WS_GUID}`)
        .digest('base64');
    socket.write(
        [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '\r\n',
        ].join('\r\n'),
    );

    let isClosed = false;
    let buffer = head;
    let onMessageHandler: ((message: string) => void) | null = null;
    let onCloseHandler: (() => void) | null = null;

    const close = (code = 1000, reason = 'normal') => {
        if (isClosed) return;
        isClosed = true;
        const reasonBuffer = Buffer.from(reason);
        const payload = Buffer.allocUnsafe(2 + reasonBuffer.length);
        payload.writeUInt16BE(code, 0);
        reasonBuffer.copy(payload, 2);
        sendFrame(socket, 0x8, payload);
        socket.end();
        onCloseHandler?.();
    };

    const handleData = (chunk: Buffer) => {
        if (isClosed) return;
        buffer = buffer.length > 0 ? Buffer.concat([buffer, chunk]) : chunk;

        while (buffer.length >= 2) {
            const byte1 = buffer[0];
            const byte2 = buffer[1];
            const opcode = byte1 & 0x0f;
            const masked = (byte2 & 0x80) === 0x80;
            let payloadLength = byte2 & 0x7f;
            let offset = 2;

            if (payloadLength === 126) {
                if (buffer.length < offset + 2) return;
                payloadLength = buffer.readUInt16BE(offset);
                offset += 2;
            } else if (payloadLength === 127) {
                if (buffer.length < offset + 8) return;
                const high = buffer.readUInt32BE(offset);
                const low = buffer.readUInt32BE(offset + 4);
                if (high !== 0) {
                    close(1009, 'message too large');
                    return;
                }
                payloadLength = low;
                offset += 8;
            }

            if (payloadLength > options.maxMessageBytes) {
                close(1009, 'message too large');
                return;
            }

            let mask: Buffer | null = null;
            if (masked) {
                if (buffer.length < offset + 4) return;
                mask = buffer.subarray(offset, offset + 4);
                offset += 4;
            }

            if (buffer.length < offset + payloadLength) {
                return;
            }

            const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
            buffer = buffer.subarray(offset + payloadLength);

            if (masked && mask) {
                for (let i = 0; i < payload.length; i += 1) {
                    payload[i] ^= mask[i % 4];
                }
            }

            if (opcode === 0x8) {
                close();
                return;
            }
            if (opcode === 0x9) {
                sendFrame(socket, 0xA, payload);
                continue;
            }
            if (opcode !== 0x1) {
                close(1003, 'unsupported frame');
                return;
            }
            onMessageHandler?.(payload.toString('utf8'));
        }
    };

    socket.on('data', handleData);
    socket.on('close', () => {
        if (isClosed) return;
        isClosed = true;
        onCloseHandler?.();
    });
    socket.on('error', () => {
        close(1011, 'socket error');
    });

    return {
        sendJson(value) {
            if (isClosed) return;
            sendFrame(socket, 0x1, Buffer.from(JSON.stringify(value)));
        },
        close,
        onMessage(handler) {
            onMessageHandler = handler;
        },
        onClose(handler) {
            onCloseHandler = handler;
        },
    };
}

function sendFrame(socket: Duplex, opcode: number, payload: Buffer) {
    const header: number[] = [0x80 | (opcode & 0x0f)];
    if (payload.length < 126) {
        header.push(payload.length);
    } else if (payload.length <= 0xffff) {
        header.push(126, (payload.length >> 8) & 0xff, payload.length & 0xff);
    } else {
        const length = payload.length;
        header.push(
            127,
            0,
            0,
            0,
            0,
            (length >> 24) & 0xff,
            (length >> 16) & 0xff,
            (length >> 8) & 0xff,
            length & 0xff,
        );
    }
    socket.write(Buffer.concat([Buffer.from(header), payload]));
}
