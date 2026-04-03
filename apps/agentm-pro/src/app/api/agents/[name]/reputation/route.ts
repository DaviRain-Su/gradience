import { NextRequest, NextResponse } from 'next/server';
import { ReputationService } from '@/lib/identity/reputation';

const reputationService = new ReputationService();

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const name = decodeURIComponent(params.name);
  const reputation = await reputationService.get(name);

  if (!reputation) {
    return NextResponse.json(
      { error: 'Agent not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(reputation);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const name = decodeURIComponent(params.name);
    const body = await request.json();
    const { score, amount } = body;

    const updated = await reputationService.recordTask(name, { score, amount });

    if (!updated) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
