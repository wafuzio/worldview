// ============================================================
// DISCOVERY AGENT
// Uses LLM to identify new political topics worth researching,
// based on current events, coverage gaps, and existing database content.
//
// Discovery modes:
//   1. "current_events" — Ask LLM for trending political topics
//   2. "gap_analysis"   — Analyze DB coverage and find holes
//   3. "deep_dive"      — Expand on existing high-value entities
// ============================================================

import { prisma } from './db';
import { callLLM, parseJSONResponse } from './llm';
import { prioritizeSuggestedTopics } from './topic-prioritization';

type DiscoveryLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

export type DiscoveryConfig = {
  mode?: 'current_events' | 'gap_analysis' | 'deep_dive' | 'all';
  maxTopics?: number;
  priority?: string;
};

export type DiscoveryResult = {
  runId: string;
  mode: string;
  topicsDiscovered: number;
  topicsQueued: number;
  topics: { topic: string; rationale: string; priority: string; source: string }[];
  log: DiscoveryLogEntry[];
};

// ── Main discovery function ──

export async function runDiscovery(config: DiscoveryConfig = {}): Promise<DiscoveryResult> {
  const mode = config.mode ?? 'all';
  const maxTopics = config.maxTopics ?? 5;
  const queueCapPerRun = 5;
  const log: DiscoveryLogEntry[] = [];

  const addLog = (level: DiscoveryLogEntry['level'], message: string) => {
    log.push({ timestamp: new Date().toISOString(), level, message });
    console.log(`[discovery] ${level === 'error' ? '❌' : '→'} ${message}`);
  };

  // Create an agent run record for this discovery
  const run = await prisma.agentRun.create({
    data: {
      runType: 'discovery',
      status: 'running',
      maxTopics,
    },
  });

  addLog('info', `Discovery run started: ${run.id} (mode: ${mode})`);

  const allTopics: { topic: string; rationale: string; priority: string; source: string }[] = [];

  try {
    if (mode === 'current_events' || mode === 'all') {
      const topics = await discoverCurrentEvents(maxTopics, addLog);
      allTopics.push(...topics);
    }

    if (mode === 'gap_analysis' || mode === 'all') {
      const topics = await discoverGaps(maxTopics, addLog);
      allTopics.push(...topics);
    }

    if (mode === 'deep_dive' || mode === 'all') {
      const topics = await discoverDeepDives(maxTopics, addLog);
      allTopics.push(...topics);
    }

    // Deduplicate, rank by whole-database impact, then queue (strict max per run)
    let queued = 0;
    const seen = new Set<string>();
    const dedupedTopics: { topic: string; rationale: string; priority: string; source: string }[] = [];

    for (const t of allTopics) {
      const key = t.topic.toLowerCase().substring(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedTopics.push(t);
    }

    const ranked = await prioritizeSuggestedTopics(dedupedTopics as any, queueCapPerRun);
    const rankedKeys = new Set(ranked.map((t) => t.topic.toLowerCase().trim()));

    for (const t of dedupedTopics) {
      if (queued >= queueCapPerRun) break;
      if (!rankedKeys.has(t.topic.toLowerCase().trim())) continue;

      // Check if already in queue
      const existing = await prisma.researchQueue.findFirst({
        where: {
          topic: { contains: t.topic.substring(0, 50) },
          status: { in: ['pending', 'processing', 'completed'] },
        },
      });

      if (existing) {
        addLog('info', `Skip (exists): "${t.topic.substring(0, 60)}..."`);
        continue;
      }

      await prisma.researchQueue.create({
        data: {
          topic: t.topic,
          rationale: t.rationale,
          priority: config.priority || t.priority || 'medium',
          source: 'discovered',
          sourceRunId: run.id,
        },
      });

      queued++;
      addLog('info', `Queued [${t.priority}]: "${t.topic.substring(0, 80)}"`);
    }

    addLog('info', `Discovery complete: ${allTopics.length} found, ${queued} queued`);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        topicsDiscovered: queued,
        log: JSON.stringify(log),
      },
    });

    return {
      runId: run.id,
      mode,
      topicsDiscovered: allTopics.length,
      topicsQueued: queued,
      topics: allTopics,
      log,
    };

  } catch (err: any) {
    addLog('error', `Discovery failed: ${err.message}`);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        log: JSON.stringify(log),
      },
    });

    return {
      runId: run.id,
      mode,
      topicsDiscovered: allTopics.length,
      topicsQueued: 0,
      topics: allTopics,
      log,
    };
  }
}

