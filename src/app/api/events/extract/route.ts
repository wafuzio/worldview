import { NextResponse } from 'next/server';
import { callLLM, parseJSONResponse } from '@/lib/llm';

// Extract historical events mentioned in content
export async function POST(request: Request) {
  const { content, evidenceId } = await request.json();

  if (!content) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }

  const prompt = `Extract all historical events, incidents, and dated occurrences mentioned in this text. For each event, identify when it happened and who was involved.

Text:
${content.slice(0, 5000)}

Return a JSON array of events:
[
  {
    "title": "Brief descriptive title of the event",
    "description": "Detailed description of what happened",
    "eventDate": "YYYY-MM-DD or YYYY-MM or YYYY (best estimate)",
    "endDate": "YYYY-MM-DD if event spans time, otherwise null",
    "dateAccuracy": "day|month|year|approximate",
    "location": "Where it happened (city, state, country) or null",
    "eventType": "speech|vote|policy|scandal|election|protest|legislation|court|general",
    "significance": 1-5 (importance rating),
    "primaryActors": ["names of main people/organizations involved"],
    "excerpt": "relevant quote from the text mentioning this event",
    "issues": ["related political issues/topics"]
  }
]

Be thorough - extract EVERY distinct event mentioned, including:
- Past votes, legislation, court decisions
- Speeches, statements, announcements
- Scandals, controversies, incidents
- Elections, appointments, resignations
- Protests, rallies, movements
- Policy changes, executive orders

If a date is unclear, estimate based on context and mark dateAccuracy accordingly.`;

  try {
    const response = await callLLM([
      { role: 'system', content: 'You are a historical event extraction system. Extract all events with accurate dates. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2 });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    const events = parseJSONResponse(response.content);

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Failed to parse events' }, { status: 500 });
    }

    // Group events by type for display
    const byType: Record<string, typeof events> = {};
    for (const event of events) {
      const type = event.eventType || 'general';
      if (!byType[type]) byType[type] = [];
      byType[type].push(event);
    }

    // Sort by date
    const sorted = [...events].sort((a, b) => {
      const dateA = new Date(a.eventDate).getTime();
      const dateB = new Date(b.eventDate).getTime();
      return dateB - dateA; // Newest first
    });

    return NextResponse.json({
      events: sorted,
      byType,
      total: events.length,
      evidenceId,
    });

  } catch (error) {
    console.error('Event extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
