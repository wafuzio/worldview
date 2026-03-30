import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET single question
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { category: true },
  });

  if (!question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(question);
}

// PUT update question
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();
  const evidenceLinks = Array.isArray(data.evidenceLinks) ? data.evidenceLinks : null;
  const evidenceIds = Array.isArray(data.evidenceIds) ? data.evidenceIds : null;
  const shouldUpdateEvidence = evidenceLinks !== null || evidenceIds !== null;

  const normalizedEvidenceLinks = (evidenceLinks || [])
    .map((link: any) => {
      const evidenceId = typeof link?.evidenceId === 'string' ? link.evidenceId : '';
      if (!evidenceId) return null;
      const relationship = typeof link?.relationship === 'string' ? link.relationship : 'neutral';
      const note = typeof link?.note === 'string' ? link.note.slice(0, 500) : undefined;
      return { evidenceId, relationship, note };
    })
    .filter(Boolean) as Array<{ evidenceId: string; relationship: string; note?: string }>;

  const fallbackEvidenceLinks = (evidenceIds || [])
    .filter((id: any) => typeof id === 'string' && id)
    .map((evidenceId: string) => ({ evidenceId, relationship: 'neutral' }));

  const question = await prisma.question.update({
    where: { id: params.id },
    data: {
      text: data.text,
      description: data.description,
      leftLabel: data.leftLabel,
      rightLabel: data.rightLabel,
      isActive: data.isActive,
      categoryId: data.categoryId,
      questionType: data.questionType,
      yesValue: typeof data.yesValue === 'number' ? data.yesValue : undefined,
      parentId: data.parentId ?? undefined,
      branchCondition: data.branchCondition ?? undefined,
      consensusText: data.consensusText ?? undefined,
      evidence: shouldUpdateEvidence
        ? {
            deleteMany: {},
            create: normalizedEvidenceLinks.length > 0 ? normalizedEvidenceLinks : fallbackEvidenceLinks,
          }
        : undefined,
    },
    include: { category: true },
  });

  return NextResponse.json(question);
}

// DELETE question
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.question.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
