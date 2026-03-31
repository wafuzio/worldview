import { prisma } from './db';
import { addToQueue } from './research-agent';

type ConnectionAgentLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
};

export type ConnectionAgentConfig = {
  maxNewLinks?: number;
  queueVerificationTopics?: boolean;
  dryRun?: boolean;
};

export type ConnectionAgentResult = {
  runId: string;
  status: 'completed' | 'failed';
  relationshipsScanned: number;
  relationshipsTightened: number;
  missingLinksCreated: number;
  verificationTopicsQueued: number;
  details: {
    tightened: { relationshipId: string; oldSignificance: number; newSignificance: number }[];
    created: { sourceId: string; sourceName: string; targetId: string; targetName: string; reason: string }[];
  };
  log: ConnectionAgentLogEntry[];
};

type ActorLite = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  title: string | null;
  affiliation: string | null;
  tags: string | null;
};

type RelationshipLite = {
  id: string;
  sourceId: string;
  targetId: string;
  tier: string;
  relationshipType: string;
  significance: number;
  description: string | null;
  _count: { evidence: number };
};

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
  return stripCorporateSuffix(normalize(name));
}

function matchesSingleLetterAlias(haystack: string, alias: string): boolean {
  if (!alias || alias.length !== 1) return false;
  const tokens = haystack.split(' ');
  const hasToken = tokens.includes(alias);
  const hasExecutiveContext = /\b(ceo|owner|founder|chair|president|executive)\b/.test(haystack);
  return hasToken && hasExecutiveContext;
}

function organizationAliases(actor: ActorLite): string[] {
  const aliases = new Set<string>();
  const name = normalize(actor.name);
  if (name.length >= 2) aliases.add(name);

  const stripped = stripCorporateSuffix(name);
  if (stripped && stripped !== name) aliases.add(stripped);

  for (const tag of parseTags(actor.tags)) {
    const n = normalize(tag);
    if (n.length >= 2) aliases.add(n);
    const strippedTag = stripCorporateSuffix(n);
    if (strippedTag && strippedTag !== n) aliases.add(strippedTag);
  }

  if (name === 'x') aliases.add('twitter');
  return Array.from(aliases);
}

function significanceFromEvidence(rel: RelationshipLite): number {
  const evidenceCount = rel._count?.evidence || 0;
  const tierBase = rel.tier === 'documented' ? 3 : rel.tier === 'interactional' ? 2 : 2;
  let score = tierBase;
  if (evidenceCount >= 2) score += 1;
  if (evidenceCount >= 5) score += 1;
  return Math.max(1, Math.min(5, score));
}

function buildRelationshipDescription(type: string, sourceName: string, targetName: string): string {
  const human = type.replace(/_/g, ' ');
  return `Connection recorded: ${sourceName} ${human} ${targetName}.`;
}

