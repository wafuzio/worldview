import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const politicianId = searchParams.get('politicianId');
  const status = searchParams.get('status');

  const statements = await prisma.statement.findMany({
    where: {
      ...(politicianId && { politicianId }),
      ...(status && { status }),
    },
    include: {
      politician: true,
      factChecks: { include: { evidence: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(statements);
}

export async function POST(request: Request) {
  const data = await request.json();
  const statement = await prisma.statement.create({
    data: {
      politicianId: data.politicianId,
      text: data.text,
      statementType: data.statementType || 'claim',
      madeAt: data.madeAt ? new Date(data.madeAt) : null,
      source: data.source,
      context: data.context,
      status: data.status || 'pending',
    },
  });
  return NextResponse.json(statement);
}
