import type { InteropSink } from '../types.js';

export class MappedInteropSink implements InteropSink {
    constructor(
        private readonly sink: InteropSink,
        private readonly mapper: (payload: unknown) => unknown | unknown[],
        private readonly validator?: (payload: unknown) => boolean,
    ) {}

    async publish(payload: unknown): Promise<void> {
        if (this.validator && !this.validator(payload)) {
            throw new Error('invalid interop payload');
        }
        const mapped = this.mapper(payload);
        if (Array.isArray(mapped)) {
            for (const entry of mapped) {
                await this.sink.publish(entry);
            }
            return;
        }
        await this.sink.publish(mapped);
    }
}
