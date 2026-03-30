// GET  /api/agent/queue         — list queue items (with filters)
// POST /api/agent/queue         — add a topic to the queue
// PATCH /api/agent/queue        — update queue item status (skip, re-queue, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addToQueue } from '@/lib/research-agent';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status'); // pending, completed, failed, all
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where = status && status !== 'all' ? { status } : {};

    const [rawItems, total] = await Promise.all([
      prisma.researchQueue.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: Math.max(limit * 3, 150),
        skip: offset,
        include: {
          sourceRun: { select: { id: true, runType: true, startedAt: true } },
          processedByRun: { select: { id: true, runType: true, startedAt: true } },
        },
      }),
      prisma.researchQueue.count({ where }),
    ]);

    const priorityOrder: Record<string, number> = { urgent: -1, high: 0, medium: 1, low: 2 };
    const items = (status === 'pending'
      ? rawItems.sort((a, b) => {
          const pa = priorityOrder[a.priority] ?? 3;
          const pb = priorityOrder[b.priority] ?? 3;
          if (pa !== pb) return pa - pb;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
      : rawItems
    ).slice(0, limit);

    return NextResponse.json({ items, total, limit, offset });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, rationale, priority, depth } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400 });
    }

    // Check for duplicates
    const existing = await prisma.researchQueue.findFirst({
      where: {
        topic: { contains: topic.trim().substring(0, 50) },
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existing) {
      return NextResponse.json({
        error: 'Similar topic already in queue',
        existing: { id: existing.id, topic: existing.topic, status: existing.status },
      }, { status: 409 });
    }

    const id = await addToQueue(topic.trim(), {
      rationale,
      priority: priority || 'medium',
      depth: depth || 'standard',
      source: 'manual',
    });

    return NextResponse.json({ id, topic: topic.trim(), status: 'pending' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id and action' }, { status: 400 });
    }

    const item = await prisma.researchQueue.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    switch (action) {
      case 'pin_next':
        await prisma.researchQueue.update({
          where: { id },
          data: { priority: 'urgent' },
        });
        break;
      case 'unpin_next':
        await prisma.researchQueue.update({
          where: { id },
          data: { priority: body.priority || 'high' },
        });
        break;
      case 'skip':
        await prisma.researchQueue.update({
          where: { id },
          data: { status: 'skipped' },
        });
        break;
      case 'requeue':
        await prisma.researchQueue.update({
          where: { id },
          data: { status: 'pending', error: null, attempts: 0 },
        });
        break;
      case 'prioritize':
        await prisma.researchQueue.update({
          where: { id },
          data: { priority: body.priority || 'high' },
        });
        break;
      case 'delete':
        await prisma.researchQueue.delete({ where: { id } });
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, id, action });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
