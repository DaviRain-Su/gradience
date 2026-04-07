import {
    getArrayDecoder,
    getArrayEncoder,
    getU8Decoder,
    getU8Encoder,
    type Decoder,
    type Encoder,
} from '@solana/kit';

export type PubkeyBytes = number[];
export type PubkeyBytesArgs = number[];

export function getPubkeyBytesEncoder(): Encoder<PubkeyBytesArgs> {
    return getArrayEncoder(getU8Encoder(), { size: 32 });
}

export function getPubkeyBytesDecoder(): Decoder<PubkeyBytes> {
    return getArrayDecoder(getU8Decoder(), { size: 32 });
}
