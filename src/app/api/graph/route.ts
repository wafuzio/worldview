export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/graph
 *
 * Returns a subgraph of actors and relationships for the corruption map.
 *
 * Query params:
 *   centerId  — Politician ID to center the graph on (optional)
 *   depth     — How many hops from center (1-3, default 1)
 *   tier      — Filter by relationship tier: "documented","interactional","analytical","all" (default "all")
 *   minSignificance — Minimum significance score 1-5 (default 1)
 *
 * If no centerId, returns ALL actors that have connections + ALL edges between them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get('centerId');
  const depth = Math.min(Math.max(parseInt(searchParams.get('depth') || '1'), 1), 3);
  const tier = searchParams.get('tier') || 'all';
  const minSignificance = parseInt(searchParams.get('minSignificance') || '1');
  const includeInferred = searchParams.get('includeInferred') === 'true';
  const includeIndirect = searchParams.get('includeIndirect') === 'true';

  const tierFilter = tier === 'all' ? {} : { tier };

  if (!centerId) {
    // ── Overview mode: return connected actors/edges + inferred obvious missing links ──
    const relationships = await prisma.actorRelationship.findMany({
      where: {
        ...tierFilter,
        significance: { gte: minSignificance },
      },
      include: {
        source: true,
        target: true,
        evidence: {
          include: { evidence: { select: { id: true, title: true, sourceUrl: true } } },
        },
      },
    });

    const edges: ActorRelEdge[] = [];

    for (const rel of relationships) {
      edges.push(toEdge(rel));
    }

    const allActors = await prisma.politician.findMany({
      where: { isActive: true },
      include: {
        relationshipsFrom: { select: { id: true } },
        relationshipsTo: { select: { id: true } },
      },
    });

    const inferredEdges = includeInferred ? buildInferredAffiliationEdges(allActors, edges, { maxEdges: 400 }) : [];
    const inferredSameEntityEdges = includeInferred
      ? buildInferredSameEntityEdges(allActors, [...edges, ...inferredEdges], { maxEdges: 180 })
      : [];
    const actorById = new Map(allActors.map((a) => [a.id, a]));
    const viaNodeIds = includeIndirect ? collectViaNodeIds(actorById, edges, { maxViaNodes: 320 }) : new Set<string>();
    const combinedEdges = [...edges, ...inferredEdges, ...inferredSameEntityEdges];

    const actorIds = new Set<string>();
    for (const e of combinedEdges) {
      actorIds.add(e.source);
      actorIds.add(e.target);
    }
    // Via nodes are already in actorIds (they have direct edges), but ensure they're included.
    for (const id of Array.from(viaNodeIds)) actorIds.add(id);

    const nodes = allActors.filter((a) => actorIds.has(a.id)).map(toNode);
    return NextResponse.json({
      nodes,
      edges: combinedEdges,
      viaNodeIds: Array.from(viaNodeIds),
      mode: 'overview',
      inferred: {
        enabled: includeInferred,
        edges: inferredEdges.length,
        sameEntityEdges: inferredSameEntityEdges.length,
        viaNodes: viaNodeIds.size,
      },
    });
  }

  // ── Subgraph mode: BFS from center node ──
  const visitedIds = new Set<string>([centerId]);
  const edgeSet = new Map<string, ActorRelEdge>();
  let frontier = [centerId];

  for (let d = 0; d < depth; d++) {
    if (frontier.length === 0) break;

    const relationships = await prisma.actorRelationship.findMany({
      where: {
        ...tierFilter,
        significance: { gte: minSignificance },
        OR: [
          { sourceId: { in: frontier } },
          { targetId: { in: frontier } },
        ],
      },
      include: {
        source: true,
        target: true,
        evidence: {
          include: { evidence: { select: { id: true, title: true, sourceUrl: true } } },
        },
      },
    });

    const nextFrontier: string[] = [];

    for (const rel of relationships) {
      if (!edgeSet.has(rel.id)) {
        edgeSet.set(rel.id, toEdge(rel));
      }

      for (const neighbor of [rel.source, rel.target]) {
        if (!visitedIds.has(neighbor.id)) {
          visitedIds.add(neighbor.id);
          nextFrontier.push(neighbor.id);
        }
      }
    }

    frontier = nextFrontier;
  }

  const allActors = await prisma.politician.findMany({
    where: { isActive: true },
    include: {
      relationshipsFrom: { select: { id: true } },
      relationshipsTo: { select: { id: true } },
    },
  });

  const actorById = new Map(allActors.map((a) => [a.id, a]));
  const viaNodeIds = includeIndirect
    ? collectViaNodeIds(actorById, Array.from(edgeSet.values()), { seedIds: visitedIds, maxViaNodes: 140 })
    : new Set<string>();
  // Via nodes are already in visitedIds (seedIds check guarantees it), but ensure they stay included.
  for (const id of Array.from(viaNodeIds)) visitedIds.add(id);

  const inferredEdges = includeInferred
    ? buildInferredAffiliationEdges(allActors, Array.from(edgeSet.values()), {
        seedIds: visitedIds,
        maxEdges: 120,
      })
    : [];
  const inferredSameEntityEdges = includeInferred
    ? buildInferredSameEntityEdges(allActors, [...Array.from(edgeSet.values()), ...inferredEdges], {
        seedIds: visitedIds,
        maxEdges: 60,
      })
    : [];
  for (const edge of inferredEdges) {
    edgeSet.set(edge.id, edge);
    visitedIds.add(edge.source);
    visitedIds.add(edge.target);
  }
  for (const edge of inferredSameEntityEdges) {
    edgeSet.set(edge.id, edge);
    visitedIds.add(edge.source);
    visitedIds.add(edge.target);
  }

  const actors = allActors.filter((a) => visitedIds.has(a.id));

  return NextResponse.json({
    nodes: actors.map(toNode),
    edges: Array.from(edgeSet.values()),
    viaNodeIds: Array.from(viaNodeIds),
    mode: 'subgraph',
    centerId,
    depth,
    inferred: {
      enabled: includeInferred,
      edges: inferredEdges.length,
      sameEntityEdges: inferredSameEntityEdges.length,
      viaNodes: viaNodeIds.size,
    },
  });
}

