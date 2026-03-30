import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const questions = await prisma.question.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }],
  });
  return NextResponse.json(questions);
}

export async function POST(request: Request) {
  const data = await request.json();
  const evidenceLinks = Array.isArray(data.evidenceLinks) ? data.evidenceLinks : [];
  const evidenceIds = Array.isArray(data.evidenceIds) ? data.evidenceIds : [];
  const normalizedEvidenceLinks = evidenceLinks
    .map((link: any) => {
      const evidenceId = typeof link?.evidenceId === 'string' ? link.evidenceId : '';
      if (!evidenceId) return null;
      const relationship = typeof link?.relationship === 'string' ? link.relationship : 'neutral';
      const note = typeof link?.note === 'string' ? link.note.slice(0, 500) : undefined;
      return { evidenceId, relationship, note };
    })
    .filter(Boolean) as Array<{ evidenceId: string; relationship: string; note?: string }>;

  const fallbackEvidenceLinks = evidenceIds
    .filter((id: any) => typeof id === 'string' && id)
    .map((evidenceId: string) => ({ evidenceId, relationship: 'neutral' }));

  const evidenceCreate = normalizedEvidenceLinks.length > 0 ? normalizedEvidenceLinks : fallbackEvidenceLinks;

  const question = await prisma.question.create({
    data: {
      text: data.text,
      description: data.description,
      categoryId: data.categoryId,
      leftLabel: data.leftLabel,
      rightLabel: data.rightLabel,
      questionType: data.questionType || 'scale',
      yesValue: typeof data.yesValue === 'number' ? data.yesValue : 1,
      parentId: data.parentId || null,
      branchCondition: data.branchCondition || null,
      consensusText: data.consensusText || null,
      isActive: data.isActive ?? true,
      alignmentMap: JSON.stringify(data.alignmentMap || {}),
      order: data.order || 0,
      evidence: evidenceCreate.length > 0 ? {
        create: evidenceCreate,
      } : undefined,
    },
    include: { category: true },
  });
  return NextResponse.json(question);
}
