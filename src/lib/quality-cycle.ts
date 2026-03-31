// ============================================================
// QUALITY CYCLE ORCHESTRATOR
//
// The background loop that continuously improves data quality.
// Cycles through phases:
//
//   1. EDITORIAL REVIEW  — Journalist-style critique of a batch of nodes
//   2. AUDIT             — Structural checks (types, directions, completeness)
//   3. RESEARCH          — Process the re-research queue items that
//                          phases 1 & 2 generated
//   4. DISCOVERY         — Find new topics to expand the graph
//
// Each invocation runs ONE phase, then returns. The scheduler
// calls this on an interval, so it progresses through phases
// automatically. State is tracked in the database via AgentRun.
//
// Designed to be non-destructive and resumable — if a phase
// fails, the next invocation retries or moves on.
// ============================================================

import { prisma } from './db';
import { runEditorialReview } from './editorial-reviewer';
import { runAudit } from './audit-agent';
import { runResearchAgent } from './research-agent';
import { runDiscovery } from './discovery-agent';

export type CyclePhase = 'editorial_review' | 'audit' | 'research' | 'discovery';

const PHASE_ORDER: CyclePhase[] = ['editorial_review', 'audit', 'research', 'discovery'];

export type CycleConfig = {
  editorialBatchSize?: number;
  auditMinScore?: number;
  researchMaxTopics?: number;
  discoveryMaxTopics?: number;
};

export type CycleResult = {
  phase: CyclePhase;
  success: boolean;
  summary: string;
  nextPhase: CyclePhase;
  stats: Record<string, number>;
};

// ── Determine which phase to run next ──

async function getNextPhase(): Promise<CyclePhase> {
  // Look at the most recent quality-cycle run to decide what's next
  const lastRun = await prisma.agentRun.findFirst({
    where: {
      runType: { in: PHASE_ORDER.map((p) => `cycle:${p}`) },
    },
    orderBy: { createdAt: 'desc' },
    select: { runType: true, status: true, createdAt: true },
  });

  if (!lastRun) return 'editorial_review'; // First ever run

  const lastPhase = lastRun.runType.replace('cycle:', '') as CyclePhase;
  const lastIndex = PHASE_ORDER.indexOf(lastPhase);

  // If last run failed, retry it (but only once — if it failed twice, skip)
  if (lastRun.status === 'failed') {
    const prevFailed = await prisma.agentRun.count({
      where: {
        runType: `cycle:${lastPhase}`,
        status: 'failed',
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // last 2 hours
      },
    });
    if (prevFailed < 2) return lastPhase; // Retry
  }

  // Move to next phase
  return PHASE_ORDER[(lastIndex + 1) % PHASE_ORDER.length];
}

// ── Run one cycle phase ──