export async function runConnectionAgent(config: ConnectionAgentConfig = {}): Promise<ConnectionAgentResult> {
  const maxNewLinks = Math.max(1, Math.min(config.maxNewLinks ?? 25, 200));
  const queueVerificationTopics = config.queueVerificationTopics ?? true;
  const dryRun = config.dryRun ?? false;
  const log: ConnectionAgentLogEntry[] = [];

  const addLog = (level: ConnectionAgentLogEntry['level'], message: string, data?: any) => {
    log.push({ timestamp: new Date().toISOString(), level, message, data });
  };

  const run = await prisma.agentRun.create({
    data: {
      runType: 'connection_tighten',
      status: 'running',
      maxTopics: maxNewLinks,
      depth: 'standard',
    },
  });

  const result: ConnectionAgentResult = {
    runId: run.id,
    status: 'completed',
    relationshipsScanned: 0,
    relationshipsTightened: 0,
    missingLinksCreated: 0,
    verificationTopicsQueued: 0,
    details: { tightened: [], created: [] },
    log,
  };

  try {
    const [actors, relationships] = await Promise.all([
      prisma.politician.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          title: true,
          affiliation: true,
          tags: true,
        },
      }),
      prisma.actorRelationship.findMany({
        include: { _count: { select: { evidence: true } } },
      }) as Promise<RelationshipLite[]>,
    ]);

    result.relationshipsScanned = relationships.length;
    addLog('info', `Scanned ${relationships.length} relationships and ${actors.length} actors`);

    const actorById = new Map(actors.map((a) => [a.id, a]));
    const pairSet = new Set<string>();
    for (const rel of relationships) {
      pairSet.add(`${rel.sourceId}::${rel.targetId}`);
      pairSet.add(`${rel.targetId}::${rel.sourceId}`);
    }

    // 1) Tighten existing relationships
    for (const rel of relationships) {
      const source = actorById.get(rel.sourceId);
      const target = actorById.get(rel.targetId);
      if (!source || !target) continue;

      const desiredSignificance = significanceFromEvidence(rel);
      const needsSignificanceUpdate = desiredSignificance > rel.significance;
      const needsDescription = !rel.description || !rel.description.trim();

      if (!needsSignificanceUpdate && !needsDescription) continue;

      if (!dryRun) {
        await prisma.actorRelationship.update({
          where: { id: rel.id },
          data: {
            significance: needsSignificanceUpdate ? desiredSignificance : rel.significance,
            description: needsDescription
              ? buildRelationshipDescription(rel.relationshipType, source.name, target.name)
              : rel.description,
          },
        });
      }

      if (needsSignificanceUpdate) {
        result.relationshipsTightened += 1;
        result.details.tightened.push({
          relationshipId: rel.id,
          oldSignificance: rel.significance,
          newSignificance: desiredSignificance,
        });
      }
    }

    // 2) Create missing obvious links (conservative profile-text inference)
    const people = actors.filter((a) => PERSON_TYPES.has(a.type));
    const orgs = actors.filter((a) => ORG_TYPES.has(a.type));

    const candidates: Array<{
      source: ActorLite;
      target: ActorLite;
      reason: string;
      significance: number;
      relationshipType: string;
      topic: string;
      rationale: string;
    }> = [];

    for (const person of people) {
      const profileText = normalize([
        person.affiliation,
        person.title,
        person.description,
        ...parseTags(person.tags),
      ].join(' '));
      if (!profileText) continue;
      const normalizedAffiliation = normalize(person.affiliation);

      for (const org of orgs) {
        if (person.id === org.id) continue;
        if (pairSet.has(`${person.id}::${org.id}`)) continue;

        const aliases = organizationAliases(org);
        const matchedAlias = aliases.find((alias) => (
          alias.length === 1
            ? matchesSingleLetterAlias(profileText, alias)
            : containsPhrase(profileText, alias)
        ));
        if (!matchedAlias) continue;

        const significance = normalizedAffiliation && matchedAlias === normalizedAffiliation ? 3 : 2;
        const reason = `Profile text for ${person.name} references ${org.name} ("${matchedAlias}").`;
        candidates.push({
          source: person,
          target: org,
          reason,
          significance,
          relationshipType: 'placeholder_link',
          topic: `Verify and document evidence-backed connections between ${person.name} and ${org.name}`,
          rationale: `Connection agent flagged likely missing link from profile metadata: ${person.name} ↔ ${org.name}.`,
        });
      }
    }

    // 3) Create missing likely-same-entity links for organizations
    const orgBuckets = new Map<string, ActorLite[]>();
    for (const org of orgs) {
      const key = canonicalOrgName(org.name);
      if (!key || key.length < 1) continue;
      if (!orgBuckets.has(key)) orgBuckets.set(key, []);
      orgBuckets.get(key)!.push(org);
    }

    for (const [key, group] of Array.from(orgBuckets.entries())) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (pairSet.has(`${a.id}::${b.id}`)) continue;
          candidates.push({
            source: a,
            target: b,
            reason: `Likely same organization variant (canonical key: "${key}")`,
            significance: 4,
            relationshipType: 'inferred_same_entity',
            topic: `Verify whether ${a.name} and ${b.name} are the same organization or formally related entities`,
            rationale: `Connection agent flagged possible canonical duplication: ${a.name} vs ${b.name}.`,
          });
        }
      }
    }

    // Rank conservative-first: higher significance, then lexical stability
    candidates.sort((a, b) => b.significance - a.significance || a.source.name.localeCompare(b.source.name));

    for (const candidate of candidates) {
      if (result.missingLinksCreated >= maxNewLinks) break;
      const key = `${candidate.source.id}::${candidate.target.id}`;
      if (pairSet.has(key)) continue;

      if (!dryRun) {
        await prisma.actorRelationship.create({
          data: {
            sourceId: candidate.source.id,
            targetId: candidate.target.id,
            tier: 'analytical',
            relationshipType: candidate.relationshipType,
            significance: candidate.significance,
            description: `Connection candidate added by connection agent. ${candidate.reason}`,
          },
        });
      }

      pairSet.add(`${candidate.source.id}::${candidate.target.id}`);
      pairSet.add(`${candidate.target.id}::${candidate.source.id}`);

      result.missingLinksCreated += 1;
      result.details.created.push({
        sourceId: candidate.source.id,
        sourceName: candidate.source.name,
        targetId: candidate.target.id,
        targetName: candidate.target.name,
        reason: candidate.reason,
      });

      if (queueVerificationTopics) {
        const exists = await prisma.researchQueue.findFirst({
          where: {
            AND: [
              { topic: { contains: candidate.source.name.slice(0, 40) } },
              { topic: { contains: candidate.target.name.slice(0, 40) } },
            ],
            status: { in: ['pending', 'processing'] },
          },
          select: { id: true },
        });
        if (!exists && !dryRun) {
          await addToQueue(candidate.topic, {
            rationale: candidate.rationale,
            priority: 'high',
            depth: 'deep',
            source: 'gap_fill',
          });
          result.verificationTopicsQueued += 1;
        }
      }
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        topicsProcessed: result.relationshipsScanned,
        topicsSucceeded: result.relationshipsTightened + result.missingLinksCreated,
        topicsFailed: 0,
        topicsDiscovered: result.verificationTopicsQueued,
        evidenceCreated: 0,
        entitiesCreated: 0,
        log: JSON.stringify(log),
      },
    });

    addLog(
      'info',
      `Connection agent complete: tightened=${result.relationshipsTightened}, created=${result.missingLinksCreated}, queued=${result.verificationTopicsQueued}`
    );
    return result;
  } catch (e: any) {
    result.status = 'failed';
    addLog('error', e?.message || 'Connection agent failed');
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        log: JSON.stringify(log),
      },
    });
    return result;
  }
}
