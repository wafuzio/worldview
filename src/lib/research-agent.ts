// ============================================================
// RESEARCH AGENT
// Automated topic research pipeline that:
//   1. Picks topics from the ResearchQueue
//   2. Researches them via LLM (same pipeline as /api/ingest/topic)
//   3. Ingests results into the database
//   4. Queues suggested follow-up topics
// ============================================================

import { prisma } from './db';
import { callLLM, parseJSONResponse } from './llm';
import { ingestResearch, ResearchInput } from './pipeline';
import { logIngest } from './ingest-log';
import { prioritizeSuggestedTopics, SuggestedTopic } from './topic-prioritization';

// Re-use the research prompt from the topic ingest route
const CATEGORY_SLUGS = [
  'economy-fiscal-policy',
  'healthcare-social-safety-net',
  'immigration-border-policy',
  'criminal-justice-public-safety',
  'education-knowledge-institutions',
  'environment-energy',
  'democratic-institutions-rule-of-law',
  'institutional-integrity-accountability',
  'money-in-politics',
  'federalism-power-distribution',
  'foreign-policy-national-security',
  'civil-rights-social-equality',
  'technology-information-media',
  'personal-liberty-moral-authority',
];

const RESEARCH_SYSTEM_PROMPT = `You are a research assistant for Worldview, a political self-awareness engine. Your job is to find, source, and structure evidence about political topics. You are NOT an opinion engine. You are a sourcing machine.

CITATION RULES — NON-NEGOTIABLE:
- EVERY evidence item MUST include a sourceUrl with a real, verifiable URL to the original source.
- Acceptable sources: government websites (.gov), court records (supremecourt.gov, courtlistener.com), congressional records (congress.gov, govtrack.us), FEC filings (fec.gov), official vote records, reporting from established outlets (NYT, Washington Post, AP, Reuters, ProPublica, The Intercept, NPR, PBS, WSJ, etc.), academic papers, opensecrets.org for campaign finance data, and official organizational documents.
- For court cases: link to the actual opinion (supremecourt.gov, courtlistener.com, law.cornell.edu).
- For legislation: link to congress.gov with the bill number.
- For FEC/campaign finance data: link to fec.gov or opensecrets.org.
- For voting records: link to govtrack.us, voteview.com, or the official roll call page.
- If you cannot provide a real URL, set verificationStatus to "inconclusive" and write "URL not confirmed" in sourceUrl. DO NOT fabricate URLs.
- Include the author's name in the content field when available.

GENERAL RULES:
1. Every claim must trace to a verifiable source with a URL.
2. Never editorialize in the data layer. Interpretation goes in "analyses" with explicit classification.
3. Distinguish between what happened (data) and what it means (analysis).
4. When multiple sources say the same thing, note the INDEPENDENT source count (5 articles citing the same AP report = 1 independent source).
5. Date everything. If you can't pin an exact date, note the accuracy level.
6. For political actions, classify the action type precisely. A committee kill is not the same as a floor vote.
7. For relationships between actors, assign the correct tier:
   - Tier 1 (documented): FEC records, official appointments, employment records, roll call votes
   - Tier 2 (interactional): meeting logs, correspondence, testimony, lobbying disclosures
   - Tier 3 (analytical): requires explicit reasoning — influence, protection, enablement. You MUST include a corresponding entry in the "analyses" array for every Tier 3 relationship.
8. For each evidence item, include FULL relevant content — quotes, data points, specifics. Enough that someone could fact-check without visiting the source.
9. When evidence implicates actors on BOTH sides, include all of it proportionally.

CATEGORY SLUGS (use these exactly):
${CATEGORY_SLUGS.join(', ')}

RELATIONSHIP TYPES BY TIER:
Tier 1 (documented): funded_by, appointed_by, employed_by, voted_for, donated_to, contracted_with, endorsed
Tier 2 (interactional): met_with, communicated_with, testified_before, lobbied, briefed_by, served_on_board_with
Tier 3 (analytical — MUST have matching analyses entry): influenced_by, aligned_with, protected_by, enabled, shielded_from_investigation

ACTION TYPES:
voted_yes, voted_no, sponsored, blocked, procedural_block, symbolic_vote, signed, vetoed, executive_order, appointed, public_stance, reversed_position, abstained, attempted_failed

ENTITY TYPE CLASSIFICATION — use the most specific type:
- politician: elected officials, appointed government officials, judges — people who hold/held state power
- donor: individuals whose primary relevance is funding political activity (Soros, Koch, Adelson, Mercer, Crow). NOT politicians who also donate — only people whose structural role in the network is as a money source
- operative: political strategists, fixers, dark money architects who aren't elected, aren't lobbyists, aren't media — their power is institutional engineering (Leonard Leo, Karl Rove, Roger Stone, Steve Bannon, Grover Norquist)
- lobbyist: registered or de facto lobbyists — influence-for-hire professionals
- media_figure: people whose power is narrative control (Murdoch, Carlson, Maddow)
- organization, corporation, pac, party: institutional entities
- legislation, court_case, event: non-person nodes

Return your findings as a JSON object with this exact structure:

{
  "topic": "Brief description of what was researched",
  "summary": "2-3 sentence overview of findings",
  "evidence": [
    {
      "title": "Title of the evidence item",
      "summary": "Neutral 1-2 sentence summary of what this evidence shows",
      "sourceUrl": "REQUIRED: Real URL to original source",
      "sourceName": "Name of publication/institution",
      "eventDate": "YYYY-MM-DD or YYYY-MM or YYYY",
      "dateAccuracy": "day|month|year|approximate",
      "sourceClassification": "primary_source|secondary_source|opinion_editorial|raw_data",
      "verificationStatus": "verified|single_source|contested|inconclusive",
      "corroborationCount": 1,
      "independentSourceCount": 1,
      "politicalContext": "supports_left_position|supports_right_position|neutral|implicates_both",
      "content": "Full relevant text or detailed description",
      "suggestedTags": ["Tag Name"],
      "suggestedCategory": "slug-here"
    }
  ],
  "entities": [
    {
      "name": "Full name",
      "type": "politician|donor|operative|lobbyist|media_figure|organization|corporation|pac|party|legislation|court_case|event",
      "description": "Brief description",
      "title": "Current or relevant title — for donors include primary source of wealth, for operatives include primary institutional role",
      "affiliation": "Party or organizational affiliation",
      "aliases": ["Alternative names"],
      "tags": ["Freeform tags for character mapping"]
    }
  ],
  "relationships": [
    {
      "sourceName": "Name of source actor",
      "targetName": "Name of target actor",
      "tier": "documented|interactional|analytical",
      "relationshipType": "type from list above",
      "description": "What this relationship entails",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "amount": null,
      "significance": 3,
      "sourceEvidence": "Title of evidence item supporting this"
    }
  ],
  "actions": [
    {
      "actorName": "Name of the politician/actor",
      "title": "Brief title of the action",
      "description": "What happened",
      "actionDate": "YYYY-MM-DD",
      "actionType": "type from list above",
      "targetLegislation": "Bill name/number if applicable",
      "context": "Important context",
      "framingAccuracy": "consistent|misleading|opposite",
      "sourceUrl": "URL to source"
    }
  ],
  "analyses": [
    {
      "title": "Title of the interpretive point",
      "content": "The analysis — labeled interpretation, not data",
      "claimClassification": "consistent_with_record|in_tension_with_record|contradicted_by_record|factually_false",
      "analysisType": "context|discrepancy|pattern|correction",
      "relatedEvidence": ["Titles of evidence items this analysis draws from"]
    }
  ],
  "timeline": [
    {
      "title": "Event title",
      "description": "What happened",
      "eventDate": "YYYY-MM-DD",
      "eventType": "legislation|court_decision|vote|speech|scandal|appointment|executive_order",
      "significance": 3,
      "primaryActors": ["Names of key people/orgs involved"]
    }
  ],
  "suggestedQuestions": [
    {
      "text": "A neutral quiz question this research suggests",
      "category": "slug-here",
      "leftLabel": "Left-leaning answer framing",
      "rightLabel": "Right-leaning answer framing"
    }
  ],
  "suggestedTopics": [
    {
      "topic": "A specific follow-up research topic",
      "rationale": "Why this matters",
      "priority": "high|medium|low"
    }
  ]
}

SUGGESTED TOPICS RULES:
- Suggest 3-5 follow-up research topics that would deepen understanding of this subject.
- Prioritize topics that reveal CONNECTIONS to other power structures, money flows, or institutional patterns.
- Prioritize WHOLE-DATABASE importance over niche detail. If a major principal node is missing, suggest that before peripheral actors.
- Include at least one topic that follows the MONEY (funding, donors, financial beneficiaries).
- Include at least one topic that follows the PEOPLE (who moved where, revolving door, appointments).
- Include at least one topic that examines the COUNTER-NARRATIVE (what does the other side say, and what's the evidence for their position).
- Include at least TWO "missing-link" connector topics: likely relationships that probably exist but are not yet established in the map.
- For missing-link topics, explicitly name both endpoints and the hypothesized tie. Example format: "Verify whether [Entity A] had [relationship type] ties with [Entity B] during [years], using primary-source records."
- Prefer plausible structural pairs when proposing missing links (corporation↔trade association, donor↔PAC, regulator↔contractor, executive↔lobbying firm). A known-style example is checking whether Philip Morris and the Tobacco Institute have direct documented links in a specific period.
- These are for human review, not auto-ingested. Be specific enough that someone could paste the topic directly into this research tool.

IMPORTANT:
- All arrays can be empty if nothing relevant was found for that section.
- Do NOT fabricate sources. If you're unsure about a detail, set verificationStatus to "inconclusive".
- Return ONLY the JSON object. No commentary before or after.`;

