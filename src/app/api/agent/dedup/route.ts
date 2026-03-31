export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { callLLM, parseJSONResponse } from '@/lib/llm';

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    // Strip parenthetical qualifiers like "(politician)", "(organization)", etc.
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(
      /\b(the|of|and|for|to|in|on|at|by|corp|corporation|inc|incorporated|co|company|ltd|llc|plc)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeForMatch(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeForMatch(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / Math.max(ta.size, tb.size);
}

// Returns true if all tokens of the shorter name appear in the longer name.
// Catches "Clarence Thomas" inside "Justice Clarence Thomas".
function isContained(a: string, b: string): boolean {
  const ta = normalizeForMatch(a).split(' ').filter(Boolean);
  const tb = new Set(normalizeForMatch(b).split(' ').filter(Boolean));
  if (ta.length === 0) return false;
  return ta.every((t) => tb.has(t));
}

// Find candidate duplicate pairs using fuzzy name matching + containment check.
function findCandidatePairs(
  actors: { id: string; name: string; type: string; description: string | null }[],
  threshold = 0.6,
): Array<{ a: (typeof actors)[0]; b: (typeof actors)[0]; score: number }> {
  const pairs: Array<{ a: (typeof actors)[0]; b: (typeof actors)[0]; score: number }> = [];
  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const score = tokenSimilarity(actors[i].name, actors[j].name);
      const contained = isContained(actors[i].name, actors[j].name) || isContained(actors[j].name, actors[i].name);
      if (score >= threshold || contained) {
        pairs.push({ a: actors[i], b: actors[j], score: Math.max(score, contained ? 0.8 : 0) });
      }
    }
  }
  return pairs;
}

