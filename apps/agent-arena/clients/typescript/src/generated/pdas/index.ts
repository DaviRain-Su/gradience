import { getProgramDerivedAddress, type Address } from '@solana/kit';

import { GRADIENCE_PROGRAM_ADDRESS } from '../programs/gradience.js';

export async function findEventAuthorityPda(
    programAddress: Address = GRADIENCE_PROGRAM_ADDRESS,
): Promise<Address> {
    const [pda] = await getProgramDerivedAddress({
        programAddress,
        seeds: [new TextEncoder().encode('event_authority')],
    });
    return pda;
}
