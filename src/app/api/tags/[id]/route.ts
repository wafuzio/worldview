import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET single tag
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tag = await prisma.tag.findUnique({
    where: { id: params.id },
    include: { synonyms: true },
  });

  if (!tag) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(tag);
}

// PUT update tag
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();

  // Update basic tag info
  const tag = await prisma.tag.update({
    where: { id: params.id },
    data: {
      name: data.name,
      color: data.color,
    },
  });

  // Handle synonyms - delete existing and create new ones
  if (data.synonyms) {
    // Delete existing synonyms
    await prisma.tagSynonym.deleteMany({
      where: { tagId: params.id },
    });

    // Create new synonyms
    for (const synonym of data.synonyms) {
      await prisma.tagSynonym.create({
        data: {
          tagId: params.id,
          phrase: synonym,
        },
      });
    }
  }

  // Fetch updated tag with synonyms
  const updatedTag = await prisma.tag.findUnique({
    where: { id: params.id },
    include: { synonyms: true },
  });

  return NextResponse.json(updatedTag);
}

// DELETE tag
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Delete synonyms first
  await prisma.tagSynonym.deleteMany({
    where: { tagId: params.id },
  });

  await prisma.tag.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