// ── Mode 1: Current Events Discovery ──

async function discoverCurrentEvents(
  maxTopics: number,
  addLog: (level: DiscoveryLogEntry['level'], message: string) => void
): Promise<{ topic: string; rationale: string; priority: string; source: string }[]> {
  addLog('info', 'Discovering current political events and topics...');

  // Get existing topics to avoid duplicates
  const existingTopics = await prisma.researchQueue.findMany({
    where: { status: { in: ['pending', 'completed'] } },
    select: { topic: true },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  const existingList = existingTopics.map(t => t.topic).join('\n- ');

  const response = await callLLM([
    {
      role: 'system',
      content: `You are a political research discovery agent for Worldview, a nonpartisan political evidence database. Your job is to identify important political topics, events, and developments that should be researched and documented.

Focus on:
- Current legislative activity (bills being debated, voted on, or signed)
- Court decisions and legal developments
- Campaign finance and lobbying developments
- Institutional actions (executive orders, agency rules, appointments)
- Investigative journalism revelations
- Structural/systemic political dynamics (gerrymandering, voter access, regulatory capture)
- Likely missing connectors between known institutions/actors that should be explicitly verified

DO NOT focus on:
- Horse-race polling or election predictions
- Celebrity political opinions
- Social media controversies without policy substance
- Partisan talking points without evidentiary basis

Return a JSON array of research topics:
[
  {
    "topic": "Specific, researchable topic description — detailed enough to paste directly into a research tool",
    "rationale": "Why this matters for a political evidence database",
    "priority": "high|medium|low"
  }
]

Return ONLY the JSON array. No commentary.`,
    },
    {
      role: 'user',
      content: `Identify up to ${maxTopics} important political topics that should be researched right now. These should be substantive political developments — legislation, court rulings, campaign finance flows, institutional actions, or investigative findings.

${existingList ? `ALREADY IN OUR DATABASE (avoid duplicates):\n- ${existingList}` : ''}

Focus on topics that reveal power structures, money flows, institutional dynamics, and accountability gaps. Include topics from BOTH sides of the political spectrum.`,
    },
  ], { temperature: 0.4 });

  if (response.error || !response.content) {
    addLog('error', `Current events discovery failed: ${response.error}`);
    return [];
  }

  const topics = parseJSONResponse(response.content);
  if (!Array.isArray(topics)) {
    addLog('warn', 'Current events response was not a JSON array');
    return [];
  }

  addLog('info', `Found ${topics.length} current event topics`);
  return topics.map((t: any) => ({ ...t, source: 'current_events' }));
}

// ── Mode 2: Gap Analysis Discovery ──

async function discoverGaps(
  maxTopics: number,
  addLog: (level: DiscoveryLogEntry['level'], message: string) => void
): Promise<{ topic: string; rationale: string; priority: string; source: string }[]> {
  addLog('info', 'Analyzing database coverage gaps...');

  // Get counts by category
  const categories = await prisma.category.findMany({
    select: {
      name: true,
      slug: true,
      _count: { select: { evidence: true, questions: true } },
    },
  });

  // Get entity counts
  const entityCount = await prisma.entity.count();
  const relationshipCount = await prisma.actorRelationship.count();
  const evidenceCount = await prisma.evidence.count();

  // Find categories with low coverage
  const coverageSummary = categories
    .map(c => `${c.name} (${c.slug}): ${c._count.evidence} evidence, ${c._count.questions} questions`)
    .join('\n');

  const response = await callLLM([
    {
      role: 'system',
      content: `You are a research gap analyst for Worldview, a political evidence database organized into 14 pillars. Analyze the coverage summary and identify the most important gaps that need to be filled.

Return a JSON array of research topics to fill gaps:
[
  {
    "topic": "Specific research topic to fill this gap",
    "rationale": "What gap this fills and why it matters",
    "priority": "high|medium|low"
  }
]

Return ONLY the JSON array.`,
    },
    {
      role: 'user',
      content: `Here is our current database coverage:

TOTALS: ${evidenceCount} evidence items, ${entityCount} entities, ${relationshipCount} relationships

BY CATEGORY:
${coverageSummary}

Identify up to ${maxTopics} research topics that would fill the most critical gaps. Prioritize:
1. Categories with zero or very low evidence counts
2. Cross-cutting topics that connect multiple pillars
3. Foundational topics that every political database should cover (key Supreme Court cases, landmark legislation, major institutional structures)
4. Under-covered relationship networks (who funds whom, revolving door patterns)
5. Missing-link connector hypotheses: likely but unverified ties between concrete endpoints; name both endpoints in the topic itself (example pattern: "Verify whether [A] had [relationship] ties with [B] during [years]")`,
    },
  ], { temperature: 0.3 });

  if (response.error || !response.content) {
    addLog('error', `Gap analysis failed: ${response.error}`);
    return [];
  }

  const topics = parseJSONResponse(response.content);
  if (!Array.isArray(topics)) {
    addLog('warn', 'Gap analysis response was not a JSON array');
    return [];
  }

  addLog('info', `Found ${topics.length} gap-fill topics`);
  return topics.map((t: any) => ({ ...t, source: 'gap_analysis' }));
}

// ── Mode 3: Deep Dive Discovery (expand on existing entities) ──

async function discoverDeepDives(
  maxTopics: number,
  addLog: (level: DiscoveryLogEntry['level'], message: string) => void
): Promise<{ topic: string; rationale: string; priority: string; source: string }[]> {
  addLog('info', 'Finding deep-dive opportunities from existing entities...');

  // Get entities with the most evidence connections (high-value nodes)
  const topEntities = await prisma.entity.findMany({
    select: {
      name: true,
      type: true,
      description: true,
      _count: { select: { evidence: true } },
    },
    orderBy: { evidence: { _count: 'desc' } },
    take: 20,
  });

  // Get politicians with the most relationships
  const topActors = await prisma.politician.findMany({
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
    take: 20,
  });

  if (topEntities.length === 0 && topActors.length === 0) {
    addLog('info', 'No existing entities to expand on yet');
    return [];
  }

  const entitySummary = topEntities
    .map(e => `${e.name} (${e.type}, ${e._count.evidence} evidence items): ${e.description || 'no description'}`)
    .join('\n');

  const actorSummary = topActors
    .map(a => `${a.name} (${a.type}): ${a._count.relationshipsFrom + a._count.relationshipsTo} relationships, ${a._count.actions} actions`)
    .join('\n');

  const response = await callLLM([
    {
      role: 'system',
      content: `You are a research strategist for Worldview, a political evidence database. Given our existing entities and actors, suggest specific deep-dive research topics that would map their networks, financial connections, and institutional influence more thoroughly.

Return a JSON array:
[
  {
    "topic": "Specific deep-dive research topic",
    "rationale": "What this reveals about existing entities/actors",
    "priority": "high|medium|low"
  }
]

Return ONLY the JSON array.`,
    },
    {
      role: 'user',
      content: `Here are our highest-value entities and actors. Suggest up to ${maxTopics} deep-dive research topics.

TOP ENTITIES:
${entitySummary || '(none yet)'}

TOP ACTORS:
${actorSummary || '(none yet)'}

Focus on:
1. Financial connections we haven't mapped yet
2. Organizational networks (board memberships, advisory roles)
3. Patterns across multiple actors (coordinated action, shared donors)
4. Historical context that explains current dynamics
5. Missing-link connector hypotheses between named entities/actors that are plausibly connected but currently under-mapped. Include at least two such topics, with explicit endpoint pairs and tie type (for example, Philip Morris ↔ Tobacco Institute linkage research by year and mechanism).`,
    },
  ], { temperature: 0.3 });

  if (response.error || !response.content) {
    addLog('error', `Deep dive discovery failed: ${response.error}`);
    return [];
  }

  const topics = parseJSONResponse(response.content);
  if (!Array.isArray(topics)) {
    addLog('warn', 'Deep dive response was not a JSON array');
    return [];
  }

  addLog('info', `Found ${topics.length} deep-dive topics`);
  return topics.map((t: any) => ({ ...t, source: 'deep_dive' }));
}
