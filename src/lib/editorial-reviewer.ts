// ============================================================
// EDITORIAL REVIEWER
//
// The "journalist" pass. Unlike the audit agent (which scores
// fields and checks types), this agent reads each node's full
// picture — description, relationships, evidence — and asks:
//
//   "If a knowledgeable reporter looked at this entry,
//    would they trust it, or would they call it lazy?"
//
// It produces freeform critiques and concrete correction
// proposals, then either auto-applies safe fixes or queues
// re-research for anything that needs deeper work.
//
// Designed to process a batch of nodes per run, cycling
// through the entire database over multiple invocations.
// ============================================================

import { prisma } from './db';
import { callLLM, parseJSONResponse } from './llm';

export type ReviewConfig = {
  batchSize?: number;     // How many nodes to review per run (default 8)
  maxRequeue?: number;    // Max items to add to research queue (default 5)
  dryRun?: boolean;
};

export type NodeReview = {
  actorId: string;
  actorName: string;
  actorType: string;
  verdict: 'acceptable' | 'needs_work' | 'embarrassing';
  critique: string;
  corrections: {
    field: string;
    current: string;
    proposed: string;
    confidence: 'high' | 'medium';
    reason: string;
  }[];
  researchNeeded: string | null;  // null = no re-research, string = topic to queue
};

export type ReviewResult = {
  runId: string;
  nodesReviewed: number;
  acceptable: number;
  needsWork: number;
  embarrassing: number;
  correctionsApplied: number;
  requeued: number;
  reviews: NodeReview[];
  log: string[];
};

// Track which nodes we've reviewed recently so the cycle doesn't
// keep hitting the same ones. Stores actor IDs reviewed in last N runs.
// In production this would be a DB column; for now, in-memory is fine
// since the background cycle is a single long-lived process.
const recentlyReviewed = new Set<string>();

export async function runEditorialReview(config: ReviewConfig = {}): Promise<ReviewResult> {
  const batchSize = config.batchSize ?? 8;
  const maxRequeue = config.maxRequeue ?? 5;
  const dryRun = config.dryRun ?? false;
  const log: string[] = [];

  const addLog = (msg: string) => {
    log.push(`[editorial] ${msg}`);
    console.log(`[editorial] ${msg}`);
  };

  const run = await prisma.agentRun.create({
    data: {
      runType: 'editorial_review',
      status: 'running',
      maxTopics: batchSize,
    },
  });

  addLog(`Editorial review started: ${run.id} (batch: ${batchSize}, dryRun: ${dryRun})`);

  const reviews: NodeReview[] = [];
  let correctionsApplied = 0;
  let requeued = 0;

  try {
    // ── Pick nodes to review ──
    // Prioritize: never-reviewed > least-recently-updated > most-connected
    // Skip anything we reviewed in recent runs
    const actors = await prisma.politician.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        title: true,
        affiliation: true,
        imageUrl: true,
        updatedAt: true,
        relationshipsFrom: {
          include: {
            target: { select: { name: true, type: true } },
            evidence: { include: { evidence: { select: { title: true, sourceUrl: true } } } },
          },
        },
        relationshipsTo: {
          include: {
            source: { select: { name: true, type: true } },
            evidence: { include: { evidence: { select: { title: true, sourceUrl: true } } } },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: batchSize * 3, // Fetch extra to filter out recently reviewed
    });

    // Filter out recently reviewed, take batchSize
    const batch = actors
      .filter((a) => !recentlyReviewed.has(a.id))
      .slice(0, batchSize);

    if (batch.length === 0) {
      // All nodes recently reviewed — clear the set and start over
      recentlyReviewed.clear();
      addLog('All nodes recently reviewed. Reset cycle — will pick fresh batch next run.');
      await completeRun(run.id, 0, log);
      return { runId: run.id, nodesReviewed: 0, acceptable: 0, needsWork: 0, embarrassing: 0, correctionsApplied: 0, requeued: 0, reviews: [], log };
    }

    addLog(`Selected ${batch.length} nodes for review`);

    // ── Review each node ──
    for (const actor of batch) {
      try {
        const review = await reviewSingleNode(actor, addLog);
        reviews.push(review);
        recentlyReviewed.add(actor.id);

        // Apply safe corrections
        if (!dryRun && review.corrections.length > 0) {
          const applied = await applyCorrections(actor.id, review.corrections, addLog);
          correctionsApplied += applied;
        }

        // Queue re-research if needed
        if (!dryRun && review.researchNeeded && requeued < maxRequeue) {
          const existing = await prisma.researchQueue.findFirst({
            where: {
              topic: { contains: review.researchNeeded.substring(0, 50) },
              status: { in: ['pending', 'processing'] },
            },
          });

          if (!existing) {
            await prisma.researchQueue.create({
              data: {
                topic: review.researchNeeded,
                rationale: `Editorial review: ${review.critique.substring(0, 200)}`,
                priority: review.verdict === 'embarrassing' ? 'high' : 'medium',
                source: 'editorial_review',
                sourceRunId: run.id,
              },
            });
            requeued++;
            addLog(`Queued re-research for ${actor.name}: "${review.researchNeeded.substring(0, 80)}"`);
          }
        }
      } catch (err: any) {
        addLog(`Failed to review ${actor.name}: ${err.message}`);
      }
    }

    const acceptable = reviews.filter((r) => r.verdict === 'acceptable').length;
    const needsWork = reviews.filter((r) => r.verdict === 'needs_work').length;
    const embarrassing = reviews.filter((r) => r.verdict === 'embarrassing').length;

    addLog(`Review complete: ${acceptable} acceptable, ${needsWork} needs work, ${embarrassing} embarrassing. ${correctionsApplied} corrections applied, ${requeued} re-research queued.`);

    await completeRun(run.id, requeued, log);

    return { runId: run.id, nodesReviewed: reviews.length, acceptable, needsWork, embarrassing, correctionsApplied, requeued, reviews, log };

  } catch (err: any) {
    addLog(`Editorial review failed: ${err.message}`);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date(), log: JSON.stringify(log) },
    });
    return { runId: run.id, nodesReviewed: reviews.length, acceptable: 0, needsWork: 0, embarrassing: 0, correctionsApplied, requeued, reviews, log };
  }
}

