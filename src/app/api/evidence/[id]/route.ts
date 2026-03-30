export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET single evidence by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const evidence = await prisma.evidence.findUnique({
    where: { id: params.id },
    include: {
      tags: { include: { tag: true } },
      category: true,
    },
  });

  if (!evidence) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(evidence);
}

// PUT update evidence
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();

  const evidence = await prisma.evidence.update({
    where: { id: params.id },
    data: {
      title: data.title,
      summary: data.summary,
      sourceName: data.sourceName,
      sourceUrl: data.sourceUrl,
      sourceClassification: data.sourceClassification,
      verificationStatus: data.verificationStatus,
      politicalContext: data.politicalContext,
      categoryId: data.categoryId,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      dateAccuracy: data.dateAccuracy,
    },
  });

  return NextResponse.json(evidence);
}

// DELETE evidence
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.evidence.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
