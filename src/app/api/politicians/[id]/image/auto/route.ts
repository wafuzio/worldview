export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { suggestActorImage } from '@/lib/actor-image';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await prisma.politician.findUnique({ where: { id: params.id } });
  if (!actor) {
    return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const persist = body?.persist === true;
  const excludeUrls = Array.isArray(body?.excludeUrls)
    ? body.excludeUrls.filter((u: unknown) => typeof u === 'string')
    : [];

  const suggestion = await suggestActorImage(actor.name, actor.type, { excludeUrls });
  if (!suggestion) {
    return NextResponse.json({ error: 'No image suggestion found' }, { status: 404 });
  }

  if (!persist) {
    return NextResponse.json({
      actor,
      suggestion,
      source: suggestion.source,
      persisted: false,
    });
  }

  const updated = await prisma.politician.update({ where: { id: params.id }, data: { imageUrl: suggestion.imageUrl } });

  return NextResponse.json({
    actor: updated,
    suggestion,
    source: suggestion.source,
    persisted: true,
  });
}
