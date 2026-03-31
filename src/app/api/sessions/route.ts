export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const data = await request.json().catch(() => ({}));

    // Check for existing session with this token
    if (data.userToken) {
      const existing = await prisma.session.findUnique({
        where: { userToken: data.userToken },
      });
      if (existing) {
        return NextResponse.json(existing);
      }
    }

    const session = await prisma.session.create({
      data: {
        userToken: data.userToken,
        nickname: data.nickname,
      },
    });
    return NextResponse.json(session);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create session' }, { status: 500 });
  }
}
