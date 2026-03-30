export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const data = await request.json();
  
  const answer = await prisma.answer.upsert({
    where: {
      sessionId_questionId: {
        sessionId: data.sessionId,
        questionId: data.questionId,
      },
    },
    update: { value: data.value },
    create: {
      sessionId: data.sessionId,
      questionId: data.questionId,
      value: data.value,
    },
  });
  
  return NextResponse.json(answer);
}
