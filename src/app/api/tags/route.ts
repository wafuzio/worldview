import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const data = await request.json();
  const tag = await prisma.tag.create({
    data: {
      name: data.name,
      description: data.description,
      color: data.color || '#6366f1',
    },
  });
  return NextResponse.json(tag);
}
