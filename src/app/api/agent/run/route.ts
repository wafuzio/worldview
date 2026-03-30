export const dynamic = 'force-dynamic';

// POST /api/agent/run — trigger the research agent, streams SSE events back
// GET  /api/agent/run — get recent run history

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runResearchAgent, AgentRunConfig, AgentEvent } from '@/lib/research-agent';

// Track whether an agent run is currently in progress
let runInProgress = false;

export async function POST(req: NextRequest) {
  if (runInProgress) {
    return new Response(
      JSON.stringify({ error: 'An agent run is already in progress. Wait for it to complete.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await req.json().catch(() => ({}));

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: AgentEvent) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // client disconnected
    }
  };

  // Run the agent in the background, streaming events
  runInProgress = true;
  (async () => {
    try {
      const config: AgentRunConfig = {
        maxTopics: body.maxTopics ?? 5,
        depth: body.depth ?? 'standard',
        autoQueue: body.autoQueue ?? true,
        runType: body.runType ?? 'manual',
        onEvent: sendEvent,
      };

      const result = await runResearchAgent(config);

      // Send final result as a special event
      await sendEvent({ type: 'complete', detail: JSON.stringify(result), stats: result as any });
    } catch (e: any) {
      console.error('[agent/run] Error:', e);
      await sendEvent({ type: 'error', detail: e.message });
    } finally {
      runInProgress = false;
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function GET() {
  try {
    const runs = await prisma.agentRun.findMany({
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
        evidenceCreated: true,
        entitiesCreated: true,
        maxTopics: true,
        depth: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ runs, isRunning: runInProgress });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