const DEEP_FOLLOW_UP_PROMPT = `Based on the evidence and entities you found in the first pass, now do a deeper investigation:

1. Identify any additional RELATIONSHIPS between the actors — especially Tier 2 (interactional) and Tier 3 (analytical) connections that a surface-level pass would miss.
2. Add any ANALYSES that connect patterns across the evidence items.
3. Flag any DISCREPANCIES between actors' public statements and their actual records on this topic.
4. Suggest TIMELINE events that provide important context but weren't covered in the initial evidence.

Return your findings in the same JSON structure. Only include NEW items not already covered in the first pass. Empty arrays are fine for sections with nothing new.`;

const AGENT_LLM_TIMEOUT_MS = (() => {
  const raw = Number(process.env.AGENT_LLM_TIMEOUT_MS ?? 360_000);
  if (!Number.isFinite(raw)) return 360_000;
  return Math.max(120_000, Math.min(raw, 12 * 60_000));
})();

// ── Types ──

type AgentLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
};

export type AgentEvent = {
  type: 'start' | 'topic_start' | 'topic_phase' | 'topic_done' | 'topic_error' | 'queued' | 'complete' | 'error';
  topic?: string;
  index?: number;
  total?: number;
  phase?: string;
  detail?: string;
  stats?: Record<string, number>;
};

