// GET /api/agent/status — overall agent status: queue counts, recent runs, DB stats

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getQueueStatus } from '@/lib/research-agent';

export async function GET() {
  try {
    // Clean up stale "running" runs (older than 10 minutes — likely orphaned by server restart)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.agentRun.updateMany({
      where: {
        status: 'running',
        startedAt: { lt: staleThreshold },
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        log: JSON.stringify([{ timestamp: new Date().toISOString(), level: 'error', message: 'Run marked as failed — server was restarted or process was interrupted' }]),
      },
    });

    // Also reset any "processing" queue items back to "pending" if their run is now failed
    await prisma.researchQueue.updateMany({
      where: {
        status: 'processing',
        processedByRun: { status: 'failed' },
      },
      data: { status: 'pending' },
    });

    const status = await getQueueStatus();

    // Get DB stats for the dashboard
    const [evidenceCount, entityCount, politicianCount, relationshipCount, eventCount] = await Promise.all([
      prisma.evidence.count(),
      prisma.entity.count(),
      prisma.politician.count(),
      prisma.actorRelationship.count(),
      prisma.event.count(),
    ]);

    // Get LLM provider info
    const provider = process.env.ALCHEMY_API_KEY ? 'alchemy' :
                     process.env.OPENAI_API_KEY ? 'openai' :
                     process.env.GITHUB_TOKEN ? 'github' : 'none';

    return NextResponse.json({
      ...status,
      database: {
        evidence: evidenceCount,
        entities: entityCount,
        politicians: politicianCount,
        relationships: relationshipCount,
        events: eventCount,
      },
      llmProvider: provider,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
