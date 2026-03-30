export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs';

function safeFileName(raw: string): string {
  const base = raw.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return base.replace(/-+/g, '-').slice(0, 120) || `image-${Date.now()}.png`;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}));
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';

  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
  }

  const updated = await prisma.politician.update({
    where: { id: params.id },
    data: { imageUrl },
  });

  return NextResponse.json(updated);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const form = await request.formData();
  const file = form.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const filename = `${Date.now()}-${safeFileName(params.id)}.${safeFileName(ext || 'png')}`;

  const outputDir = join(process.cwd(), 'public', 'actor-images');
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, filename), buffer);

  const imageUrl = `/actor-images/${filename}`;

  const updated = await prisma.politician.update({
    where: { id: params.id },
    data: { imageUrl },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const updated = await prisma.politician.update({
    where: { id: params.id },
    data: { imageUrl: null },
  });

  return NextResponse.json(updated);
}