export async function runCyclePhase(config: CycleConfig = {}): Promise<CycleResult> {
  const phase = await getNextPhase();

  console.log(`[quality-cycle] Starting phase: ${phase}`);

  // Check if anything is currently running (prevent overlap)
  const running = await prisma.agentRun.findFirst({
    where: {
      status: 'running',
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // within last 30 min
    },
  });

  if (running) {
    console.log(`[quality-cycle] Skipping — another run is in progress: ${running.id} (${running.runType})`);
    return {
      phase,
      success: false,
      summary: `Skipped: another run is in progress (${running.runType})`,
      nextPhase: phase,
      stats: {},
    };
  }

  // Mark this cycle phase
  const cycleRun = await prisma.agentRun.create({
    data: {
      runType: `cycle:${phase}`,
      status: 'running',
    },
  });

  try {
    let summary: string;
    let stats: Record<string, number> = {};

    switch (phase) {
      case 'editorial_review': {
        const result = await runEditorialReview({
          batchSize: config.editorialBatchSize ?? 8,
          maxRequeue: 5,
        });
        summary = `Reviewed ${result.nodesReviewed} nodes: ${result.acceptable} ok, ${result.needsWork} needs work, ${result.embarrassing} embarrassing. ${result.correctionsApplied} auto-fixed, ${result.requeued} queued.`;
        stats = {
          reviewed: result.nodesReviewed,
          acceptable: result.acceptable,
          needsWork: result.needsWork,
          embarrassing: result.embarrassing,
          corrected: result.correctionsApplied,
          requeued: result.requeued,
        };
        break;
      }

      case 'audit': {
        const result = await runAudit({
          mode: 'full',
          minScore: config.auditMinScore ?? 40,
          maxRequeue: 10,
        });
        summary = `Audited ${result.nodesScanned} nodes, ${result.issuesFound} issues, ${result.nodesRequeued} queued for re-research.`;
        stats = {
          scanned: result.nodesScanned,
          issues: result.issuesFound,
          requeued: result.nodesRequeued,
        };
        break;
      }

      case 'research': {
        // Check if there's actually anything in the queue
        const pendingCount = await prisma.researchQueue.count({
          where: { status: 'pending' },
        });

        if (pendingCount === 0) {
          summary = 'Research queue empty — nothing to process.';
          stats = { pending: 0 };
          break;
        }

        const result = await runResearchAgent({
          maxTopics: config.researchMaxTopics ?? 5,
          depth: 'standard',
          autoQueue: true,
          runType: 'cycle',
        });
        summary = `Processed ${result.topicsProcessed} topics: ${result.topicsSucceeded} succeeded, ${result.topicsFailed} failed. +${result.totalEvidence} evidence, +${result.totalEntities} entities.`;
        stats = {
          processed: result.topicsProcessed,
          succeeded: result.topicsSucceeded,
          failed: result.topicsFailed,
          evidence: result.totalEvidence,
          entities: result.totalEntities,
        };
        break;
      }

      case 'discovery': {
        const result = await runDiscovery({
          mode: 'all',
          maxTopics: config.discoveryMaxTopics ?? 5,
        });
        summary = `Discovered ${result.topicsDiscovered} topics, queued ${result.topicsQueued}.`;
        stats = {
          discovered: result.topicsDiscovered,
          queued: result.topicsQueued,
        };
        break;
      }
    }

    // Mark complete
    await prisma.agentRun.update({
      where: { id: cycleRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        log: JSON.stringify({ phase, summary, stats }),
      },
    });

    const nextPhase = PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length];

    console.log(`[quality-cycle] Phase ${phase} complete: ${summary}`);

    return { phase, success: true, summary, nextPhase, stats };

  } catch (err: any) {
    console.error(`[quality-cycle] Phase ${phase} failed:`, err.message);

    await prisma.agentRun.update({
      where: { id: cycleRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        log: JSON.stringify({ phase, error: err.message }),
      },
    });

    const nextPhase = PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length];

    return {
      phase,
      success: false,
      summary: `Failed: ${err.message}`,
      nextPhase,
      stats: {},
    };
  }
}

// ── Get cycle status ──

export async function getCycleStatus(): Promise<{
  recentPhases: { phase: string; status: string; time: Date; summary: string }[];
  queueDepth: number;
  nextPhase: CyclePhase;
}> {
  const recentRuns = await prisma.agentRun.findMany({
    where: {
      runType: { startsWith: 'cycle:' },
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { runType: true, status: true, createdAt: true, log: true },
  });

  const recentPhases = recentRuns.map((r) => {
    let summary = '';
    try {
      const parsed = JSON.parse(r.log as string || '{}');
      summary = parsed.summary || parsed.error || '';
    } catch { /* ignore */ }
    return {
      phase: r.runType.replace('cycle:', ''),
      status: r.status,
      time: r.createdAt,
      summary,
    };
  });

  const queueDepth = await prisma.researchQueue.count({
    where: { status: 'pending' },
  });

  const nextPhase = await getNextPhase();

  return { recentPhases, queueDepth, nextPhase };
}
