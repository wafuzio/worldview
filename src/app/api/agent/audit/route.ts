export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { runAudit, type AuditConfig } from '@/lib/audit-agent';

let auditInProgress = false;

// POST /api/agent/audit — run an audit pass
export async function POST(req: NextRequest) {
  if (auditInProgress) {
    return NextResponse.json(
      { error: 'An audit is already in progress.' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));

  const config: AuditConfig = {
    mode: body.mode || 'full',
    minScore: body.minScore ?? 40,
    maxRequeue: body.maxRequeue ?? 10,
    dryRun: body.dryRun ?? false,
  };

  auditInProgress = true;

  try {
    const result = await runAudit(config);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Audit failed' },
      { status: 500 },
    );
  } finally {
    auditInProgress = false;
  }
}

// GET /api/agent/audit — get latest audit results
export async function GET() {
  try {
    const latestRun = await (await import('@/lib/db')).prisma.agentRun.findFirst({
      where: { runType: 'audit' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestRun) {
      return NextResponse.json({ message: 'No audit runs found' }, { status: 404 });
    }

    return NextResponse.json({
      id: latestRun.id,
      status: latestRun.status,
      createdAt: latestRun.createdAt,
      completedAt: latestRun.completedAt,
      nodesRequeued: latestRun.topicsDiscovered,
      log: latestRun.log ? JSON.parse(latestRun.log as string) : [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
