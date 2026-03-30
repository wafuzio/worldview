export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const entities = await prisma.entity.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(entities);
}