// Merge actor `dropId` into `keepId`:
// - reassign all relationships, handling unique-constraint conflicts
// - merge aliases + tags
// - delete the drop node
async function mergeActors(keepId: string, dropId: string): Promise<{ merged: number; conflictsResolved: number }> {
  let merged = 0;
  let conflictsResolved = 0;

  // Fetch canonical node's current aliases + tags
  const keepRows = await prisma.$queryRawUnsafe<Array<{ aliases: string | null; tags: string | null }>>(
    `SELECT aliases, tags FROM Politician WHERE id = ? LIMIT 1`,
    keepId,
  );
  const dropRows = await prisma.$queryRawUnsafe<Array<{ aliases: string | null; tags: string | null; name: string }>>(
    `SELECT aliases, tags, name FROM Politician WHERE id = ? LIMIT 1`,
    dropId,
  );
  if (!dropRows?.length) return { merged: 0, conflictsResolved: 0 };

  // Merge aliases
  const keepAliases: string[] = keepRows?.[0]?.aliases ? JSON.parse(keepRows[0].aliases) : [];
  const dropAliases: string[] = dropRows[0]?.aliases ? JSON.parse(dropRows[0].aliases) : [];
  const mergedAliases = Array.from(new Set([...keepAliases, dropRows[0].name, ...dropAliases]));
  await prisma.$executeRawUnsafe(
    `UPDATE Politician SET aliases = ? WHERE id = ?`,
    JSON.stringify(mergedAliases),
    keepId,
  );

  // Merge tags
  const keepTags: string[] = keepRows?.[0]?.tags ? JSON.parse(keepRows[0].tags) : [];
  const dropTags: string[] = dropRows[0]?.tags ? JSON.parse(dropRows[0].tags) : [];
  const mergedTags = Array.from(new Set([...keepTags, ...dropTags]));
  if (mergedTags.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE Politician SET tags = ? WHERE id = ?`,
      JSON.stringify(mergedTags),
      keepId,
    );
  }

  // Fetch all relationships belonging to the drop node
  const dropRels = await prisma.actorRelationship.findMany({
    where: { OR: [{ sourceId: dropId }, { targetId: dropId }] },
    include: { evidence: true },
  });

  for (const rel of dropRels) {
    const newSourceId = rel.sourceId === dropId ? keepId : rel.sourceId;
    const newTargetId = rel.targetId === dropId ? keepId : rel.targetId;

    // Skip self-loops that would result from merging (e.g. keepId → keepId)
    if (newSourceId === newTargetId) {
      await prisma.actorRelationship.delete({ where: { id: rel.id } });
      conflictsResolved++;
      continue;
    }

    // Check for unique-constraint conflict on the canonical node
    const conflict = await prisma.actorRelationship.findFirst({
      where: {
        sourceId: newSourceId,
        targetId: newTargetId,
        relationshipType: rel.relationshipType,
        startDate: rel.startDate,
      },
    });

    if (conflict) {
      // Migrate evidence links to the surviving relationship, then drop the duplicate
      if (rel.evidence.length > 0) {
        for (const ev of rel.evidence) {
          try {
            await prisma.actorRelationshipEvidence.create({
              data: { relationshipId: conflict.id, evidenceId: ev.evidenceId },
            });
          } catch {
            // Evidence link already exists — skip
          }
        }
      }
      await prisma.actorRelationship.delete({ where: { id: rel.id } });
      conflictsResolved++;
    } else {
      await prisma.actorRelationship.update({
        where: { id: rel.id },
        data: { sourceId: newSourceId, targetId: newTargetId },
      });
      merged++;
    }
  }

  // Also reassign political actions
  await prisma.$executeRawUnsafe(
    `UPDATE PoliticalAction SET actorId = ? WHERE actorId = ?`,
    keepId,
    dropId,
  );

  // Delete the duplicate node (cascades remaining evidence links)
  await prisma.politician.delete({ where: { id: dropId } });

  return { merged, conflictsResolved };
}

// ── Route handlers ────────────────────────────────────────────────────────────

// POST /api/agent/dedup  { action: 'scan' }
//   → returns LLM-judged duplicate candidates for review
// POST /api/agent/dedup  { action: 'merge', pairs: [{keepId, dropId}] }
//   → executes the merges and returns results

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || 'scan');

  // ── MERGE ────────────────────────────────────────────────────────────────
  if (action === 'merge') {
    const pairs: Array<{ keepId: string; dropId: string }> = Array.isArray(body?.pairs) ? body.pairs : [];
    if (pairs.length === 0) return NextResponse.json({ error: 'No pairs provided' }, { status: 400 });

    const results: Array<{ keepId: string; dropId: string; status: string; error?: string }> = [];
    for (const { keepId, dropId } of pairs) {
      try {
        const { merged, conflictsResolved } = await mergeActors(keepId, dropId);
        results.push({ keepId, dropId, status: 'merged', merged, conflictsResolved } as any);
      } catch (e: any) {
        results.push({ keepId, dropId, status: 'error', error: e.message });
      }
    }
    return NextResponse.json({ results, merged: results.filter((r) => r.status === 'merged').length });
  }

  // ── SCAN ─────────────────────────────────────────────────────────────────
  const actors = await prisma.politician.findMany({
    select: { id: true, name: true, type: true, description: true },
    orderBy: { name: 'asc' },
  });

  const candidates = findCandidatePairs(actors as any, 0.75);

  if (candidates.length === 0) {
    return NextResponse.json({ candidates: [], message: 'No duplicate candidates found.' });
  }

  // Batch LLM calls — 30 pairs per call to stay within token limits
  const BATCH = 30;
  const allDecisions: any[] = [];

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchInput = batch.map((p, idx) => ({
      id: `p${i + idx}`,
      nameA: p.a.name,
      typeA: p.a.type,
      descriptionA: p.a.description?.slice(0, 120) ?? null,
      nameB: p.b.name,
      typeB: p.b.type,
      descriptionB: p.b.description?.slice(0, 120) ?? null,
      similarityScore: Math.round(p.score * 100) / 100,
    }));

    try {
      const response = await callLLM(
        [
          {
            role: 'system',
            content: `You are a deduplication analyst for a political knowledge graph.
For each candidate pair, decide if nameA and nameB refer to the SAME real-world entity.
Common duplicates: "(politician)" or "(organization)" appended, slight spelling variants, abbreviations, full vs. short names.

Return a JSON array only:
[
  {
    "id": "p0",
    "isSameEntity": true,
    "keepName": "the preferred canonical name (usually the cleaner/shorter one)",
    "confidence": "high|medium|low",
    "reason": "one sentence"
  }
]`,
          },
          {
            role: 'user',
            content: JSON.stringify(batchInput, null, 2),
          },
        ],
        { temperature: 0.1 },
      );

      const parsed = parseJSONResponse(response.content);
      if (Array.isArray(parsed)) {
        for (const decision of parsed) {
          const idx = parseInt(String(decision.id ?? '').replace('p', ''), 10);
          const pair = candidates[idx];
          if (!pair) continue;
          allDecisions.push({
            isSameEntity: Boolean(decision.isSameEntity),
            keepName: String(decision.keepName || pair.a.name),
            confidence: String(decision.confidence || 'low'),
            reason: String(decision.reason || ''),
            nodeA: { id: pair.a.id, name: pair.a.name, type: pair.a.type },
            nodeB: { id: pair.b.id, name: pair.b.name, type: pair.b.type },
            score: pair.score,
          });
        }
      }
    } catch (e: any) {
      // On LLM failure, include candidates without a decision so UI can still show them
      for (const pair of batch) {
        allDecisions.push({
          isSameEntity: null,
          keepName: null,
          confidence: 'unknown',
          reason: `LLM error: ${e.message}`,
          nodeA: { id: pair.a.id, name: pair.a.name, type: pair.a.type },
          nodeB: { id: pair.b.id, name: pair.b.name, type: pair.b.type },
          score: pair.score,
        });
      }
    }
  }

  const duplicates = allDecisions.filter((d) => d.isSameEntity === true);
  const uncertain = allDecisions.filter((d) => d.isSameEntity === null);
  const notDuplicates = allDecisions.filter((d) => d.isSameEntity === false);

  return NextResponse.json({
    totalCandidates: candidates.length,
    duplicates,
    uncertain,
    notDuplicatesCount: notDuplicates.length,
  });
}
