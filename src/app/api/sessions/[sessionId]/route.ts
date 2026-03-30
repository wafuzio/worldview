import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              category: true,
              evidence: { include: { evidence: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(session);
}
