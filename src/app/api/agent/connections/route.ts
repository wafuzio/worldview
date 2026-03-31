export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runConnectionAgent } from '@/lib/connection-agent';

let runInProgress = false;

export async function POST(req: NextRequest) {
  if (runInProgress) {
    return NextResponse.json(
      { error: 'Connection agent is already running. Wait for completion.' },
      { status: 409 }
    );
  }

  runInProgress = true;
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runConnectionAgent({
      maxNewLinks: body.maxNewLinks ?? 25,
      queueVerificationTopics: body.queueVerificationTopics ?? true,
      dryRun: body.dryRun ?? false,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Connection agent failed' }, { status: 500 });
  } finally {
    runInProgress = false;
  }
}

export async function GET() {
  try {
    const runs = await prisma.agentRun.findMany({
      where: { runType: 'connection_tighten' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        runType: true,
        status: true,
        topicsProcessed: true,
        topicsSucceeded: true,
        topicsFailed: true,
        topicsDiscovered: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ runs, isRunning: runInProgress });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

