export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function normalize(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveByName(
  actors: { id: string; name: string; type: string }[],
  name: string
): { id: string; name: string; type: string } | null {
  const q = normalize(name);
  if (!q) return null;

  const exact = actors.find((a) => normalize(a.name) === q);
  if (exact) return exact;

  const starts = actors.find((a) => normalize(a.name).startsWith(q));
  if (starts) return starts;

  const contains = actors.find((a) => normalize(a.name).includes(q));
  if (contains) return contains;

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromId = (searchParams.get('fromId') || '').trim();
    const toId = (searchParams.get('toId') || '').trim();
    const fromName = (searchParams.get('fromName') || '').trim();
    const toName = (searchParams.get('toName') || '').trim();

    if (!fromId && !fromName) {
      return NextResponse.json({ error: 'fromId or fromName is required' }, { status: 400 });
    }
    if (!toId && !toName) {
      return NextResponse.json({ error: 'toId or toName is required' }, { status: 400 });
    }

    const actors = await prisma.politician.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      take: 8000,
    });
    const actorById = new Map(actors.map((a) => [a.id, a]));

    const from = fromId
      ? actorById.get(fromId) || null
      : resolveByName(actors, fromName);
    const to = toId
      ? actorById.get(toId) || null
      : resolveByName(actors, toName);

    if (!from) return NextResponse.json({ error: 'Could not resolve source node' }, { status: 404 });
    if (!to) return NextResponse.json({ error: 'Could not resolve target node' }, { status: 404 });

    if (from.id === to.id) {
      return NextResponse.json({
        found: true,
        hops: 0,
        from,
        to,
        nodes: [from],
        edges: [],
      });
    }

    const rels = await prisma.actorRelationship.findMany({
      where: {
        source: { isActive: true },
        target: { isActive: true },
      },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationshipType: true,
        tier: true,
        significance: true,
        description: true,
        _count: { select: { evidence: true } },
      },
    });

    const relById = new Map(rels.map((r) => [r.id, r]));
    const adjacency = new Map<string, Array<{ neighborId: string; relId: string }>>();
    for (const rel of rels) {
      if (!actorById.has(rel.sourceId) || !actorById.has(rel.targetId)) continue;
      if (!adjacency.has(rel.sourceId)) adjacency.set(rel.sourceId, []);
      if (!adjacency.has(rel.targetId)) adjacency.set(rel.targetId, []);
      adjacency.get(rel.sourceId)!.push({ neighborId: rel.targetId, relId: rel.id });
      adjacency.get(rel.targetId)!.push({ neighborId: rel.sourceId, relId: rel.id });
    }

    const queue: string[] = [from.id];
    const visited = new Set<string>([from.id]);
    const prev = new Map<string, { prevNodeId: string; relId: string }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to.id) break;
      const neighbors = adjacency.get(current) || [];
      for (const n of neighbors) {
        if (visited.has(n.neighborId)) continue;
        visited.add(n.neighborId);
        prev.set(n.neighborId, { prevNodeId: current, relId: n.relId });
        queue.push(n.neighborId);
      }
    }

    if (!prev.has(to.id)) {
      return NextResponse.json({
        found: false,
        from,
        to,
        message: 'No relationship path found between these nodes.',
      });
    }

    const nodePathIds: string[] = [];
    const edgePathIds: string[] = [];
    let cursor = to.id;
    nodePathIds.push(cursor);
    while (cursor !== from.id) {
      const step = prev.get(cursor);
      if (!step) break;
      edgePathIds.push(step.relId);
      nodePathIds.push(step.prevNodeId);
      cursor = step.prevNodeId;
    }
    nodePathIds.reverse();
    edgePathIds.reverse();

    const pathNodes = nodePathIds
      .map((id) => actorById.get(id))
      .filter((n): n is { id: string; name: string; type: string } => Boolean(n));

    const pathEdges = edgePathIds.map((id, idx) => {
      const rel = relById.get(id)!;
      const sourceNode = pathNodes[idx];
      const targetNode = pathNodes[idx + 1];
      const forward =
        rel.sourceId === sourceNode.id && rel.targetId === targetNode.id;
      return {
        id: rel.id,
        sourceId: sourceNode.id,
        sourceName: sourceNode.name,
        targetId: targetNode.id,
        targetName: targetNode.name,
        relationshipType: rel.relationshipType,
        tier: rel.tier,
        significance: rel.significance,
        description: rel.description,
        evidenceCount: rel._count.evidence,
        originalDirection: forward ? 'forward' : 'reverse',
      };
    });

    return NextResponse.json({
      found: true,
      hops: pathEdges.length,
      from,
      to,
      nodes: pathNodes,
      edges: pathEdges,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to trace path' }, { status: 500 });
  }
}