export type AgentRunConfig = {
  maxTopics?: number;     // How many queue items to process (default 5)
  depth?: 'standard' | 'deep';
  autoQueue?: boolean;    // Whether to auto-queue suggested topics (default true)
  runType?: 'manual' | 'auto' | 'discovery';
  onEvent?: (event: AgentEvent) => void;
};

export type AgentRunResult = {
  runId: string;
  status: 'completed' | 'failed';
  topicsProcessed: number;
  topicsSucceeded: number;
  topicsFailed: number;
  topicsQueued: number;
  evidenceCreated: number;
  entitiesCreated: number;
  newNodes?: NewNodeSummary[];
  log: AgentLogEntry[];
};

export type NewNodeSummary = {
  id: string;
  name: string;
  type: string;
  tags: string[];
  totalConnections: number;
  connectionsToExistingNodes: {
    relationshipId: string;
    relationshipType: string;
    tier: string;
    significance: number;
    direction: 'outbound' | 'inbound';
    otherNodeId: string;
    otherNodeName: string;
  }[];
};

// ── Main agent runner ──

export async function runResearchAgent(config: AgentRunConfig = {}): Promise<AgentRunResult> {
  const maxTopics = config.maxTopics ?? 5;
  const depth = config.depth ?? 'standard';
  const autoQueue = config.autoQueue ?? true;
  const runType = config.runType ?? 'manual';
  const emit = config.onEvent ?? (() => {});

  const log: AgentLogEntry[] = [];
  const addLog = (level: AgentLogEntry['level'], message: string, data?: any) => {
    const entry = { timestamp: new Date().toISOString(), level, message, data };
    log.push(entry);
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '→';
    console.log(`[agent] ${prefix} ${message}`);
  };

  // Create the run record
  const run = await prisma.agentRun.create({
    data: {
      runType,
      status: 'running',
      maxTopics,
      depth,
    },
  });

  addLog('info', `Agent run started: ${run.id} (type: ${runType}, max: ${maxTopics}, depth: ${depth})`);

  let topicsProcessed = 0;
  let topicsSucceeded = 0;
  let topicsFailed = 0;
  let topicsQueued = 0;
  const maxSuggestedTopicsPerRun = 5;
  let remainingSuggestedBudget = maxSuggestedTopicsPerRun;
  let totalEvidence = 0;
  let totalEntities = 0;

  try {
    // Fetch pending topics from queue, ordered by priority then age
    const priorityOrder = { urgent: -1, high: 0, medium: 1, low: 2 };
    const pending = await prisma.researchQueue.findMany({
      where: {
        status: 'pending',
        attempts: { lt: 3 },
      },
      orderBy: [
        { createdAt: 'asc' },
      ],
      take: 500, // Fetch a broad window, then enforce run ordering in JS
    });

    // Sort by priority (high first), then by creation date
    const sorted = pending.sort((a, b) => {
      const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
      const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
      if (pa !== pb) return pa - pb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    }).slice(0, maxTopics);

    if (sorted.length === 0) {
      addLog('info', 'No pending topics in queue. Nothing to do.');
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          log: JSON.stringify(log),
        },
      });
      return {
        runId: run.id,
        status: 'completed',
        topicsProcessed: 0,
        topicsSucceeded: 0,
        topicsFailed: 0,
        topicsQueued: 0,
        evidenceCreated: 0,
        entitiesCreated: 0,
        newNodes: [],
        log,
      };
    }

    addLog('info', `Found ${sorted.length} topics to process`);
    emit({ type: 'start', total: sorted.length, detail: `Processing ${sorted.length} topics` });

    for (const item of sorted) {
      topicsProcessed++;
      addLog('info', `[${topicsProcessed}/${sorted.length}] Researching: "${item.topic}"`);
      emit({ type: 'topic_start', topic: item.topic, index: topicsProcessed, total: sorted.length, phase: 'starting' });

      // Mark as processing
      await prisma.researchQueue.update({
        where: { id: item.id },
        data: {
          status: 'processing',
          attempts: item.attempts + 1,
          processedByRunId: run.id,
        },
      });

      try {
        const result = await researchAndIngest(item.topic, depth, addLog, emit, topicsProcessed, sorted.length);

        // Update queue item with results
        await prisma.researchQueue.update({
          where: { id: item.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
            evidenceCreated: result.created.evidence,
            entitiesCreated: result.created.entities,
            relationshipsCreated: result.created.relationships,
          },
        });

        totalEvidence += result.created.evidence;
        totalEntities += result.created.entities;
        topicsSucceeded++;

        addLog('info', `Completed "${item.topic}": ${result.created.evidence} evidence, ${result.created.entities} entities, ${result.created.relationships} relationships`);
        emit({
          type: 'topic_done', topic: item.topic, index: topicsProcessed, total: sorted.length,
          detail: `+${result.created.evidence} evidence, +${result.created.entities} entities, +${result.created.relationships} relationships`,
          stats: { evidence: result.created.evidence, entities: result.created.entities, relationships: result.created.relationships },
        });

        // Queue suggested follow-up topics (strict run-wide top-5 cap)
        if (autoQueue && result.suggestedTopics?.length && remainingSuggestedBudget > 0) {
          const prioritized = await prioritizeSuggestedTopics(
            result.suggestedTopics as SuggestedTopic[],
            remainingSuggestedBudget
          );
          const queued = await queueSuggestedTopics(prioritized, run.id, addLog, remainingSuggestedBudget);
          topicsQueued += queued;
          remainingSuggestedBudget -= queued;
          if (queued > 0) {
            emit({ type: 'queued', detail: `${queued} follow-up topics queued`, stats: { queued } });
          }
        } else if (autoQueue && remainingSuggestedBudget <= 0 && result.suggestedTopics?.length) {
          addLog('info', 'Suggested-topic queue budget reached (max 5 per run); skipping additional suggestions');
        }

        if (result.warnings.length > 0) {
          addLog('warn', `Warnings for "${item.topic}": ${result.warnings.length} warnings`, result.warnings.slice(0, 5));
        }

      } catch (err: any) {
        topicsFailed++;
        const errorMsg = err.message || String(err);
        addLog('error', `Failed "${item.topic}": ${errorMsg}`);
        emit({ type: 'topic_error', topic: item.topic, index: topicsProcessed, total: sorted.length, detail: errorMsg });

        await prisma.researchQueue.update({
          where: { id: item.id },
          data: {
            status: item.attempts + 1 >= item.maxAttempts ? 'failed' : 'pending',
            error: errorMsg,
          },
        });
      }

      // Small delay between topics to be respectful of rate limits
      if (topicsProcessed < sorted.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    addLog('info', `Run complete: ${topicsSucceeded}/${topicsProcessed} succeeded, ${topicsQueued} new topics queued`);

    const completedAt = new Date();
    const newNodes = await collectNewNodesForRun(run.startedAt, completedAt);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt,
        topicsProcessed,
        topicsSucceeded,
        topicsFailed,
        topicsDiscovered: topicsQueued,
        evidenceCreated: totalEvidence,
        entitiesCreated: totalEntities,
        log: JSON.stringify(log),
      },
    });

    return {
      runId: run.id,
      status: 'completed',
      topicsProcessed,
      topicsSucceeded,
      topicsFailed,
      topicsQueued,
      evidenceCreated: totalEvidence,
      entitiesCreated: totalEntities,
      newNodes,
      log,
    };

  } catch (err: any) {
    addLog('error', `Agent run failed: ${err.message}`);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        topicsProcessed,
        topicsSucceeded,
        topicsFailed,
        log: JSON.stringify(log),
      },
    });

    return {
      runId: run.id,
      status: 'failed',
      topicsProcessed,
      topicsSucceeded,
      topicsFailed,
      topicsQueued,
      evidenceCreated: totalEvidence,
      entitiesCreated: totalEntities,
      newNodes: [],
      log,
    };
  }
}

