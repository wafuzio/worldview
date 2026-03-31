import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const [recentNodes, recentConnections] = await Promise.all([
      prisma.politician.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          title: true,
          affiliation: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.actorRelationship.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          relationshipType: true,
          tier: true,
          significance: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          source: { select: { id: true, name: true, type: true } },
          target: { select: { id: true, name: true, type: true } },
        },
      }),
    ]);

    // Tag each item as 'new' or 'updated' based on whether createdAt ≈ updatedAt
    const THRESHOLD_MS = 2000; // 2s tolerance for DB write lag
    const nodes = recentNodes.map((n) => ({
      ...n,
      isNew: Math.abs(new Date(n.createdAt).getTime() - new Date(n.updatedAt).getTime()) < THRESHOLD_MS,
    }));
    const connections = recentConnections.map((c) => ({
      ...c,
      isNew: Math.abs(new Date(c.createdAt).getTime() - new Date(c.updatedAt).getTime()) < THRESHOLD_MS,
    }));

    return NextResponse.json({ nodes, connections });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
