import { prisma } from './db';
import { callLLM, parseJSONResponse } from './llm';

export type SuggestedTopic = {
  topic: string;
  rationale: string;
  priority: string;
};

function normalizePriority(priority?: string): 'high' | 'medium' | 'low' {
  const p = (priority || '').toLowerCase();
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

function fallbackPrioritization(candidates: SuggestedTopic[], maxCount: number): SuggestedTopic[] {
  const deduped: SuggestedTopic[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const key = c.topic.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      topic: c.topic.trim(),
      rationale: c.rationale?.trim() || 'Follow-up suggested by research run',
      priority: normalizePriority(c.priority),
    });
  }

  const weight: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return deduped
    .sort((a, b) => weight[normalizePriority(a.priority)] - weight[normalizePriority(b.priority)])
    .slice(0, maxCount);
}

async function buildGlobalPriorityContext(): Promise<string> {
  const [evidenceCount, entityCount, relationshipCount, categories, topActors] = await Promise.all([
    prisma.evidence.count(),
    prisma.entity.count(),
    prisma.actorRelationship.count(),
    prisma.category.findMany({
      select: {
        name: true,
        slug: true,
        _count: { select: { evidence: true } },
      },
      orderBy: { evidence: { _count: 'asc' } },
      take: 8,
    }),
    prisma.politician.findMany({
      select: {
        name: true,
        type: true,
        _count: {
          select: {
            relationshipsFrom: true,
            relationshipsTo: true,
            actions: true,
          },
        },
      },
      orderBy: { relationshipsFrom: { _count: 'desc' } },
      take: 12,
    }),
  ]);

  const categorySummary = categories
    .map((c) => `${c.slug}: ${c._count.evidence}`)
    .join(', ');

  const actorSummary = topActors
    .map((a) => `${a.name} (${a.type}) rel=${a._count.relationshipsFrom + a._count.relationshipsTo} actions=${a._count.actions}`)
    .join('; ');

  return `Database scope: ${evidenceCount} evidence, ${entityCount} entities, ${relationshipCount} actor relationships.
Lowest-covered categories: ${categorySummary || 'n/a'}.
Most connected actors currently in map: ${actorSummary || 'n/a'}.`;
}

export async function prioritizeSuggestedTopics(
  candidates: SuggestedTopic[],
  maxCount: number
): Promise<SuggestedTopic[]> {
  if (!Array.isArray(candidates) || candidates.length === 0 || maxCount <= 0) return [];

  const fallback = fallbackPrioritization(candidates, maxCount);
  if (fallback.length <= maxCount && fallback.length <= 1) return fallback;

  try {
    const context = await buildGlobalPriorityContext();
    const candidateJson = JSON.stringify(fallback, null, 2);

    const response = await callLLM([
      {
        role: 'system',
        content: `You are a queue-prioritization analyst for a political evidence graph.

Your job: pick ONLY the highest-impact follow-up research topics.

Rules:
1. Select at most ${maxCount} topics.
2. Rank by WHOLE-DATABASE impact, not niche/local relevance.
3. Prefer topics that close glaring principal-node gaps and institutional blind spots.
4. If there is a likely missing high-importance principal actor, prioritize that before peripheral actors.
5. Keep topics concrete and researchable.
6. Return valid JSON array only:
[
  {"topic":"...", "rationale":"...", "priority":"high|medium|low"}
]`,
      },
      {
        role: 'user',
        content: `GLOBAL CONTEXT:
${context}

CANDIDATE TOPICS:
${candidateJson}

Choose the best ${maxCount} topics (or fewer if weak).`,
      },
    ], { temperature: 0.1 });

    if (!response.content) return fallback;
    const parsed = parseJSONResponse(response.content);
    if (!Array.isArray(parsed)) return fallback;

    const normalized = parsed
      .map((x: any) => ({
        topic: String(x?.topic || '').trim(),
        rationale: String(x?.rationale || '').trim(),
        priority: normalizePriority(x?.priority),
      }))
      .filter((x: SuggestedTopic) => x.topic.length > 0);

    if (normalized.length === 0) return fallback;

    return fallbackPrioritization(normalized, maxCount);
  } catch {
    return fallback;
  }
}
