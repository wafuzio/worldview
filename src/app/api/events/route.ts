export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET all events with optional filtering
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const tagIds = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const eventType = searchParams.get('type');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const where: any = {};

  if (eventType) {
    where.eventType = eventType;
  }

  if (startDate || endDate) {
    where.eventDate = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  let events = await prisma.event.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      sources: { 
        include: { 
          evidence: { 
            select: { id: true, title: true, sourceName: true, sourceUrl: true } 
          } 
        } 
      },
    },
    orderBy: { eventDate: sortOrder === 'asc' ? 'asc' : 'desc' },
  });

  // Filter by tags if specified
  if (tagIds.length > 0) {
    events = events.filter(e => {
      const eventTagIds = e.tags.map(t => t.tagId);
      return tagIds.some(id => eventTagIds.includes(id));
    });
  }

  return NextResponse.json(events);
}

// POST create new event
export async function POST(request: Request) {
  const data = await request.json();

  const event = await prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      eventDate: new Date(data.eventDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      dateAccuracy: data.dateAccuracy || 'day',
      location: data.location,
      eventType: data.eventType || 'general',
      significance: data.significance || 3,
      primaryActors: data.primaryActors ? JSON.stringify(data.primaryActors) : null,
    },
  });

  // Link to evidence if provided
  if (data.evidenceId) {
    await prisma.eventSource.create({
      data: {
        eventId: event.id,
        evidenceId: data.evidenceId,
        relationship: data.relationship || 'mentions',
        excerpt: data.excerpt,
      },
    });
  }

  // Add tags if provided
  if (data.tagIds && data.tagIds.length > 0) {
    for (const tagId of data.tagIds) {
      await prisma.eventTag.create({
        data: { eventId: event.id, tagId },
      });
    }
  }

  return NextResponse.json(event);
}