// ── Search endpoint ──
export async function POST(request: Request) {
  const { query } = await request.json();
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const results = await prisma.politician.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
        { title: { contains: query } },
        { tags: { contains: query } },
      ],
    },
    take: 15,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    results.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      title: r.title,
      affiliation: r.affiliation,
      imageUrl: r.imageUrl,
    }))
  );
}

// ── Helpers ──

interface ActorRelEdge {
  id: string;
  source: string;
  target: string;
  tier: string;
  relationshipType: string;
  significance: number;
  description: string | null;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  evidence: { id: string; title: string; sourceUrl: string | null; excerpt: string | null }[];
}

type GraphActor = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  title: string | null;
  affiliation: string | null;
  imageUrl: string | null;
  tags: string | null;
  relationshipsFrom: { id: string }[];
  relationshipsTo: { id: string }[];
};

function toEdge(rel: any): ActorRelEdge {
  return {
    id: rel.id,
    source: rel.sourceId,
    target: rel.targetId,
    tier: rel.tier,
    relationshipType: rel.relationshipType,
    significance: rel.significance,
    description: rel.description,
    amount: rel.amount,
    startDate: rel.startDate?.toISOString() || null,
    endDate: rel.endDate?.toISOString() || null,
    evidence: (rel.evidence || []).map((e: any) => ({
      id: e.evidence.id,
      title: e.evidence.title,
      sourceUrl: e.evidence.sourceUrl,
      excerpt: e.excerpt,
    })),
  };
}

function toNode(actor: GraphActor) {
  return {
    id: actor.id,
    name: actor.name,
    type: actor.type,
    description: actor.description,
    title: actor.title,
    affiliation: actor.affiliation,
    imageUrl: actor.imageUrl,
    tags: actor.tags ? JSON.parse(actor.tags) : [],
    connectionCount: actor.relationshipsFrom.length + actor.relationshipsTo.length,
  };
}

const PERSON_TYPES = new Set(['politician', 'donor', 'operative', 'lobbyist', 'media_figure']);
const ORG_TYPES = new Set(['organization', 'corporation', 'party', 'pac']);

function normalize(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 2) return false;
  return (` ${haystack} `).includes(` ${needle} `);
}

