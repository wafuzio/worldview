// ============================================================
// WORLDVIEW INGESTION PIPELINE
// Processes structured research data (from LLM or manual input)
// and creates/links records in the database.
// ============================================================

import { prisma } from './db';
import { suggestActorImage } from './actor-image';
import { callLLM, parseJSONResponse } from './llm';
import { validateRelationships, type ValidationSummary } from './relationship-validation';

// ── Input types (matches the research protocol JSON format) ──

export type SuggestedTopicInput = {
  topic: string;
  rationale: string;
  priority: string;
};

export type ResearchInput = {
  topic: string;
  summary: string;
  evidence?: EvidenceInput[];
  entities?: EntityInput[];
  relationships?: RelationshipInput[];
  actions?: ActionInput[];
  analyses?: AnalysisInput[];
  timeline?: TimelineInput[];
  suggestedQuestions?: SuggestedQuestionInput[];
  suggestedTopics?: SuggestedTopicInput[];
};

export type EvidenceInput = {
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceName?: string;
  eventDate?: string;
  dateAccuracy?: string;
  sourceClassification?: string;
  verificationStatus?: string;
  corroborationCount?: number;
  independentSourceCount?: number;
  politicalContext?: string;
  content?: string;
  suggestedTags?: string[];
  suggestedCategory?: string;
};

export type EntityInput = {
  name: string;
  type: string;
  description?: string;
  title?: string;
  affiliation?: string;
  aliases?: string[];
  tags?: string[];
};

export type RelationshipInput = {
  sourceName: string;
  targetName: string;
  tier: string;
  relationshipType: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
  significance?: number;
  sourceEvidence?: string;
};

export type ActionInput = {
  actorName: string;
  title: string;
  description?: string;
  actionDate: string;
  actionType: string;
  targetLegislation?: string;
  context?: string;
  framingAccuracy?: string;
  sourceUrl?: string;
};

export type AnalysisInput = {
  title?: string;
  content: string;
  claimClassification?: string;
  analysisType?: string;
  relatedEvidence?: string[];
};

export type TimelineInput = {
  title: string;
  description?: string;
  eventDate: string;
  eventType?: string;
  significance?: number;
  primaryActors?: string[];
};

export type SuggestedQuestionInput = {
  text: string;
  category: string;
  leftLabel: string;
  rightLabel: string;
};

// ── Processing result ──

export type IngestionResult = {
  success: boolean;
  created: {
    evidence: number;
    entities: number;
    relationships: number;
    actions: number;
    analyses: number;
    events: number;
    tags: number;
    questions: number;
  };
  errors: string[];
  warnings: string[];
  validationSummary?: ValidationSummary;
};

// ── Main pipeline function ──

