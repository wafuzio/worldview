export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get('tagId');

  const synonyms = await prisma.tagSynonym.findMany({
    where: tagId ? { tagId } : {},
    include: { tag: true },
    orderBy: { phrase: 'asc' },
  });
  return NextResponse.json(synonyms);
}

export async function POST(request: Request) {
  const data = await request.json();
  const synonym = await prisma.tagSynonym.create({
    data: {
      tagId: data.tagId,
      phrase: data.phrase.toLowerCase(),
    },
    include: { tag: true },
  });
  return NextResponse.json(synonym);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }
  
  await prisma.tagSynonym.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
