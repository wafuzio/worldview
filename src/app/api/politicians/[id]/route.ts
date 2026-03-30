import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await prisma.politician.findUnique({
    where: { id: params.id },
  });

  if (!actor) {
    return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
  }

  return NextResponse.json(actor);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}));

  const update: Record<string, any> = {};
  const allowed = ['name', 'type', 'description', 'title', 'affiliation', 'imageUrl', 'isActive'];
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const actor = await prisma.politician.update({
      where: { id: params.id },
      data: update,
    });
    return NextResponse.json(actor);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
