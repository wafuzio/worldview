import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { suggestActorImage } from '@/lib/actor-image';

export async function GET() {
  const politicians = await prisma.politician.findMany({
    where: { isActive: true },
    include: {
      stances: { include: { question: true } },
      statements: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(politicians);
}

export async function POST(request: Request) {
  const data = await request.json();
  const suggestedImage = !data.imageUrl
    ? await suggestActorImage(data.name, data.type || 'politician')
    : null;
  const politician = await prisma.politician.create({
    data: {
      name: data.name,
      type: data.type || 'politician',
      description: data.description,
      title: data.title,
      affiliation: data.affiliation,
      imageUrl: data.imageUrl || suggestedImage?.imageUrl,
      economicScore: data.economicScore,
      socialScore: data.socialScore,
    },
  });
  return NextResponse.json(politician);
}
