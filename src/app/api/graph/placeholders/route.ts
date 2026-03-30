export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addToQueue } from '@/lib/research-agent';
import { suggestActorImage } from '@/lib/actor-image';

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function isPlaceholderNode(input: { description?: string | null; tags?: string | null }): boolean {
  const tagList = parseTags(input.tags || null).map((t) => t.toLowerCase());
  if (tagList.includes('placeholder') || tagList.includes('needs_verification')) return true;
  return (input.description || '').toLowerCase().includes('placeholder');
}

const ALLOWED_TYPES = new Set([
  'politician',
  'party',
  'lobbyist',
  'pac',
  'corporation',
  'media_figure',
  'organization',
  'legislation',
  'event',
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '200'), 500));

    const rows = await prisma.politician.findMany({
      where: {
        isActive: true,
        OR: [
          { tags: { contains: 'placeholder' } },
          { description: { contains: 'Placeholder' } },
        ],
      },
      select: { id: true, name: true, type: true, description: true, tags: true },
      orderBy: { name: 'asc' },
      take: limit,
    });

    const filtered = rows
      .filter((r) => isPlaceholderNode({ description: r.description, tags: r.tags }))
      .filter((r) => !q || `${r.name} ${r.type} ${r.description || ''}`.toLowerCase().includes(q))
      .map((r) => ({ id: r.id, name: r.name, type: r.type }));

    return NextResponse.json({ items: filtered });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load placeholders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body?.sourceId === 'string' ? body.sourceId.trim() : '';
    const targetId = typeof body?.targetId === 'string' ? body.targetId.trim() : '';
    const targetName = typeof body?.targetName === 'string' ? body.targetName.trim() : '';
    const targetTypeRaw = typeof body?.targetType === 'string' ? body.targetType.trim() : 'organization';
    const relationshipType = typeof body?.relationshipType === 'string' && body.relationshipType.trim()
      ? body.relationshipType.trim()
      : 'placeholder_link';

    if (!sourceId || (!targetId && !targetName)) {
      return NextResponse.json({ error: 'sourceId and targetId or targetName are required' }, { status: 400 });
    }

    const source = await prisma.politician.findUnique({ where: { id: sourceId } });
    if (!source) {
      return NextResponse.json({ error: 'Source node not found' }, { status: 404 });
    }

    let target: { id: string; name: string; type: string } | null = null;
    let createdTarget = false;

    if (targetId) {
      if (targetId === sourceId) {
        return NextResponse.json({ error: 'Cannot connect a node to itself' }, { status: 400 });
      }
      const existingTarget = await prisma.politician.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, type: true, description: true, tags: true },
      });
      if (!existingTarget) {
        return NextResponse.json({ error: 'Target node not found' }, { status: 404 });
      }
      if (!isPlaceholderNode(existingTarget)) {
        return NextResponse.json({ error: 'Target must be an existing placeholder node' }, { status: 400 });
      }
      target = { id: existingTarget.id, name: existingTarget.name, type: existingTarget.type };
    } else {
      const targetType = ALLOWED_TYPES.has(targetTypeRaw) ? targetTypeRaw : 'organization';
      const normalizedTarget = normalizeName(targetName);

      const candidates = await prisma.politician.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true },
        take: 2000,
      });

      target = candidates.find((a) => normalizeName(a.name) === normalizedTarget) || null;
      if (!target) {
        target = await prisma.politician.create({
          data: {
            name: targetName,
            type: targetType,
            description: 'Placeholder node pending evidence-backed enrichment.',
            tags: JSON.stringify(['placeholder', 'needs_verification']),
            isActive: true,
          },
          select: { id: true, name: true, type: true },
        });
        createdTarget = true;
      }
    }

    // Auto-attempt to fill image for new or image-less matched nodes.
    let imageAutoApplied = false;
    let imageSource: string | null = null;
    const targetWithImage = await prisma.politician.findUnique({
      where: { id: target.id },
      select: { id: true, imageUrl: true, name: true, type: true },
    });
    if (targetWithImage && !targetWithImage.imageUrl) {
      const suggestion = await suggestActorImage(targetWithImage.name, targetWithImage.type);
      if (suggestion?.imageUrl) {
        await prisma.politician.update({
          where: { id: targetWithImage.id },
          data: { imageUrl: suggestion.imageUrl },
        });
        imageAutoApplied = true;
        imageSource = suggestion.source;
      }
    }

    const existingRelationship = await prisma.actorRelationship.findFirst({
      where: {
        OR: [
          { sourceId: source.id, targetId: target.id },
          { sourceId: target.id, targetId: source.id },
        ],
      },
      select: { id: true },
    });

    let relationshipId = existingRelationship?.id || null;
    let createdRelationship = false;
    if (!existingRelationship) {
      const rel = await prisma.actorRelationship.create({
        data: {
          sourceId: source.id,
          targetId: target.id,
          tier: 'analytical',
          relationshipType,
          significance: 1,
          description: `Placeholder link queued for verification: ${source.name} ↔ ${target.name}.`,
        },
        select: { id: true },
      });
      relationshipId = rel.id;
      createdRelationship = true;
    }

    const topic = `Verify and document evidence-backed connections between ${source.name} and ${target.name}`;
    const existingTopic = await prisma.researchQueue.findFirst({
      where: {
        AND: [
          { topic: { contains: source.name.slice(0, 40) } },
          { topic: { contains: target.name.slice(0, 40) } },
        ],
        status: { in: ['pending', 'processing', 'completed'] },
      },
      select: { id: true, topic: true, status: true },
    });

    let queueId: string | null = null;
    let queued = false;
    if (!existingTopic) {
      queueId = await addToQueue(topic, {
        rationale: `Placeholder link created from map editor to close a known gap between ${source.name} and ${target.name}.`,
        priority: 'high',
        depth: 'deep',
        source: 'gap_fill',
      });
      queued = true;
    }

    return NextResponse.json({
      source: { id: source.id, name: source.name, type: source.type },
      target,
      relationshipId,
      createdTarget,
      createdRelationship,
      imageAutoApplied,
      imageSource,
      queued,
      queueId,
      existingTopic: existingTopic || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create placeholder link' }, { status: 500 });
  }
}