function stripCorporateSuffix(name: string): string {
  return name
    .replace(/\b(corp|corporation|inc|incorporated|co|company|ltd|llc|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalOrgName(name: string): string {
  return stripCorporateSuffix(normalize(name)).replace(/\s+/g, ' ').trim();
}

function matchesSingleLetterAlias(haystack: string, alias: string): boolean {
  if (!alias || alias.length !== 1) return false;
  const tokens = haystack.split(' ');
  const hasToken = tokens.includes(alias);
  const hasExecutiveContext = /\b(ceo|owner|founder|chair|president|executive)\b/.test(haystack);
  return hasToken && hasExecutiveContext;
}

function organizationAliases(actor: GraphActor): string[] {
  const aliases = new Set<string>();
  const name = normalize(actor.name);
  if (name.length >= 2) aliases.add(name);
  const stripped = stripCorporateSuffix(name);
  if (stripped && stripped !== name) aliases.add(stripped);

  for (const t of parseTags(actor.tags)) {
    const normalized = normalize(t);
    if (normalized.length >= 2) aliases.add(normalized);
    const strippedTag = stripCorporateSuffix(normalized);
    if (strippedTag && strippedTag !== normalized) aliases.add(strippedTag);
  }

  const desc = actor.description || '';
  const formerlyRegex = /formerly(?:\s+known\s+as)?\s+([A-Za-z0-9 .-]{2,50})/gi;
  let match: RegExpExecArray | null = null;
  while ((match = formerlyRegex.exec(desc)) !== null) {
    const normalized = normalize(match[1]);
    if (normalized.length >= 2) aliases.add(normalized);
  }

  if (name === 'x') aliases.add('twitter');
  return Array.from(aliases);
}

function buildInferredAffiliationEdges(
  actors: GraphActor[],
  existingEdges: ActorRelEdge[],
  options: { seedIds?: Set<string>; maxEdges?: number } = {}
): ActorRelEdge[] {
  const seedIds = options.seedIds;
  const maxEdges = options.maxEdges ?? 200;
  const people = actors.filter((a) => PERSON_TYPES.has(a.type));
  const orgs = actors.filter((a) => ORG_TYPES.has(a.type));

  const pairSet = new Set<string>();
  for (const e of existingEdges) {
    pairSet.add(`${e.source}::${e.target}`);
    pairSet.add(`${e.target}::${e.source}`);
  }

  const inferred: ActorRelEdge[] = [];
  for (const person of people) {
    if (seedIds && !seedIds.has(person.id)) continue;

    const profileText = normalize([
      person.affiliation,
      person.title,
      person.description,
      ...parseTags(person.tags),
    ].join(' '));
    if (!profileText) continue;

    const normalizedAffiliation = normalize(person.affiliation);

    for (const org of orgs) {
      if (org.id === person.id) continue;
      if (pairSet.has(`${person.id}::${org.id}`)) continue;

      const aliases = organizationAliases(org);
      const matchedAlias = aliases.find((alias) => (
        alias.length === 1
          ? matchesSingleLetterAlias(profileText, alias)
          : containsPhrase(profileText, alias)
      ));
      if (!matchedAlias) continue;

      const significance = normalizedAffiliation && matchedAlias === normalizedAffiliation ? 4 : 2;
      const edgeId = `inferred-affiliation:${person.id}:${org.id}`;
      pairSet.add(`${person.id}::${org.id}`);
      pairSet.add(`${org.id}::${person.id}`);

      inferred.push({
        id: edgeId,
        source: person.id,
        target: org.id,
        tier: 'interactional',
        relationshipType: 'inferred_affiliation',
        significance,
        description: `Inferred from profile fields (affiliation/title/description/tags) mentioning "${org.name}".`,
        amount: null,
        startDate: null,
        endDate: null,
        evidence: [],
      });

      if (inferred.length >= maxEdges) return inferred;
    }
  }
  return inferred;
}

function buildInferredSameEntityEdges(
  actors: GraphActor[],
  existingEdges: ActorRelEdge[],
  options: { seedIds?: Set<string>; maxEdges?: number } = {}
): ActorRelEdge[] {
  const seedIds = options.seedIds;
  const maxEdges = options.maxEdges ?? 100;
  const orgs = actors.filter((a) => ORG_TYPES.has(a.type));

  const pairSet = new Set<string>();
  for (const e of existingEdges) {
    pairSet.add(`${e.source}::${e.target}`);
    pairSet.add(`${e.target}::${e.source}`);
  }

  const buckets = new Map<string, GraphActor[]>();
  for (const org of orgs) {
    const key = canonicalOrgName(org.name);
    if (!key || key.length < 1) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(org);
  }

  const inferred: ActorRelEdge[] = [];
  for (const [key, group] of Array.from(buckets.entries())) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (seedIds && !seedIds.has(a.id) && !seedIds.has(b.id)) continue;
        if (pairSet.has(`${a.id}::${b.id}`)) continue;

        pairSet.add(`${a.id}::${b.id}`);
        pairSet.add(`${b.id}::${a.id}`);
        inferred.push({
          id: `inferred-same-entity:${a.id}:${b.id}`,
          source: a.id,
          target: b.id,
          tier: 'analytical',
          relationshipType: 'inferred_same_entity',
          significance: 5,
          description: `Likely same organization variant (canonical key: "${key}")`,
          amount: null,
          startDate: null,
          endDate: null,
          evidence: [],
        });

        if (inferred.length >= maxEdges) return inferred;
      }
    }
  }

  return inferred;
}

