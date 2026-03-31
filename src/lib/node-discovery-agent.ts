import { prisma } from './db';
import { callLLM, parseJSONResponse } from './llm';
import { addToQueue } from './research-agent';
import { suggestActorImage } from './actor-image';

export type MissingNodeSuggestion = {
  name: string;
  type: string;
  rationale: string;
  importance: number;
  suggestedConnections: {
    existingNodeName: string;
    relationshipHypothesis: string;
  }[];
};

type NodeDiscoveryLog = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

const ALLOWED_TYPES = new Set([
  'politician',
  'party',
  'lobbyist',
  'pac',
  'corporation',
  'media_figure',
  'organization',
  'legislation',
  'event',
]);

function normalize(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickType(raw: string | null | undefined): string {
  const t = normalize(raw);
  if (ALLOWED_TYPES.has(t)) return t;
  if (/\b(act|bill|law|statute)\b/.test(t)) return 'legislation';
  if (/\b(event|protest|riot|election|hearing)\b/.test(t)) return 'event';
  if (/\b(corp|company|inc|llc)\b/.test(t)) return 'corporation';
  if (/\b(pac|committee)\b/.test(t)) return 'pac';
  if (/\b(party)\b/.test(t)) return 'party';
  return 'organization';
}

function importanceFromMentionCount(count: number): number {
  if (count >= 20) return 5;
  if (count >= 10) return 4;
  if (count >= 5) return 3;
  if (count >= 2) return 2;
  return 1;
}

export async function discoverMissingNodes(maxNodes = 8): Promise<{
  suggestions: MissingNodeSuggestion[];
  log: NodeDiscoveryLog[];
}> {
  const log: NodeDiscoveryLog[] = [];
  const addLog = (level: NodeDiscoveryLog['level'], message: string) => {
    log.push({ timestamp: new Date().toISOString(), level, message });
  };

  const cappedMax = Math.max(5, Math.min(maxNodes, 10));

  const actors = await prisma.politician.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      affiliation: true,
      title: true,
      _count: { select: { relationshipsFrom: true, relationshipsTo: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 700,
  });

  const queue = await prisma.researchQueue.findMany({
    where: { status: { in: ['pending', 'processing'] } },
    select: { topic: true },
    take: 120,
    orderBy: { createdAt: 'desc' },
  });
  const entities = await prisma.entity.findMany({
    select: {
      name: true,
      type: true,
      _count: { select: { evidence: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 1200,
  });

  const topActors = [...actors]
    .sort((a, b) =>
      (b._count.relationshipsFrom + b._count.relationshipsTo) -
      (a._count.relationshipsFrom + a._count.relationshipsTo))
    .slice(0, 60)
    .map((a) => `${a.name} (${a.type}) rel=${a._count.relationshipsFrom + a._count.relationshipsTo}`);

  const queuedTopics = queue.map((q) => q.topic).slice(0, 60);
  const existingNames = new Set(actors.map((a) => normalize(a.name)));

  addLog('info', `Loaded ${actors.length} existing actors, ${entities.length} entities, and ${queue.length} active queue topics`);

  const response = await callLLM([
    {
      role: 'system',
      content: `You are a node-gap analyst for a political evidence graph.
Return ONLY a JSON array of missing node suggestions.

Target output:
[
  {
    "name": "Node name",
    "type": "politician|donor|operative|party|lobbyist|pac|corporation|media_figure|organization|legislation|event",
    "rationale": "Why this node is a high-value missing node for overall graph completeness",
    "importance": 1-5,
    "suggestedConnections": [
      { "existingNodeName": "Name already in graph", "relationshipHypothesis": "short hypothesis" }
    ]
  }
]

Rules:
- Generate at least ${Math.max(12, cappedMax * 2)} candidates, with no filler.
- Prioritize major principal nodes or major institutions over peripheral details.
- Prefer nodes that plausibly connect multiple existing clusters.
- Do NOT suggest nodes already present in graph.
- Include 1-3 suggestedConnections per node, each pointing to an existing node name from the provided list.
- Keep rationales concrete and evidence-oriented, not partisan.`,
    },
    {
      role: 'user',
      content: `Existing high-connection nodes:
${topActors.map((x) => `- ${x}`).join('\n') || '(none)'}

Active queued topics:
${queuedTopics.map((x) => `- ${x}`).join('\n') || '(none)'}

Suggest missing nodes now.`,
    },
  ], { temperature: 0.25, maxTokens: 6000, timeoutMs: 180000 });

  if (response.error || !response.content) {
    addLog('error', `LLM error: ${response.error || 'empty response'}`);
    return { suggestions: [], log };
  }

  const parsed = parseJSONResponse(response.content);
  const rawList = Array.isArray(parsed) ? parsed : [];
  addLog('info', `LLM returned ${rawList.length} raw suggestions`);

  const cleaned: MissingNodeSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    const name = String(item?.name || '').trim();
    if (!name) continue;
    const key = normalize(name);
    if (!key || seen.has(key) || existingNames.has(key)) continue;
    seen.add(key);

    const type = pickType(String(item?.type || 'organization'));
    const rationale = String(item?.rationale || '').trim() || 'Missing likely high-importance node for graph completeness.';
    const importance = Math.max(1, Math.min(5, Number(item?.importance || 3)));
    const suggestedConnections = Array.isArray(item?.suggestedConnections)
      ? item.suggestedConnections
          .map((c: any) => ({
            existingNodeName: String(c?.existingNodeName || '').trim(),
            relationshipHypothesis: String(c?.relationshipHypothesis || '').trim(),
          }))
          .filter((c: any) => c.existingNodeName)
          .slice(0, 3)
      : [];

    cleaned.push({ name, type, rationale, importance, suggestedConnections });
  }

  cleaned.sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name));
  const suggestions = cleaned.slice(0, cappedMax);

  if (suggestions.length < cappedMax) {
    const need = cappedMax - suggestions.length;
    const topAnchorNodes = topActors
      .slice(0, 12)
      .map((row) => {
        const i = row.indexOf(' (');
        return i > 0 ? row.slice(0, i) : row;
      })
      .filter(Boolean);

    const fallback: MissingNodeSuggestion[] = [];
    for (const ent of entities) {
      const name = String(ent.name || '').trim();
      const key = normalize(name);
      const mentions = Number(ent._count?.evidence || 0);
      if (!name || !key) continue;
      if (existingNames.has(key) || seen.has(key)) continue;
      if (mentions < 2) continue;

      seen.add(key);
      const type = pickType(ent.type);
      const suggestedConnections = topAnchorNodes.slice(0, 2).map((existingNodeName) => ({
        existingNodeName,
        relationshipHypothesis: `Likely appears in related evidence context with ${existingNodeName}; validate direct connection with sourced records.`,
      }));

      fallback.push({
        name,
        type,
        importance: importanceFromMentionCount(mentions),
        rationale: `Appears in ${mentions} evidence item${mentions === 1 ? '' : 's'} but is not yet represented as a graph node.`,
        suggestedConnections,
      });
      if (fallback.length >= need) break;
    }

    if (fallback.length > 0) {
      addLog('warn', `LLM yielded only ${suggestions.length}; filled ${fallback.length} additional suggestions from high-frequency evidence entities`);
      suggestions.push(...fallback);
    } else {
      addLog('warn', `LLM yielded only ${suggestions.length}; no eligible entity-backed fallback candidates were found`);
    }
  }

  suggestions.sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name));
  addLog('info', `Prepared ${suggestions.length} final missing-node suggestions`);

  return { suggestions, log };
}

