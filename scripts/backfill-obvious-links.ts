import { prisma } from '../src/lib/db';

type Actor = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  title: string | null;
  affiliation: string | null;
  tags: string | null;
  isActive: boolean;
};

const PERSON_TYPES = new Set(['politician', 'lobbyist', 'media_figure']);
const ORG_TYPES = new Set(['organization', 'corporation', 'party', 'pac']);

function normalize(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCorporateSuffix(name: string): string {
  return name
    .replace(/\b(corp|corporation|inc|incorporated|co|company|ltd|llc|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 2) return false;
  return (` ${haystack} `).includes(` ${needle} `);
}

function matchesSingleLetterAlias(haystack: string, alias: string): boolean {
  if (!alias || alias.length !== 1) return false;
  const tokens = haystack.split(' ');
  const hasToken = tokens.includes(alias);
  const hasExecutiveContext = /\b(ceo|owner|founder|chair|president|executive)\b/.test(haystack);
  return hasToken && hasExecutiveContext;
}

function organizationAliases(actor: Actor): string[] {
  const aliases = new Set<string>();
  const name = normalize(actor.name);
  if (name.length >= 2) aliases.add(name);
  const stripped = stripCorporateSuffix(name);
  if (stripped && stripped !== name) aliases.add(stripped);
  if (name === 'x' || stripped === 'x') aliases.add('twitter');

  for (const t of parseTags(actor.tags)) {
    const norm = normalize(t);
    if (norm.length >= 2) aliases.add(norm);
    const strippedTag = stripCorporateSuffix(norm);
    if (strippedTag && strippedTag !== norm) aliases.add(strippedTag);
  }
  return Array.from(aliases);
}

function canonicalOrgName(name: string): string {
  return stripCorporateSuffix(normalize(name)).replace(/\s+/g, ' ').trim();
}

async function ensureRelationship(
  sourceId: string,
  targetId: string,
  relationshipType: string,
  tier: 'interactional' | 'analytical',
  significance: number,
  description: string
) {
  if (sourceId === targetId) return false;

  const existing = await prisma.actorRelationship.findFirst({
    where: {
      sourceId,
      targetId,
      relationshipType,
      startDate: null,
    },
  });
  if (existing) return false;

  await prisma.actorRelationship.create({
    data: {
      sourceId,
      targetId,
      relationshipType,
      tier,
      significance,
      description,
    },
  });
  return true;
}

async function main() {
  const actors = await prisma.politician.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      title: true,
      affiliation: true,
      tags: true,
      isActive: true,
    },
  }) as Actor[];

  const people = actors.filter((a) => PERSON_TYPES.has(a.type));
  const orgs = actors.filter((a) => ORG_TYPES.has(a.type));

  const existingPairs = new Set<string>();
  const existing = await prisma.actorRelationship.findMany({
    select: { sourceId: true, targetId: true },
  });
  for (const e of existing) {
    existingPairs.add(`${e.sourceId}::${e.targetId}`);
    existingPairs.add(`${e.targetId}::${e.sourceId}`);
  }

  let inferredAffiliationCreated = 0;
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
      if (existingPairs.has(`${person.id}::${org.id}`)) continue;
      const aliases = organizationAliases(org);
      const matched = aliases.find((alias) => (
        alias.length === 1 ? matchesSingleLetterAlias(profileText, alias) : containsPhrase(profileText, alias)
      ));
      if (!matched) continue;

      const significance = normalizedAffiliation && matched === normalizedAffiliation ? 4 : 2;
      const created = await ensureRelationship(
        person.id,
        org.id,
        'inferred_affiliation',
        'interactional',
        significance,
        `Backfilled from profile fields (affiliation/title/description/tags) mentioning "${org.name}".`
      );
      if (created) {
        existingPairs.add(`${person.id}::${org.id}`);
        existingPairs.add(`${org.id}::${person.id}`);
        inferredAffiliationCreated += 1;
      }
    }
  }

  let inferredSameEntityCreated = 0;
  const buckets = new Map<string, Actor[]>();
  for (const org of orgs) {
    const key = canonicalOrgName(org.name);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(org);
  }

  for (const [key, group] of Array.from(buckets.entries())) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (existingPairs.has(`${a.id}::${b.id}`)) continue;

        const created = await ensureRelationship(
          a.id,
          b.id,
          'inferred_same_entity',
          'analytical',
          5,
          `Backfilled likely same-entity variant (canonical key: "${key}")`
        );
        if (created) {
          existingPairs.add(`${a.id}::${b.id}`);
          existingPairs.add(`${b.id}::${a.id}`);
          inferredSameEntityCreated += 1;
        }
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    created: {
      inferredAffiliation: inferredAffiliationCreated,
      inferredSameEntity: inferredSameEntityCreated,
      total: inferredAffiliationCreated + inferredSameEntityCreated,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

