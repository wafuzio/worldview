export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculatePoliticalPosition } from '@/lib/utils';

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const answers = await prisma.answer.findMany({
    where: { sessionId: params.sessionId },
    include: { question: true },
  });

  const scores = calculatePoliticalPosition(
    answers.map((a) => ({ value: a.value, alignmentMap: a.question.alignmentMap }))
  );

  const session = await prisma.session.update({
    where: { id: params.sessionId },
    data: {
      economicScore: scores.economic,
      socialScore: scores.social,
      isComplete: true,
      completedAt: new Date(),
    },
  });

  return NextResponse.json(session);
}
