import { NextResponse } from 'next/server';
import { callLLM, parseJSONResponse } from '@/lib/llm';

// Extract named entities from text content
export async function POST(request: Request) {
  const { content, evidenceId } = await request.json();

  if (!content) {
    return NextResponse.json({ error: 'Content required' }, { status: 400 });
  }

  const prompt = `Extract all named entities from this text. Categorize each entity and note how they are portrayed.

Text:
${content.slice(0, 4000)}

Return JSON array with ALL entities found:
[
  {
    "name": "Full proper name",
    "type": "person|organization|place|event|legislation|media",
    "aliases": ["alternate names or abbreviations"],
    "title": "current role/title if person",
    "affiliation": "party/company/group if applicable",
    "mentions": number of times mentioned,
    "sentiment": "positive|negative|neutral",
    "context": "brief description of how they appear in text"
  }
]

Include: politicians, government officials, organizations, think tanks, media outlets, companies, places, laws/bills, events.
Be thorough - extract EVERY named entity.`;

  try {
    const response = await callLLM([
      { role: 'system', content: 'You are a named entity recognition system. Extract all entities accurately. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2 });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    const entities = parseJSONResponse(response.content);

    if (!entities || !Array.isArray(entities)) {
      return NextResponse.json({ error: 'Failed to parse entities' }, { status: 500 });
    }

    // Categorize entities by type for easier display
    const categorized = {
      people: entities.filter((e: any) => e.type === 'person'),
      organizations: entities.filter((e: any) => e.type === 'organization'),
      places: entities.filter((e: any) => e.type === 'place'),
      legislation: entities.filter((e: any) => e.type === 'legislation'),
      events: entities.filter((e: any) => e.type === 'event'),
      media: entities.filter((e: any) => e.type === 'media'),
      other: entities.filter((e: any) => !['person', 'organization', 'place', 'legislation', 'event', 'media'].includes(e.type)),
    };

    return NextResponse.json({
      entities,
      categorized,
      total: entities.length,
      evidenceId,
    });

  } catch (error) {
    console.error('Entity extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