export async function addMissingNodesToGraph(
  selected: MissingNodeSuggestion[]
): Promise<{
  added: number;
  queued: number;
  skippedExisting: number;
  created: { id: string; name: string; type: string; queuedTopic: boolean }[];
}> {
  const actors = await prisma.politician.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    take: 4000,
  });
  const existingByNorm = new Map(actors.map((a) => [normalize(a.name), a]));

  let added = 0;
  let queued = 0;
  let skippedExisting = 0;
  const created: { id: string; name: string; type: string; queuedTopic: boolean }[] = [];

  for (const suggestion of selected) {
    const name = suggestion.name.trim();
    if (!name) continue;
    const norm = normalize(name);
    if (!norm) continue;

    if (existingByNorm.has(norm)) {
      skippedExisting += 1;
      continue;
    }

    const type = pickType(suggestion.type);
    const tags = ['placeholder', 'needs_verification', 'discovered_node'];

    let actor = await prisma.politician.findFirst({
      where: { name },
      select: { id: true, name: true, type: true },
    });

    if (!actor) {
      try {
        actor = await prisma.politician.create({
          data: {
            name,
            type,
            description: suggestion.rationale || 'Discovered as a likely missing node; pending evidence-backed expansion.',
            tags: JSON.stringify(tags),
            isActive: true,
          },
          select: { id: true, name: true, type: true },
        });
        added += 1;
      } catch (e: any) {
        if (e?.code === 'P2002') {
          actor = await prisma.politician.findFirst({
            where: { name },
            select: { id: true, name: true, type: true },
          });
        } else {
          throw e;
        }
      }
    }

    if (!actor) {
      skippedExisting += 1;
      continue;
    }

    existingByNorm.set(norm, { id: actor.id, name: actor.name });

    // Attempt auto image
    try {
      const suggestionImage = await suggestActorImage(actor.name, actor.type);
      if (suggestionImage?.imageUrl) {
        await prisma.politician.update({
          where: { id: actor.id },
          data: { imageUrl: suggestionImage.imageUrl },
        });
      }
    } catch {
      // Non-fatal
    }

    const connectionNames = (suggestion.suggestedConnections || [])
      .map((c) => c.existingNodeName)
      .filter(Boolean)
      .slice(0, 3);
    const topic = connectionNames.length > 0
      ? `Build evidence profile for ${actor.name} and verify ties to ${connectionNames.join(', ')}`
      : `Build evidence profile for ${actor.name} and map key relationships`;

    await addToQueue(topic, {
      rationale: `Node discovered as likely missing high-value actor: ${suggestion.rationale || actor.name}`,
      priority: suggestion.importance >= 4 ? 'high' : 'medium',
      depth: 'deep',
      source: 'gap_fill',
    });
    queued += 1;

    created.push({ id: actor.id, name: actor.name, type: actor.type, queuedTopic: true });
  }

  return { added, queued, skippedExisting, created };
}
