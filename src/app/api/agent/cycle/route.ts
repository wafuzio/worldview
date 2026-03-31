export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { runCyclePhase, getCycleStatus, type CycleConfig } from '@/lib/quality-cycle';

// POST /api/agent/cycle — run one phase of the quality cycle
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const config: CycleConfig = {
    editorialBatchSize: body.editorialBatchSize ?? 8,
    auditMinScore: body.auditMinScore ?? 40,
    researchMaxTopics: body.researchMaxTopics ?? 5,
    discoveryMaxTopics: body.discoveryMaxTopics ?? 5,
  };

  try {
    const result = await runCyclePhase(config);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Cycle phase failed' },
      { status: 500 },
    );
  }
}

// GET /api/agent/cycle — get cycle status and recent history
export async function GET() {
  try {
    const status = await getCycleStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
