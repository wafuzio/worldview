export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get('tagId');
  const categoryId = searchParams.get('categoryId');

  const evidence = await prisma.evidence.findMany({
    where: {
      ...(tagId && { tags: { some: { tagId } } }),
      ...(categoryId && { categoryId }),
    },
    include: {
      tags: { include: { tag: true } },
      category: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(evidence);
}

export async function POST(request: Request) {
  const data = await request.json();

  const evidence = await prisma.evidence.create({
    data: {
      title: data.title,
      summary: data.summary,
      content: data.content,
      sourceUrl: data.sourceUrl,
      sourceName: data.sourceName,
      videoUrl: data.videoUrl,
      transcriptUrl: data.transcriptUrl,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      rawContent: data.rawContent,
      sourceClassification: data.sourceClassification || 'secondary_source',
      verificationStatus: data.verificationStatus || 'single_source',
      corroborationCount: data.corroborationCount || 1,
      independentSourceCount: data.independentSourceCount || 1,
      politicalContext: data.politicalContext || 'neutral',
      categoryId: data.categoryId,
      isProcessed: !data.rawContent,
    },
  });

  // Add tags if provided
  if (data.tagIds?.length) {
    await prisma.evidenceTag.createMany({
      data: data.tagIds.map((tagId: string) => ({
        evidenceId: evidence.id,
        tagId,
      })),
    });
  }

  return NextResponse.json(evidence);
}