const POLITICAL_PERSONNEL_TYPES = new Set(['politician', 'donor', 'operative', 'lobbyist', 'media_figure', 'party']);
const WEAK_BRIDGE_TYPES = new Set([
  'employed_by',
  'appointed_by',
  'member_of',
  'endorsed',
  'authored',
  'founded',
  'voted_for',
]);
const STRONG_BRIDGE_TYPES = new Set([
  'funded_by',
  'donated_to',
  'contracted_with',
  'lobbied',
  'communicated_with',
  'met_with',
  'testified_before',
  'served_on_board_with',
  'briefed_by',
  'influenced_by',
  'aligned_with',
  'protected_by',
  'enabled',
  'shielded_from_investigation',
]);

function humanRel(relationshipType: string): string {
  return relationshipType.replace(/_/g, ' ');
}

// Identifies nodes that serve as bridges between other nodes which have no direct connection.
// Returns the set of via-node IDs rather than generating synthetic edges — the via nodes and
// their real constituent edges are already in the graph, so no extra lines are needed.
function collectViaNodeIds(
  actorById: Map<string, GraphActor>,
  directEdges: ActorRelEdge[],
  options: { seedIds?: Set<string>; maxViaNodes?: number } = {}
): Set<string> {
  const seedIds = options.seedIds;
  const maxViaNodes = options.maxViaNodes ?? 200;

  const directPairSet = new Set<string>();
  const incident = new Map<string, ActorRelEdge[]>();
  for (const e of directEdges) {
    directPairSet.add(`${e.source}::${e.target}`);
    directPairSet.add(`${e.target}::${e.source}`);
    if (!incident.has(e.source)) incident.set(e.source, []);
    if (!incident.has(e.target)) incident.set(e.target, []);
    incident.get(e.source)!.push(e);
    incident.get(e.target)!.push(e);
  }

  const viaNodeIds = new Set<string>();

  for (const [viaId, viaEdges] of Array.from(incident.entries())) {
    if (viaEdges.length < 2) continue;
    if (seedIds && !seedIds.has(viaId)) continue;
    if (!actorById.get(viaId)) continue;

    let isVia = false;
    outer: for (let i = 0; i < viaEdges.length; i++) {
      for (let j = i + 1; j < viaEdges.length; j++) {
        const aEdge = viaEdges[i];
        const bEdge = viaEdges[j];
        const aId = aEdge.source === viaId ? aEdge.target : aEdge.source;
        const bId = bEdge.source === viaId ? bEdge.target : bEdge.source;
        if (!aId || !bId || aId === bId) continue;
        if (directPairSet.has(`${aId}::${bId}`)) continue;
        if (seedIds && !seedIds.has(aId) && !seedIds.has(bId)) continue;

        const aType = aEdge.relationshipType;
        const bType = bEdge.relationshipType;
        const bothWeak = WEAK_BRIDGE_TYPES.has(aType) && WEAK_BRIDGE_TYPES.has(bType);
        if (bothWeak) continue;
        const hasStrongBridge = STRONG_BRIDGE_TYPES.has(aType) || STRONG_BRIDGE_TYPES.has(bType);
        const hasEvidenceOnBothSegments = (aEdge.evidence || []).length > 0 && (bEdge.evidence || []).length > 0;
        if (!hasStrongBridge && !hasEvidenceOnBothSegments) continue;

        isVia = true;
        break outer;
      }
    }

    if (isVia) {
      viaNodeIds.add(viaId);
      if (viaNodeIds.size >= maxViaNodes) break;
    }
  }

  return viaNodeIds;
}