// ── Review a single node ──

async function reviewSingleNode(
  actor: any,
  addLog: (msg: string) => void,
): Promise<NodeReview> {
  // Build a full picture of this node for the LLM
  const outbound = (actor.relationshipsFrom || []).map((r: any) => {
    const evTitles = (r.evidence || []).map((e: any) => e.evidence?.title).filter(Boolean);
    return `→ ${r.relationshipType} ${r.target.name} (${r.target.type})${r.description ? `: ${r.description}` : ''}${r.amount ? ` [$${Number(r.amount).toLocaleString()}]` : ''}${r.significance ? ` [sig ${r.significance}/5]` : ''}${evTitles.length ? ` [sources: ${evTitles.join(', ')}]` : ' [NO SOURCE]'}`;
  });

  const inbound = (actor.relationshipsTo || []).map((r: any) => {
    const evTitles = (r.evidence || []).map((e: any) => e.evidence?.title).filter(Boolean);
    return `← ${r.source.name} (${r.source.type}) ${r.relationshipType}${r.description ? `: ${r.description}` : ''}${r.amount ? ` [$${Number(r.amount).toLocaleString()}]` : ''}${r.significance ? ` [sig ${r.significance}/5]` : ''}${evTitles.length ? ` [sources: ${evTitles.join(', ')}]` : ' [NO SOURCE]'}`;
  });

  const totalConnections = outbound.length + inbound.length;
  const sourcedConnections = [...(actor.relationshipsFrom || []), ...(actor.relationshipsTo || [])]
    .filter((r: any) => (r.evidence || []).length > 0).length;

  const nodeProfile = `NAME: ${actor.name}
TYPE: ${actor.type}
TITLE: ${actor.title || '(none)'}
AFFILIATION: ${actor.affiliation || '(none)'}
DESCRIPTION: ${actor.description || '(none)'}
IMAGE: ${actor.imageUrl ? 'yes' : 'no'}
CONNECTIONS: ${totalConnections} total, ${sourcedConnections} with sources

OUTBOUND RELATIONSHIPS:
${outbound.length > 0 ? outbound.join('\n') : '(none)'}

INBOUND RELATIONSHIPS:
${inbound.length > 0 ? inbound.join('\n') : '(none)'}`;

  const response = await callLLM([
    {
      role: 'system',
      content: `You are an editorial reviewer for a political evidence database. You are reviewing a single node (actor) and all its relationships.

Read this entry the way a knowledgeable political journalist would. Ask yourself:
- Is the type classification correct? (politician vs donor vs operative vs lobbyist vs media_figure)
- Are the relationship DIRECTIONS correct? (who gave to whom, who appointed whom)
- Are there obvious factual errors? (dates, amounts, descriptions that contradict reality)
- Is important context missing that makes this entry misleading by omission?
- Are financial relationships missing dollar amounts or election cycles?
- Does the description actually tell you something useful, or is it a placeholder?
- Would a reader come away with an accurate understanding of this actor's role?

Return a JSON object:
{
  "verdict": "acceptable|needs_work|embarrassing",
  "critique": "2-4 sentence plain-language assessment. Be specific and direct — name what's wrong.",
  "corrections": [
    {
      "field": "type|description|title|affiliation|relationship_direction|relationship_missing",
      "current": "what it says now (or 'missing')",
      "proposed": "what it should say",
      "confidence": "high|medium",
      "reason": "why"
    }
  ],
  "researchNeeded": "null OR a specific re-research topic string if deeper investigation is needed to fix this entry"
}

Rules:
- "acceptable" = a journalist wouldn't object. Doesn't have to be perfect.
- "needs_work" = has real issues but not actively misleading.
- "embarrassing" = factually wrong, directionally reversed, or so incomplete it's misleading.
- Only include corrections where confidence is "high". Medium-confidence corrections should go into researchNeeded instead.
- For researchNeeded: be SPECIFIC. "Re-research Democracy PAC II: verify FEC filings for C00786624, correct donor/recipient direction, add recipient PACs with amounts by cycle" is good. "Look into this more" is useless.
- Return ONLY the JSON object.`,
    },
    {
      role: 'user',
      content: nodeProfile,
    },
  ], { temperature: 0.2 });

  if (!response.content) {
    return {
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type,
      verdict: 'needs_work',
      critique: 'LLM review failed — no response',
      corrections: [],
      researchNeeded: null,
    };
  }

  const parsed = parseJSONResponse(response.content);
  if (!parsed || typeof parsed !== 'object') {
    addLog(`Review of ${actor.name}: unparseable LLM response`);
    return {
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type,
      verdict: 'needs_work',
      critique: 'LLM response could not be parsed',
      corrections: [],
      researchNeeded: null,
    };
  }

  const verdict = ['acceptable', 'needs_work', 'embarrassing'].includes(parsed.verdict)
    ? parsed.verdict : 'needs_work';

  addLog(`${actor.name}: ${verdict}${parsed.critique ? ` — ${String(parsed.critique).substring(0, 120)}` : ''}`);

  return {
    actorId: actor.id,
    actorName: actor.name,
    actorType: actor.type,
    verdict,
    critique: String(parsed.critique || ''),
    corrections: Array.isArray(parsed.corrections)
      ? parsed.corrections
          .filter((c: any) => c?.confidence === 'high' && c?.field && c?.proposed)
          .map((c: any) => ({
            field: String(c.field),
            current: String(c.current || ''),
            proposed: String(c.proposed),
            confidence: c.confidence as 'high' | 'medium',
            reason: String(c.reason || ''),
          }))
      : [],
    researchNeeded: parsed.researchNeeded && parsed.researchNeeded !== 'null'
      ? String(parsed.researchNeeded) : null,
  };
}

