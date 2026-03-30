// POST /api/ingest/manual
// Accepts a single evidence item for manual upload.
// Raw input saved to /data/research-logs/manual/ before processing.
import { NextRequest, NextResponse } from 'next/server';
import { createManualEvidence, ManualEvidenceInput } from '@/lib/pipeline';
import { logIngest } from '@/lib/ingest-log';

export async function POST(req: NextRequest) {
  try {
    const data: ManualEvidenceInput = await req.json();

    if (!data.title || !data.summary) {
      return NextResponse.json(
        { error: 'Missing required fields: title and summary' },
        { status: 400 }
      );
    }

    // Save raw input to disk BEFORE processing
    logIngest('manual', data);

    const result = await createManualEvidence(data);
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('Manual ingest error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