async function collectNewNodesForRun(startedAt: Date, completedAt: Date): Promise<NewNodeSummary[]> {
  const newNodes = await prisma.politician.findMany({
    where: {
      createdAt: {
        gte: startedAt,
        lte: completedAt,
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      tags: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (newNodes.length === 0) return [];

  const newNodeIds = newNodes.map((n) => n.id);
  const relationships = await prisma.actorRelationship.findMany({
    where: {
      OR: [
        { sourceId: { in: newNodeIds } },
        { targetId: { in: newNodeIds } },
      ],
    },
    select: {
      id: true,
      sourceId: true,
      targetId: true,
      relationshipType: true,
      tier: true,
      significance: true,
      source: { select: { id: true, name: true, createdAt: true } },
      target: { select: { id: true, name: true, createdAt: true } },
    },
  });

  return newNodes.map((node) => {
    const nodeRels = relationships.filter((r) => r.sourceId === node.id || r.targetId === node.id);
    const connectionsToExistingNodes = nodeRels
      .map((r) => {
        const outbound = r.sourceId === node.id;
        const other = outbound ? r.target : r.source;
        if (!other || other.createdAt >= startedAt) return null;
        return {
          relationshipId: r.id,
          relationshipType: r.relationshipType,
          tier: r.tier,
          significance: r.significance,
          direction: outbound ? 'outbound' as const : 'inbound' as const,
          otherNodeId: other.id,
          otherNodeName: other.name,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      tags: parseTags(node.tags),
      totalConnections: nodeRels.length,
      connectionsToExistingNodes,
    };
  });
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((t) => String(t)) : [];
  } catch {
    return [];
  }
}

// ── Research a single topic (same logic as /api/ingest/topic) ──

type ResearchResult = {
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
  warnings: string[];
  suggestedTopics?: { topic: string; rationale: string; priority: string }[];
};

async function researchAndIngest(
  topic: string,
  depth: string,
  addLog: (level: AgentLogEntry['level'], message: string, data?: any) => void,
  emit?: (event: AgentEvent) => void,
  index?: number,
  total?: number,
): Promise<ResearchResult> {
  const send = emit ?? (() => {});

  // Helper: run an async fn while emitting elapsed-time heartbeats every 5s
  async function withHeartbeat<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      send({ type: 'topic_phase', topic, index, total, phase: `${label} (${elapsed}s)` });
    }, 5000);
    try {
      return await fn();
    } finally {
      clearInterval(interval);
    }
  }

  // First pass
  addLog('info', `  LLM call: first pass for "${topic}"`);
  send({
    type: 'topic_phase',
    topic,
    index,
    total,
    phase: `Calling LLM — first pass (timeout ${Math.round(AGENT_LLM_TIMEOUT_MS / 60000)}m)`,
  });
  const firstPass = await withHeartbeat('LLM thinking — first pass', () => callLLM([
    { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
    { role: 'user', content: `RESEARCH REQUEST:\n${topic.trim()}` },
  ], { temperature: 0.2, timeoutMs: AGENT_LLM_TIMEOUT_MS, retries: 2 }));

  if (firstPass.error || !firstPass.content) {
    throw new Error(`LLM error on first pass: ${firstPass.error || 'No response'}`);
  }

  const firstLen = firstPass.content.length;
  addLog('info', `  LLM responded (provider: ${firstPass.provider || 'unknown'}, model: ${firstPass.model || 'unknown'}, ${firstLen} chars)`);
  send({ type: 'topic_phase', topic, index, total, phase: `LLM responded (${Math.round(firstLen / 1000)}k chars) — parsing JSON` });

  const firstData = parseJSONResponse(firstPass.content);
  if (!firstData) {
    throw new Error(`Failed to parse LLM response as JSON. First 200 chars: ${firstPass.content.substring(0, 200)}`);
  }

  let mergedData: ResearchInput = firstData;

  // Deep mode: second pass
  if (depth === 'deep') {
    addLog('info', `  LLM call: deep follow-up for "${topic}"`);
    send({
      type: 'topic_phase',
      topic,
      index,
      total,
      phase: `Calling LLM — deep follow-up (timeout ${Math.round(AGENT_LLM_TIMEOUT_MS / 60000)}m)`,
    });
    const secondPass = await withHeartbeat('LLM thinking — deep pass', () => callLLM([
      { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
      { role: 'user', content: `RESEARCH REQUEST:\n${topic.trim()}` },
      { role: 'assistant', content: JSON.stringify(firstData) },
      { role: 'user', content: DEEP_FOLLOW_UP_PROMPT },
    ], { temperature: 0.3, timeoutMs: AGENT_LLM_TIMEOUT_MS, retries: 2 }));

    if (secondPass.content) {
      const secondData = parseJSONResponse(secondPass.content);
      if (secondData) {
        mergedData = mergeResearchPasses(firstData, secondData);
        addLog('info', '  Merged deep pass results');
      } else {
        addLog('warn', '  Deep pass returned unparseable JSON, using first pass only');
      }
    }
  }

  // Save raw output to disk
  logIngest('topic', mergedData, { depth, originalQuery: topic, source: 'agent' });

  // Ingest into database
  addLog('info', '  Ingesting into database...');
  send({ type: 'topic_phase', topic, index, total, phase: 'Ingesting into database' });
  const result = await ingestResearch(mergedData);

  return {
    created: result.created,
    warnings: [...result.errors, ...result.warnings],
    suggestedTopics: mergedData.suggestedTopics,
  };
}

// ── Queue suggested topics (dedup against existing queue + completed) ──

async function queueSuggestedTopics(
  topics: { topic: string; rationale: string; priority: string }[],
  runId: string,
  addLog: (level: AgentLogEntry['level'], message: string, data?: any) => void,
  maxToQueue: number
): Promise<number> {
  let queued = 0;

  for (const t of topics) {
    if (queued >= maxToQueue) break;

    // Check for duplicates: exact match on topic text or similar
    const existing = await prisma.researchQueue.findFirst({
      where: {
        topic: { contains: t.topic.substring(0, 50) },
        status: { in: ['pending', 'processing', 'completed'] },
      },
    });

    if (existing) {
      addLog('info', `  Skip queuing (already exists): "${t.topic.substring(0, 60)}..."`);
      continue;
    }

    await prisma.researchQueue.create({
      data: {
        topic: t.topic,
        rationale: t.rationale,
        priority: t.priority || 'medium',
        source: 'suggested',
        sourceRunId: runId,
        status: 'pending',
      },
    });

    queued++;
    addLog('info', `  Queued [${t.priority}]: "${t.topic.substring(0, 80)}..."`);
  }

  return queued;
}

// ── Merge two research passes ──

function mergeResearchPasses(first: any, second: any): ResearchInput {
  const mergeArrays = (a: any[] = [], b: any[] = [], keyField: string) => {
    const seen = new Set(a.map((item) => item[keyField]?.toLowerCase()));
    const unique = b.filter((item) => !seen.has(item[keyField]?.toLowerCase()));
    return [...a, ...unique];
  };

  return {
    topic: first.topic || second.topic,
    summary: first.summary || second.summary,
    evidence: mergeArrays(first.evidence, second.evidence, 'title'),
    entities: mergeArrays(first.entities, second.entities, 'name'),
    relationships: [...(first.relationships || []), ...(second.relationships || [])],
    actions: mergeArrays(first.actions, second.actions, 'title'),
    analyses: mergeArrays(first.analyses, second.analyses, 'title'),
    timeline: mergeArrays(first.timeline, second.timeline, 'title'),
    suggestedQuestions: [
      ...(first.suggestedQuestions || []),
      ...(second.suggestedQuestions || []),
    ],
    suggestedTopics: [
      ...(first.suggestedTopics || []),
      ...(second.suggestedTopics || []),
    ],
  };
}

// ── Queue management helpers ──

export async function addToQueue(
  topic: string,
  options?: {
    rationale?: string;
    priority?: string;
    depth?: string;
    source?: string;
  }
): Promise<string> {
  const item = await prisma.researchQueue.create({
    data: {
      topic,
      rationale: options?.rationale,
      priority: options?.priority || 'medium',
      depth: options?.depth || 'standard',
      source: options?.source || 'manual',
    },
  });
  return item.id;
}

export async function getQueueStatus() {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.researchQueue.count({ where: { status: 'pending' } }),
    prisma.researchQueue.count({ where: { status: 'processing' } }),
    prisma.researchQueue.count({ where: { status: 'completed' } }),
    prisma.researchQueue.count({ where: { status: 'failed' } }),
  ]);

  const recentRuns = await prisma.agentRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      runType: true,
      status: true,
      topicsProcessed: true,
      topicsSucceeded: true,
      topicsFailed: true,
      topicsDiscovered: true,
      evidenceCreated: true,
      entitiesCreated: true,
      startedAt: true,
      completedAt: true,
    },
  });

  return {
    queue: { pending, processing, completed, failed, total: pending + processing + completed + failed },
    recentRuns,
  };
}