export async function ingestResearch(input: ResearchInput): Promise<IngestionResult> {
  const result: IngestionResult = {
    success: true,
    created: { evidence: 0, entities: 0, relationships: 0, actions: 0, analyses: 0, events: 0, tags: 0, questions: 0 },
    errors: [],
    warnings: [],
  };

  try {
    const normalizedInput = await canonicalizeResearchInput(input, result.warnings);

    // Step 1: Resolve or create entities (needed for relationships)
    const entityMap = new Map<string, string>(); // name -> id
    if (normalizedInput.entities?.length) {
      for (const entity of normalizedInput.entities) {
        try {
          const id = await resolveOrCreateEntity(entity);
          entityMap.set(entity.name, id);
          if (entity.aliases) {
            for (const alias of entity.aliases) {
              entityMap.set(alias, id);
            }
          }
          result.created.entities++;
        } catch (e: any) {
          result.warnings.push(`Entity "${entity.name}": ${e.message}`);
        }
      }
    }

    // Step 2: Resolve or create actors in Politician table (for relationships & actions)
    const actorMap = new Map<string, string>(); // name -> politician id
    const allActorNames = new Set<string>();
    normalizedInput.relationships?.forEach(r => { allActorNames.add(r.sourceName); allActorNames.add(r.targetName); });
    normalizedInput.actions?.forEach(a => allActorNames.add(a.actorName));

    for (const name of Array.from(allActorNames)) {
      try {
        const id = await resolveOrCreateActor(name, findBestEntityMatch(name, normalizedInput.entities || []));
        actorMap.set(name, id);
      } catch (e: any) {
        result.warnings.push(`Actor "${name}": ${e.message}`);
      }
    }

    // Step 3: Create evidence records
    const evidenceMap = new Map<string, string>(); // title -> id
    if (normalizedInput.evidence?.length) {
      for (const ev of normalizedInput.evidence) {
        try {
          const id = await createEvidence(ev);
          evidenceMap.set(ev.title, id);
          result.created.evidence++;
        } catch (e: any) {
          result.errors.push(`Evidence "${ev.title}": ${e.message}`);
        }
      }
    }

    // Step 4: Create analyses (needed before Tier 3 relationships)
    const analysisMap = new Map<string, string>(); // title -> id
    if (normalizedInput.analyses?.length) {
      for (const analysis of normalizedInput.analyses) {
        try {
          // Link to first related evidence if available
          let evidenceId: string | undefined;
          if (analysis.relatedEvidence?.length) {
            evidenceId = evidenceMap.get(analysis.relatedEvidence[0]);
          }
          if (!evidenceId && evidenceMap.size > 0) {
            evidenceId = evidenceMap.values().next().value;
          }
          if (evidenceId) {
            const record = await prisma.analysis.create({
              data: {
                evidenceId,
                title: analysis.title,
                content: analysis.content,
                claimClassification: analysis.claimClassification || 'consistent_with_record',
                analysisType: analysis.analysisType || 'context',
                isDefaultVisible: false,
              },
            });
            if (analysis.title) analysisMap.set(analysis.title, record.id);
            result.created.analyses++;
          } else {
            result.warnings.push(`Analysis "${analysis.title}": No evidence to link to`);
          }
        } catch (e: any) {
          result.warnings.push(`Analysis "${analysis.title}": ${e.message}`);
        }
      }
    }

    // Step 5: Validate and create actor relationships (upsert to merge duplicates)
    if (normalizedInput.relationships?.length) {
      // Run common-sense validation before inserting
      const { validated, summary: valSummary } = validateRelationships(
        normalizedInput.relationships,
        normalizedInput.entities || [],
      );
      result.validationSummary = valSummary;

      // Log validation summary
      if (valSummary.dropped > 0) {
        result.warnings.push(`Validation: dropped ${valSummary.dropped} impossible relationships`);
      }
      if (valSummary.autoFixed > 0) {
        result.warnings.push(`Validation: auto-fixed ${valSummary.autoFixed} relationships (e.g. flipped direction)`);
      }
      for (const issue of valSummary.issues.filter((i) => i.severity === 'error' || i.code === 'DIRECTION_FLIPPED')) {
        result.warnings.push(`Validation: ${issue.message}`);
      }

      for (const { relationship: rel, issues, dropped } of validated) {
        if (dropped) {
          result.warnings.push(`Dropped relationship: ${issues.map((i) => i.message).join('; ')}`);
          continue;
        }
        try {
          const sourceId = actorMap.get(rel.sourceName);
          const targetId = actorMap.get(rel.targetName);
          if (!sourceId || !targetId) {
            result.warnings.push(`Relationship "${rel.sourceName} -> ${rel.targetName}": Actor not found`);
            continue;
          }

          const startDate = rel.startDate ? new Date(rel.startDate) : null;
          const endDate = rel.endDate ? new Date(rel.endDate) : undefined;
          const tier = rel.tier || 'documented';
          const significance = rel.significance || 3;
          const evId = rel.sourceEvidence ? evidenceMap.get(rel.sourceEvidence) : null;

          if (!evId) {
            result.warnings.push(
              `Relationship "${rel.sourceName} -> ${rel.targetName}" (${rel.relationshipType}): Skipped because no supporting sourceEvidence was linked`
            );
            continue;
          }

          // Tier 3 requires an analysis — try to find one
          let analysisId: string | undefined;
          if (tier === 'analytical') {
            analysisId = analysisMap.values().next().value;
            if (!analysisId) {
              result.warnings.push(`Relationship "${rel.sourceName} -> ${rel.targetName}": Tier 3 requires Analysis record`);
              continue;
            }
          }

          // Check for existing relationship with same unique key
          const existing = await prisma.actorRelationship.findFirst({
            where: {
              sourceId,
              targetId,
              relationshipType: rel.relationshipType,
              startDate,
            },
          });

          let record;
          if (existing) {
            // Merge: append new description, take higher significance, update amount if provided
            const mergedDescription = existing.description && rel.description
              ? `${existing.description} | ${rel.description}`
              : rel.description || existing.description;
            const mergedSignificance = Math.max(existing.significance, significance);
            const mergedAmount = rel.amount ?? existing.amount;

            record = await prisma.actorRelationship.update({
              where: { id: existing.id },
              data: {
                description: mergedDescription,
                significance: mergedSignificance,
                amount: mergedAmount,
                endDate: endDate ?? existing.endDate,
                ...(analysisId ? { analysisId } : {}),
              },
            });
            result.warnings.push(
              `Relationship "${rel.sourceName} -> ${rel.targetName}" (${rel.relationshipType}): Merged with existing — appended description, significance ${existing.significance} → ${mergedSignificance}`
            );
          } else {
            record = await prisma.actorRelationship.create({
              data: {
                sourceId,
                targetId,
                tier,
                relationshipType: rel.relationshipType,
                description: rel.description,
                startDate,
                endDate,
                amount: rel.amount,
                significance,
                ...(analysisId ? { analysisId } : {}),
              },
            });
            result.created.relationships++;
          }

          // Link supporting evidence (required)
          const existingLink = await prisma.actorRelationshipEvidence.findFirst({
            where: { relationshipId: record.id, evidenceId: evId },
          });
          if (!existingLink) {
            await prisma.actorRelationshipEvidence.create({
              data: { relationshipId: record.id, evidenceId: evId },
            });
          }
        } catch (e: any) {
          result.warnings.push(`Relationship "${rel.sourceName} -> ${rel.targetName}": ${e.message}`);
        }
      }
    }

    // Step 6: Create political actions
    if (normalizedInput.actions?.length) {
      for (const action of normalizedInput.actions) {
        try {
          const politicianId = actorMap.get(action.actorName);
          if (!politicianId) {
            result.warnings.push(`Action "${action.title}": Actor "${action.actorName}" not found`);
            continue;
          }
          await prisma.politicalAction.create({
            data: {
              politicianId,
              title: action.title,
              description: action.description,
              actionDate: new Date(action.actionDate),
              actionType: action.actionType,
              targetLegislation: action.targetLegislation,
              context: action.context,
              framingAccuracy: action.framingAccuracy || 'consistent',
              sourceUrl: action.sourceUrl,
            },
          });
          result.created.actions++;
        } catch (e: any) {
          result.warnings.push(`Action "${action.title}": ${e.message}`);
        }
      }
    }

    // Step 7: Create timeline events
    if (normalizedInput.timeline?.length) {
      for (const event of normalizedInput.timeline) {
        try {
          await prisma.event.create({
            data: {
              title: event.title,
              description: event.description,
              eventDate: new Date(event.eventDate),
              eventType: event.eventType || 'general',
              significance: event.significance || 3,
              primaryActors: event.primaryActors ? JSON.stringify(event.primaryActors) : undefined,
            },
          });
          result.created.events++;
        } catch (e: any) {
          result.warnings.push(`Event "${event.title}": ${e.message}`);
        }
      }
    }

    // Step 8: Create suggested questions (as inactive, for admin review)
    if (normalizedInput.suggestedQuestions?.length) {
      for (const q of normalizedInput.suggestedQuestions) {
        try {
          const category = await prisma.category.findFirst({ where: { slug: q.category } });
          if (!category) {
            result.warnings.push(`Question: Category "${q.category}" not found`);
            continue;
          }
          await prisma.question.create({
            data: {
              text: q.text,
              categoryId: category.id,
              leftLabel: q.leftLabel,
              rightLabel: q.rightLabel,
              isActive: false, // Requires admin activation
            },
          });
          result.created.questions++;
        } catch (e: any) {
          result.warnings.push(`Question: ${e.message}`);
        }
      }
    }

  } catch (e: any) {
    result.success = false;
    result.errors.push(`Pipeline error: ${e.message}`);
  }

  return result;
}

