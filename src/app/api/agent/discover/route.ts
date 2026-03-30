export const dynamic = 'force-dynamic';

// POST /api/agent/discover — run the discovery agent to find new topics
// GET  /api/agent/discover — get discovery run history

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runDiscovery, DiscoveryConfig } from '@/lib/discovery-agent';

let discoveryInProgress = false;

export async function POST(req: NextRequest) {
  if (discoveryInProgress) {
    return NextResponse.json(
      { error: 'A discovery run is already in progress.' },
      { status: 409 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const config: DiscoveryConfig = {
      mode: body.mode ?? 'all',
      maxTopics: body.maxTopics ?? 10,
      priority: body.priority,
    };

    discoveryInProgress = true;
    const result = await runDiscovery(config);
    discoveryInProgress = false;

    return NextResponse.json(result);
  } catch (e: any) {
    discoveryInProgress = false;
    console.error('[agent/discover] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const runs = await prisma.agentRun.findMany({
      where: { runType: 'discovery' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        topicsDiscovered: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ runs, isRunning: discoveryInProgress });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
