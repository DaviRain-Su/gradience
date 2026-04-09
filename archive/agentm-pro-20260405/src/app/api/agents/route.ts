import { NextRequest, NextResponse } from 'next/server';
import { AgentIdentityService } from '@/lib/identity/agent';

const agentService = new AgentIdentityService();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');

    if (!ownerId) {
        return NextResponse.json({ error: 'ownerId required' }, { status: 400 });
    }

    const agents = await agentService.getByOwner(ownerId);
    return NextResponse.json(agents);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ownerId, name, chains = ['ethereum', 'solana'] } = body;

        if (!ownerId || !name) {
            return NextResponse.json({ error: 'ownerId and name required' }, { status: 400 });
        }

        const agent = await agentService.register({
            ownerId,
            name,
            chains,
        });

        return NextResponse.json(agent);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