// ── Apply high-confidence corrections directly ──

async function applyCorrections(
  actorId: string,
  corrections: NodeReview['corrections'],
  addLog: (msg: string) => void,
): Promise<number> {
  let applied = 0;

  for (const correction of corrections) {
    if (correction.confidence !== 'high') continue;

    try {
      switch (correction.field) {
        case 'type': {
          const validTypes = ['politician', 'donor', 'operative', 'lobbyist', 'media_figure', 'pac', 'corporation', 'organization', 'party'];
          if (validTypes.includes(correction.proposed)) {
            await prisma.politician.update({
              where: { id: actorId },
              data: { type: correction.proposed },
            });
            applied++;
            addLog(`  FIXED type → "${correction.proposed}" (${correction.reason})`);
          }
          break;
        }
        case 'description': {
          if (correction.proposed.length > 10) {
            await prisma.politician.update({
              where: { id: actorId },
              data: { description: correction.proposed },
            });
            applied++;
            addLog(`  FIXED description (${correction.reason})`);
          }
          break;
        }
        case 'title': {
          await prisma.politician.update({
            where: { id: actorId },
            data: { title: correction.proposed },
          });
          applied++;
          addLog(`  FIXED title → "${correction.proposed}"`);
          break;
        }
        case 'affiliation': {
          await prisma.politician.update({
            where: { id: actorId },
            data: { affiliation: correction.proposed },
          });
          applied++;
          addLog(`  FIXED affiliation → "${correction.proposed}"`);
          break;
        }
        // relationship_direction and relationship_missing go to re-research,
        // not auto-applied — too risky for automated correction
        default:
          break;
      }
    } catch (err: any) {
      addLog(`  Failed to apply ${correction.field} correction: ${err.message}`);
    }
  }

  return applied;
}

async function completeRun(runId: string, topicsDiscovered: number, log: string[]) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      topicsDiscovered,
      log: JSON.stringify(log),
    },
  });
}