type CanonicalizationDecision = {
  originalName: string;
  canonicalName?: string;
  canonicalType?: string;
  mergeWithExistingName?: string | null;
  drop?: boolean;
  reason?: string;
};

async function canonicalizeResearchInput(input: ResearchInput, warnings: string[]): Promise<ResearchInput> {
  const entities = [...(input.entities || [])];
  const relationships = [...(input.relationships || [])];
  const actions = [...(input.actions || [])];

  const candidateNames = Array.from(new Set([
    ...entities.map((e) => e.name),
    ...relationships.flatMap((r) => [r.sourceName, r.targetName]),
    ...actions.map((a) => a.actorName),
  ].filter(Boolean)));

  if (candidateNames.length === 0) return input;

  const existingActors = await prisma.politician.findMany({
    select: { name: true, type: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  let decisions: CanonicalizationDecision[] = [];
  try {
    const response = await callLLM([
      {
        role: 'system',
        content: `You are a node-canonicalization analyst for a political knowledge graph.
Given incoming node names and existing node names, infer canonical names/types, detect duplicates, and filter out overly broad/non-node concepts.

Return JSON array only:
[
  {
    "originalName": "incoming string",
    "canonicalName": "best canonical name",
    "canonicalType": "politician|donor|operative|organization|legislation|event|court_case|party|pac|corporation|lobbyist|media_figure|concept",
    "mergeWithExistingName": "exact existing node name if same entity, else null",
    "drop": false,
    "reason": "short reason"
  }
]

Rules:
- Merge spelling/name variants for the same real-world entity.
- Prefer specific real entities; mark broad buckets as drop=true with canonicalType=concept.
- For acts/bills/statutes/cases, do NOT classify as politician.
- Keep canonicalName stable and concise.`,
      },
      {
        role: 'user',
        content: `Incoming names:\n${candidateNames.map((n) => `- ${n}`).join('\n')}

Existing graph nodes:
${existingActors.map((a) => `- ${a.name} (${a.type})`).join('\n')}`,
      },
    ], { temperature: 0.1 });

    const parsed = parseJSONResponse(response.content);
    if (Array.isArray(parsed)) {
      decisions = parsed.map((d: any) => ({
        originalName: String(d?.originalName || ''),
        canonicalName: d?.canonicalName ? String(d.canonicalName) : undefined,
        canonicalType: d?.canonicalType ? String(d.canonicalType) : undefined,
        mergeWithExistingName: d?.mergeWithExistingName ? String(d.mergeWithExistingName) : null,
        drop: Boolean(d?.drop),
        reason: d?.reason ? String(d.reason) : undefined,
      })).filter((d: CanonicalizationDecision) => d.originalName);
    }
  } catch {
    // Fallback to deterministic logic below.
  }

  const decisionByName = new Map<string, CanonicalizationDecision>();
  for (const name of candidateNames) {
    const fromLLM = decisions.find((d) => d.originalName.toLowerCase() === name.toLowerCase());
    if (fromLLM) {
      decisionByName.set(name, fromLLM);
      continue;
    }

    const inferredType = inferTypeFromName(name);
    decisionByName.set(name, {
      originalName: name,
      canonicalName: name,
      canonicalType: inferredType,
      drop: false,
    });
  }

  const mapName = (rawName: string): string | null => {
    const d = decisionByName.get(rawName);
    if (d?.drop) return null;
    return d?.mergeWithExistingName || d?.canonicalName || rawName;
  };

  const mergedEntityMap = new Map<string, EntityInput>();
  for (const entity of entities) {
    const d = decisionByName.get(entity.name);
    if (d?.drop) {
      warnings.push(`Dropped broad/non-specific node "${entity.name}"${d.reason ? ` (${d.reason})` : ''}`);
      continue;
    }
    const canonicalName = d?.mergeWithExistingName || d?.canonicalName || entity.name;
    const canonicalType = mapEntityTypeToActorType(d?.canonicalType || entity.type);
    const key = canonicalName.toLowerCase();

    const existing = mergedEntityMap.get(key);
    if (!existing) {
      mergedEntityMap.set(key, {
        ...entity,
        name: canonicalName,
        type: canonicalType,
        aliases: Array.from(new Set([...(entity.aliases || []), entity.name].filter((a) => a !== canonicalName))),
      });
    } else {
      existing.aliases = Array.from(new Set([...(existing.aliases || []), ...(entity.aliases || []), entity.name]));
      existing.tags = Array.from(new Set([...(existing.tags || []), ...(entity.tags || [])]));
      if (!existing.description && entity.description) existing.description = entity.description;
      if (!existing.title && entity.title) existing.title = entity.title;
      if (!existing.affiliation && entity.affiliation) existing.affiliation = entity.affiliation;
    }
  }

  // Add synthetic entities for actor names that only appear in relationships/actions.
  for (const rawName of candidateNames) {
    const canonicalName = mapName(rawName);
    if (!canonicalName) {
      warnings.push(`Dropped broad/non-specific actor reference "${rawName}"`);
      continue;
    }
    const key = canonicalName.toLowerCase();
    if (!mergedEntityMap.has(key)) {
      const d = decisionByName.get(rawName);
      mergedEntityMap.set(key, {
        name: canonicalName,
        type: mapEntityTypeToActorType(d?.canonicalType || inferTypeFromName(rawName)),
        aliases: canonicalName !== rawName ? [rawName] : [],
      });
    }
  }

  const remappedRelationships = relationships
    .map((r) => {
      const sourceName = mapName(r.sourceName);
      const targetName = mapName(r.targetName);
      if (!sourceName || !targetName) return null;
      return { ...r, sourceName, targetName };
    })
    .filter((r): r is RelationshipInput => Boolean(r));

  const remappedActions = actions
    .map((a) => {
      const actorName = mapName(a.actorName);
      if (!actorName) return null;
      return { ...a, actorName };
    })
    .filter((a): a is ActionInput => Boolean(a));

  return {
    ...input,
    entities: Array.from(mergedEntityMap.values()),
    relationships: remappedRelationships,
    actions: remappedActions,
  };
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    // Strip parenthetical type qualifiers before anything else, e.g. "(politician)", "(organization)"
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"?]/g, ' ')
    .replace(/\b(the|of|and|for|to|in|on|at|by|corp|corporation|inc|incorporated|co|company|ltd|llc|plc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNoYear(value: string): string {
  return normalizeForMatch(value).replace(/\b(17|18|19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeForMatch(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeForMatch(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  Array.from(ta).forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / Math.max(ta.size, tb.size);
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function findBestEntityMatch(name: string, entities: EntityInput[]): EntityInput | undefined {
  const exact = entities.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (exact) return exact;

  const n1 = normalizeForMatch(name);
  const n1NoYear = normalizeNoYear(name);
  let best: { entity: EntityInput; score: number } | null = null;

  for (const entity of entities) {
    const n2 = normalizeForMatch(entity.name);
    const n2NoYear = normalizeNoYear(entity.name);
    const score = Math.max(
      n1 === n2 ? 1 : 0,
      n1NoYear && n2NoYear && n1NoYear === n2NoYear ? 0.95 : 0,
      tokenSimilarity(name, entity.name),
    );
    if (!best || score > best.score) best = { entity, score };
  }

  return best && best.score >= 0.85 ? best.entity : undefined;
}

function mapEntityTypeToActorType(type?: string): string {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return 'politician';
  if (['person', 'politician', 'judge', 'senator', 'representative', 'governor', 'official'].includes(t)) return 'politician';
  if (['donor', 'megadonor', 'philanthropist', 'funder', 'benefactor', 'financier'].includes(t)) return 'donor';
  if (['operative', 'strategist', 'fixer', 'advisor', 'political_consultant', 'architect'].includes(t)) return 'operative';
  if (['organization', 'org', 'institution', 'think_tank', 'nonprofit', 'ngo'].includes(t)) return 'organization';
  if (['legislation', 'law', 'act', 'bill', 'statute'].includes(t)) return 'legislation';
  if (['event', 'incident', 'protest', 'hearing', 'election'].includes(t)) return 'event';
  if (['court_case', 'case', 'legal_case'].includes(t)) return 'court_case';
  if (['party', 'pac', 'corporation', 'lobbyist', 'media_figure'].includes(t)) return t;
  if (t.includes('act') || t.includes('bill') || t.includes('statute')) return 'legislation';
  if (t.includes('event') || t.includes('hearing') || t.includes('protest') || t.includes('election')) return 'event';
  if (t.includes('court') || t.includes('v.')) return 'court_case';
  if (t.includes('donor') || t.includes('funder')) return 'donor';
  if (t.includes('operative') || t.includes('strategist')) return 'operative';
  return t;
}

function inferTypeFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\b(act|bill|statute|code|amendment)\b/.test(n)) return 'legislation';
  if (/\b(riot|protest|hearing|election|scandal|insurrection|summit|conference)\b/.test(n)) return 'event';
  if (/\bv\.\b|\bvs\.\b|\bversus\b|\bcourt\b/.test(n)) return 'court_case';
  if (/\b(committee|association|institute|department|agency|union|coalition|council|commission)\b/.test(n)) return 'organization';
  return 'politician';
}

// ── Helper: resolve or create entity ──

async function resolveOrCreateEntity(input: EntityInput): Promise<string> {
  // Try to find by name or alias
  const existing = await prisma.entity.findFirst({
    where: {
      OR: [
        { name: input.name },
        ...(input.aliases?.map(a => ({ name: a })) || []),
      ],
    },
  });

  if (existing) {
    // Merge tags if new ones provided (gracefully degrades if client is stale)
    if (input.tags?.length) {
      try {
        const existingTags: string[] = (existing as any).tags ? JSON.parse((existing as any).tags) : [];
        const merged = Array.from(new Set([...existingTags, ...input.tags]));
        if (merged.length > existingTags.length) {
          await prisma.$executeRawUnsafe(
            `UPDATE Entity SET tags = ? WHERE id = ?`,
            JSON.stringify(merged), existing.id
          );
        }
      } catch (_) { /* tags column may not be recognized by stale client — skip */ }
    }
    return existing.id;
  }

  const record = await prisma.entity.create({
    data: {
      name: input.name,
      type: mapEntityTypeToActorType(input.type),
      description: input.description,
      title: input.title,
      affiliation: input.affiliation,
      aliases: input.aliases ? JSON.stringify(input.aliases) : undefined,
    },
  });

  // Write tags via raw SQL to bypass stale client
  if (input.tags?.length) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE Entity SET tags = ? WHERE id = ?`,
        JSON.stringify(input.tags), record.id
      );
    } catch (_) { /* skip if column not ready */ }
  }

  return record.id;
}

// ── Helper: resolve or create actor (Politician table) ──

async function resolveOrCreateActor(name: string, entityInfo?: EntityInput): Promise<string> {
  let existing = await prisma.politician.findFirst({ where: { name } });

  // If exact match misses, try canonical/fuzzy merge against existing nodes.
  if (!existing) {
    const allActors = await prisma.politician.findMany({
      select: { id: true, name: true, tags: true },
    });
    const normalizedName = normalizeForMatch(name);
    const normalizedNoYear = normalizeNoYear(name);

    let best: { id: string; score: number } | null = null;
    for (const actor of allActors) {
      const n2 = normalizeForMatch(actor.name);
      const n2NoYear = normalizeNoYear(actor.name);
      const score = Math.max(
        normalizedName === n2 ? 1 : 0,
        normalizedNoYear && n2NoYear && normalizedNoYear === n2NoYear ? 0.95 : 0,
        tokenSimilarity(name, actor.name),
      );
      if (!best || score > best.score) best = { id: actor.id, score };
    }

    if (best && best.score >= 0.9) {
      existing = await prisma.politician.findUnique({ where: { id: best.id } });
    }
  }

  if (existing) {
    // Persist newly seen name variants as aliases to improve future matching.
    const candidateAliases = Array.from(new Set([
      name,
      ...(entityInfo?.aliases || []),
    ].map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== existing!.name.toLowerCase())));
    if (candidateAliases.length > 0) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ aliases: string | null }>>(
          `SELECT aliases FROM Politician WHERE id = ? LIMIT 1`,
          existing.id
        );
        const existingAliases = parseStringArray(rows?.[0]?.aliases || null);
        const mergedAliases = Array.from(new Set([...existingAliases, ...candidateAliases]));
        if (mergedAliases.length > existingAliases.length) {
          await prisma.$executeRawUnsafe(
            `UPDATE Politician SET aliases = ? WHERE id = ?`,
            JSON.stringify(mergedAliases),
            existing.id
          );
        }
      } catch (_) { /* aliases column may not be recognized by stale client — skip */ }
    }

    // Merge tags if new ones provided (gracefully degrades if client is stale)
    if (entityInfo?.tags?.length) {
      try {
        const existingTags: string[] = (existing as any).tags ? JSON.parse((existing as any).tags) : [];
        const merged = Array.from(new Set([...existingTags, ...entityInfo.tags]));
        if (merged.length > existingTags.length) {
          await prisma.$executeRawUnsafe(
            `UPDATE Politician SET tags = ? WHERE id = ?`,
            JSON.stringify(merged), existing.id
          );
        }
      } catch (_) { /* tags column may not be recognized by stale client — skip */ }
    }
    return existing.id;
  }

  const record = await prisma.politician.create({
    data: {
      name,
      type: mapEntityTypeToActorType(entityInfo?.type),
      description: entityInfo?.description,
      title: entityInfo?.title,
      affiliation: entityInfo?.affiliation,
    },
  });

  if (entityInfo?.aliases?.length) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE Politician SET aliases = ? WHERE id = ?`,
        JSON.stringify(Array.from(new Set(entityInfo.aliases.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim())))),
        record.id
      );
    } catch (_) { /* aliases column may not be recognized by stale client — skip */ }
  }

  // Try to auto-attach a representative portrait/logo for new actors.
  const suggestedImage = await suggestActorImage(record.name, record.type);
  if (suggestedImage?.imageUrl) {
    try {
      await prisma.politician.update({
        where: { id: record.id },
        data: { imageUrl: suggestedImage.imageUrl },
      });
    } catch {
      // Keep ingestion resilient; image fetch is best-effort only.
    }
  }

  // Write tags via raw SQL to bypass stale client
  if (entityInfo?.tags?.length) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE Politician SET tags = ? WHERE id = ?`,
        JSON.stringify(entityInfo.tags), record.id
      );
    } catch (_) { /* skip if column not ready */ }
  }

  return record.id;
}

// ── Helper: create evidence with tags ──

async function createEvidence(input: EvidenceInput): Promise<string> {
  // Resolve category
  let categoryId: string | undefined;
  if (input.suggestedCategory) {
    const cat = await prisma.category.findFirst({ where: { slug: input.suggestedCategory } });
    if (cat) categoryId = cat.id;
  }

  const record = await prisma.evidence.create({
    data: {
      title: input.title,
      summary: input.summary,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      content: input.content,
      eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
      dateAccuracy: input.dateAccuracy || 'day',
      sourceClassification: input.sourceClassification || 'secondary_source',
      verificationStatus: input.verificationStatus || 'single_source',
      corroborationCount: input.corroborationCount || 1,
      independentSourceCount: input.independentSourceCount || 1,
      politicalContext: input.politicalContext || 'neutral',
      categoryId,
      isProcessed: true,
      suggestedTags: input.suggestedTags ? JSON.stringify(input.suggestedTags) : undefined,
    },
  });

  // Link tags
  if (input.suggestedTags?.length) {
    for (const tagName of input.suggestedTags) {
      const tag = await prisma.tag.findFirst({
        where: {
          OR: [
            { name: tagName },
            { synonyms: { some: { phrase: tagName } } },
          ],
        },
      });
      if (tag) {
        await prisma.evidenceTag.create({
          data: { evidenceId: record.id, tagId: tag.id },
        }).catch(() => {}); // Ignore duplicate
      }
    }
  }

  return record.id;
}

// ── Manual evidence creation (simpler path for direct upload) ──

export type ManualEvidenceInput = {
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceName?: string;
  content?: string;
  eventDate?: string;
  sourceClassification?: string;
  verificationStatus?: string;
  categorySlug?: string;
  tagNames?: string[];
};

export async function createManualEvidence(input: ManualEvidenceInput): Promise<{ id: string; title: string }> {
  let categoryId: string | undefined;
  if (input.categorySlug) {
    const cat = await prisma.category.findFirst({ where: { slug: input.categorySlug } });
    if (cat) categoryId = cat.id;
  }

  const record = await prisma.evidence.create({
    data: {
      title: input.title,
      summary: input.summary,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      content: input.content,
      eventDate: input.eventDate ? new Date(input.eventDate) : undefined,
      sourceClassification: input.sourceClassification || 'secondary_source',
      verificationStatus: input.verificationStatus || 'single_source',
      corroborationCount: 1,
      independentSourceCount: 1,
      politicalContext: 'neutral',
      categoryId,
      isProcessed: true,
    },
  });

  if (input.tagNames?.length) {
    for (const tagName of input.tagNames) {
      const tag = await prisma.tag.findFirst({
        where: {
          OR: [
            { name: tagName },
            { synonyms: { some: { phrase: tagName } } },
          ],
        },
      });
      if (tag) {
        await prisma.evidenceTag.create({
          data: { evidenceId: record.id, tagId: tag.id },
        }).catch(() => {});
      }
    }
  }

  return { id: record.id, title: record.title };
}
