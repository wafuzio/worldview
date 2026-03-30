import { prisma } from '../src/lib/db';
import { callLLM, parseJSONResponse } from '../src/lib/llm';

type Decision = {
  originalName: string;
  canonicalName?: string;
  canonicalType?: string;
  mergeWithExistingName?: string | null;
  drop?: boolean;
  reason?: string;
};

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?]/g, ' ')
    .replace(/\b(the|of|and|for|to|in|on|at|by)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNoYear(value: string): string {
  return normalizeForMatch(value).replace(/\b(17|18|19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeForMatch(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeForMatch(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let intersection = 0;
  Array.from(ta).forEach((t) => {
    if (tb.has(t)) intersection++;
  });
  return intersection / Math.max(ta.size, tb.size);
}

function mapType(type?: string): string {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return 'politician';
  if (['person', 'politician'].includes(t)) return 'politician';
  if (['organization', 'org', 'institution'].includes(t)) return 'organization';
  if (['legislation', 'law', 'act', 'bill', 'statute'].includes(t)) return 'legislation';
  if (['court_case', 'case', 'legal_case'].includes(t)) return 'court_case';
  if (['party', 'pac', 'corporation', 'lobbyist', 'media_figure'].includes(t)) return t;
  if (t.includes('act') || t.includes('bill') || t.includes('statute') || t.includes('amendment')) return 'legislation';
  if (t.includes('court') || t.includes('v.')) return 'court_case';
  return t;
}

function inferTypeFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\bv\.\b|\bvs\.\b|\bversus\b|\bcourt\b/.test(n)) return 'court_case';
  if (/\b(act|bill|statute|code|amendment)\b/.test(n)) return 'legislation';
  if (/\b(political action committee|pac)\b/.test(n)) return 'pac';
  if (/\b(party)\b/.test(n)) return 'party';
  if (/\b(committee|association|institute|department|agency|union|coalition|council|commission|corporation|inc|llc|company)\b/.test(n)) return 'organization';
  return 'politician';
}

function isBroadBucketName(name: string): boolean {
  const n = normalizeForMatch(name);
  return (
    /^federal candidates$/.test(n) ||
    /^federal candidates committees$/.test(n) ||
    /^federal candidates and committees$/.test(n) ||
    /^candidates committees$/.test(n)
  );
}

async function getDecisions(names: string[], existing: { name: string; type: string }[]): Promise<Decision[]> {
  try {
    const response = await callLLM([
      {
        role: 'system',
        content: `You are a node-canonicalization analyst for a political knowledge graph.
Return JSON array only:
[
  {
    "originalName":"...",
    "canonicalName":"...",
    "canonicalType":"politician|organization|legislation|court_case|party|pac|corporation|lobbyist|media_figure|concept",
    "mergeWithExistingName":"exact existing name if duplicate else null",
    "drop": false,
    "reason":"short reason"
  }
]
Rules:
- Merge variants of same entity.
- Do not classify laws/cases as politician.
- Mark broad bucket categories as drop=true, canonicalType=concept.`,
      },
      {
        role: 'user',
        content: `Names to normalize:\n${names.map((n) => `- ${n}`).join('\n')}

Existing nodes:
${existing.map((e) => `- ${e.name} (${e.type})`).join('\n')}`,
      },
    ], { temperature: 0.1 });

    const parsed = parseJSONResponse(response.content);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x: any) => ({
      originalName: String(x?.originalName || ''),
      canonicalName: x?.canonicalName ? String(x.canonicalName) : undefined,
      canonicalType: x?.canonicalType ? String(x.canonicalType) : undefined,
      mergeWithExistingName: x?.mergeWithExistingName ? String(x.mergeWithExistingName) : null,
      drop: Boolean(x?.drop),
      reason: x?.reason ? String(x.reason) : undefined,
    })).filter((d: Decision) => d.originalName);
  } catch {
    return [];
  }
}

async function safeMovePoliticianEvidence(fromId: string, toId: string) {
  const rows = await prisma.politicianEvidence.findMany({ where: { politicianId: fromId } });
  for (const row of rows) {
    const exists = await prisma.politicianEvidence.findFirst({
      where: { politicianId: toId, evidenceId: row.evidenceId },
    });
    if (!exists) {
      await prisma.politicianEvidence.create({
        data: {
          politicianId: toId,
          evidenceId: row.evidenceId,
          portrayal: row.portrayal,
          excerpt: row.excerpt || undefined,
        },
      });
    }
    await prisma.politicianEvidence.delete({
      where: { politicianId_evidenceId: { politicianId: row.politicianId, evidenceId: row.evidenceId } },
    });
  }
}

async function safeMovePoliticianStances(fromId: string, toId: string) {
  const rows = await prisma.politicianStance.findMany({ where: { politicianId: fromId } });
  for (const row of rows) {
    const exists = await prisma.politicianStance.findFirst({
      where: { politicianId: toId, questionId: row.questionId },
    });
    if (!exists) {
      await prisma.politicianStance.create({
        data: {
          politicianId: toId,
          questionId: row.questionId,
          publicStance: row.publicStance ?? undefined,
          actionStance: row.actionStance ?? undefined,
          publicSource: row.publicSource ?? undefined,
          actionSource: row.actionSource ?? undefined,
          discrepancyNote: row.discrepancyNote ?? undefined,
        },
      });
    }
    await prisma.politicianStance.delete({ where: { id: row.id } });
  }
}

async function mergeRelationship(relId: string, newSourceId: string, newTargetId: string) {
  const rel = await prisma.actorRelationship.findUnique({
    where: { id: relId },
    include: { evidence: true },
  });
  if (!rel) return;

  if (newSourceId === newTargetId) {
    await prisma.actorRelationship.delete({ where: { id: rel.id } });
    return;
  }

  const existing = await prisma.actorRelationship.findFirst({
    where: {
      sourceId: newSourceId,
      targetId: newTargetId,
      relationshipType: rel.relationshipType,
      startDate: rel.startDate,
    },
    include: { evidence: true },
  });

  if (existing && existing.id !== rel.id) {
    const mergedDescription = existing.description && rel.description
      ? `${existing.description} | ${rel.description}`
      : rel.description || existing.description;
    await prisma.actorRelationship.update({
      where: { id: existing.id },
      data: {
        description: mergedDescription,
        significance: Math.max(existing.significance, rel.significance),
        amount: rel.amount ?? existing.amount,
        endDate: rel.endDate ?? existing.endDate,
      },
    });

    for (const ev of rel.evidence) {
      const linkExists = await prisma.actorRelationshipEvidence.findFirst({
        where: { relationshipId: existing.id, evidenceId: ev.evidenceId },
      });
      if (!linkExists) {
        await prisma.actorRelationshipEvidence.create({
          data: { relationshipId: existing.id, evidenceId: ev.evidenceId, excerpt: ev.excerpt || undefined },
        });
      }
    }

    await prisma.actorRelationship.delete({ where: { id: rel.id } });
    return;
  }

  await prisma.actorRelationship.update({
    where: { id: rel.id },
    data: { sourceId: newSourceId, targetId: newTargetId },
  });
}

async function mergePolitician(fromId: string, toId: string) {
  if (fromId === toId) return;

  await safeMovePoliticianEvidence(fromId, toId);
  await safeMovePoliticianStances(fromId, toId);

  await prisma.statement.updateMany({ where: { politicianId: fromId }, data: { politicianId: toId } });
  await prisma.politicalAction.updateMany({ where: { politicianId: fromId }, data: { politicianId: toId } });
  await prisma.politicianPartyHistory.updateMany({ where: { politicianId: fromId }, data: { politicianId: toId } });

  const relationships = await prisma.actorRelationship.findMany({
    where: { OR: [{ sourceId: fromId }, { targetId: fromId }] },
    select: { id: true, sourceId: true, targetId: true },
  });

  for (const rel of relationships) {
    const newSourceId = rel.sourceId === fromId ? toId : rel.sourceId;
    const newTargetId = rel.targetId === fromId ? toId : rel.targetId;
    await mergeRelationship(rel.id, newSourceId, newTargetId);
  }

  await prisma.politician.delete({ where: { id: fromId } });
}

async function main() {
  const actors = await prisma.politician.findMany({
    select: { id: true, name: true, type: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const rels = await prisma.actorRelationship.findMany({
    select: { sourceId: true, targetId: true },
  });
  const connectionCount = new Map<string, number>();
  for (const r of rels) {
    connectionCount.set(r.sourceId, (connectionCount.get(r.sourceId) || 0) + 1);
    connectionCount.set(r.targetId, (connectionCount.get(r.targetId) || 0) + 1);
  }

  const names = actors.map((a) => a.name);
  const decisions = await getDecisions(names, actors.map((a) => ({ name: a.name, type: a.type })));
  const decisionByName = new Map(decisions.map((d) => [d.originalName.toLowerCase(), d]));

  let typeUpdated = 0;
  let deactivated = 0;
  let renamed = 0;
  let merged = 0;

  async function byName() {
    const rows = await prisma.politician.findMany({
      select: { id: true, name: true, type: true, isActive: true },
    });
    return new Map(rows.map((a) => [a.name.toLowerCase(), a]));
  }

  // First pass: type corrections and deactivation.
  for (const actor of actors) {
    const d = decisionByName.get(actor.name.toLowerCase());
    const inferredType = mapType(d?.canonicalType || inferTypeFromName(actor.name));
    const shouldDrop = Boolean(d?.drop) || isBroadBucketName(actor.name);

    const update: any = {};
    if (shouldDrop && actor.isActive) {
      update.isActive = false;
      deactivated++;
    }
    if (inferredType && actor.type !== inferredType) {
      update.type = inferredType;
      typeUpdated++;
    }

    if (Object.keys(update).length > 0) {
      await prisma.politician.update({ where: { id: actor.id }, data: update });
    }
  }

  // Second pass: explicit LLM merges + renames.
  let nameIndex = await byName();
  for (const actor of actors) {
    const current = nameIndex.get(actor.name.toLowerCase());
    if (!current) continue; // already merged

    const d = decisionByName.get(current.name.toLowerCase());
    if (!d || d.drop) continue;

    const targetName = d.mergeWithExistingName?.trim();
    if (targetName) {
      const target = nameIndex.get(targetName.toLowerCase());
      if (target && target.id !== current.id) {
        await mergePolitician(current.id, target.id);
        merged++;
        nameIndex = await byName();
        continue;
      }
    }

    const canonicalName = d.canonicalName?.trim();
    if (canonicalName && canonicalName.toLowerCase() !== current.name.toLowerCase()) {
      const conflict = nameIndex.get(canonicalName.toLowerCase());
      if (conflict && conflict.id !== current.id) {
        const currentScore = connectionCount.get(current.id) || 0;
        const conflictScore = connectionCount.get(conflict.id) || 0;
        if (currentScore <= conflictScore) {
          await mergePolitician(current.id, conflict.id);
          merged++;
        } else {
          await mergePolitician(conflict.id, current.id);
          merged++;
          await prisma.politician.update({ where: { id: current.id }, data: { name: canonicalName } });
          renamed++;
        }
      } else {
        await prisma.politician.update({ where: { id: current.id }, data: { name: canonicalName } });
        renamed++;
      }
      nameIndex = await byName();
    }
  }

  // Third pass: deterministic duplicate merge by normalized key.
  const finalActors = await prisma.politician.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
  });

  const groups = new Map<string, { id: string; name: string; type: string }[]>();
  for (const a of finalActors) {
    const bucket = mapType(inferTypeFromName(a.name));
    const key = `${bucket}:${bucket === 'legislation' ? normalizeNoYear(a.name) : normalizeForMatch(a.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  for (const [, group] of Array.from(groups.entries())) {
    if (group.length < 2) continue;
    group.sort((a: { id: string; name: string; type: string }, b: { id: string; name: string; type: string }) => {
      const sa = (connectionCount.get(a.id) || 0) * 10 + a.name.length;
      const sb = (connectionCount.get(b.id) || 0) * 10 + b.name.length;
      return sb - sa;
    });
    const canonical = group[0];
    for (const dup of group.slice(1)) {
      if (tokenSimilarity(canonical.name, dup.name) >= 0.82) {
        await mergePolitician(dup.id, canonical.id);
        merged++;
      }
    }
  }

  const afterCount = await prisma.politician.count();
  const typeBreakdown = await prisma.$queryRawUnsafe<Array<{ type: string; count: number }>>(
    'SELECT type, COUNT(*) as count FROM Politician GROUP BY type ORDER BY count DESC'
  );

  console.log(JSON.stringify({
    ok: true,
    updated: { typeUpdated, deactivated, renamed, merged },
    totals: { politicians: afterCount },
    types: typeBreakdown.map((t) => ({ type: t.type, count: Number(t.count) })),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
