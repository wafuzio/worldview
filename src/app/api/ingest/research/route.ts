// POST /api/ingest/research
// Accepts structured research JSON (from LLM output) and ingests into database.
// Raw input is saved to /data/research-logs/research/ before processing.
import { NextRequest, NextResponse } from 'next/server';
import { ingestResearch, ResearchInput } from '@/lib/pipeline';
import { logIngest } from '@/lib/ingest-log';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Accept either raw JSON or JSON wrapped in markdown code blocks
    let data: ResearchInput;
    if (typeof body === 'string') {
      const cleaned = body
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();
      data = JSON.parse(cleaned);
    } else {
      data = body;
    }

    // Validate minimum required fields
    if (!data.topic) {
      return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400 });
    }

    // Save raw input to disk BEFORE processing
    const logPath = logIngest('research', data);

    const result = await ingestResearch(data);

    return NextResponse.json({ ...result, logFile: logPath }, { status: result.success ? 200 : 207 });
  } catch (e: any) {
    console.error('Ingest error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
