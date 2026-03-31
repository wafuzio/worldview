export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  addMissingNodesToGraph,
  discoverMissingNodes,
  MissingNodeSuggestion,
} from '@/lib/node-discovery-agent';

let inProgress = false;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || 'suggest');

  if (action === 'add') {
    try {
      const selected = Array.isArray(body?.selected) ? body.selected : [];
      const typed: MissingNodeSuggestion[] = selected.map((s: any) => ({
        name: String(s?.name || ''),
        type: String(s?.type || 'organization'),
        rationale: String(s?.rationale || ''),
        importance: Number(s?.importance || 3),
        suggestedConnections: Array.isArray(s?.suggestedConnections)
          ? s.suggestedConnections.map((c: any) => ({
              existingNodeName: String(c?.existingNodeName || ''),
              relationshipHypothesis: String(c?.relationshipHypothesis || ''),
            }))
          : [],
      }));
      const result = await addMissingNodesToGraph(typed);
      return NextResponse.json(result);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to add discovered nodes' }, { status: 500 });
    }
  }

  if (inProgress) {
    return NextResponse.json({ error: 'Node discovery already in progress.' }, { status: 409 });
  }

  const maxNodes = Math.max(5, Math.min(Number(body?.maxNodes || 8), 10));
  const run = await prisma.agentRun.create({
    data: {
      runType: 'node_discovery',
      status: 'running',
      maxTopics: maxNodes,
      depth: 'standard',
    },
  });

  inProgress = true;
  try {
    const { suggestions, log } = await discoverMissingNodes(maxNodes);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        topicsDiscovered: suggestions.length,
        topicsProcessed: 0,
        topicsSucceeded: 0,
        topicsFailed: 0,
        log: JSON.stringify(log),
      },
    });

    return NextResponse.json({
      runId: run.id,
      suggestions,
      count: suggestions.length,
    });
  } catch (e: any) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        log: JSON.stringify([{ timestamp: new Date().toISOString(), level: 'error', message: e?.message || 'Node discovery failed' }]),
      },
    });
    return NextResponse.json({ error: e?.message || 'Node discovery failed' }, { status: 500 });
  } finally {
    inProgress = false;
  }
}

export async function GET() {
  try {
    const runs = await prisma.agentRun.findMany({
      where: { runType: 'node_discovery' },
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
    return NextResponse.json({ runs, isRunning: inProgress });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

