export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET timeline with tag filtering
// Query params:
// - includeTags: comma-separated tag IDs (must have ALL these tags)
// - excludeTags: comma-separated tag IDs (must NOT have any of these)
// - anyTags: comma-separated tag IDs (must have AT LEAST ONE of these)
// - startDate: ISO date string
// - endDate: ISO date string
// - sortBy: "eventDate" | "publishedAt" | "createdAt"
// - sortOrder: "asc" | "desc"
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const includeTags = searchParams.get('includeTags')?.split(',').filter(Boolean) || [];
  const excludeTags = searchParams.get('excludeTags')?.split(',').filter(Boolean) || [];
  const anyTags = searchParams.get('anyTags')?.split(',').filter(Boolean) || [];
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const sortBy = searchParams.get('sortBy') || 'eventDate';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Build the where clause
  const where: any = {};

  // Date filtering - use eventDate if available, fall back to publishedAt
  if (startDate || endDate) {
    where.OR = [
      {
        eventDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      },
      {
        AND: [
          { eventDate: null },
          {
            publishedAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          },
        ],
      },
    ];
  }

  // Fetch all evidence first, then filter by tags in memory
  // (Prisma doesn't support complex many-to-many filtering well)
  let evidence = await prisma.evidence.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      category: true,
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  // Filter by includeTags (must have ALL)
  if (includeTags.length > 0) {
    evidence = evidence.filter(e => {
      const tagIds = e.tags.map(t => t.tagId);
      return includeTags.every(id => tagIds.includes(id));
    });
  }

  // Filter by excludeTags (must NOT have any)
  if (excludeTags.length > 0) {
    evidence = evidence.filter(e => {
      const tagIds = e.tags.map(t => t.tagId);
      return !excludeTags.some(id => tagIds.includes(id));
    });
  }

  // Filter by anyTags (must have at least one)
  if (anyTags.length > 0) {
    evidence = evidence.filter(e => {
      const tagIds = e.tags.map(t => t.tagId);
      return anyTags.some(id => tagIds.includes(id));
    });
  }

  // Group by date for timeline display
  const timeline: Record<string, typeof evidence> = {};
  
  for (const item of evidence) {
    const date = item.eventDate || item.publishedAt || item.createdAt;
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!timeline[dateKey]) {
      timeline[dateKey] = [];
    }
    timeline[dateKey].push(item);
  }

  // Convert to sorted array
  const timelineArray = Object.entries(timeline)
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => {
      const comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  return NextResponse.json({
    timeline: timelineArray,
    total: evidence.length,
    filters: {
      includeTags,
      excludeTags,
      anyTags,
      startDate,
      endDate,
    },
  });
}
