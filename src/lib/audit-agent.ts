// ============================================================
// AUDIT AGENT
//
// Scans existing actor nodes for quality/completeness issues,
// scores them, and queues re-research for the worst offenders.
// Designed to be run periodically or on-demand to clean up
// lazy/incorrect data the LLM pipeline produced.
//
// Audit modes:
//   1. "completeness" — Score all nodes, flag incomplete ones
//   2. "directional"  — Check all relationships for direction errors
//   3. "full"         — Both passes
// ============================================================

import { prisma } from './db';
import { callLLM, parseJSONResponse } from './llm';
import {
  scoreEntityCompleteness,
  validateRelationship,
  ENTITY_COMPLETENESS_RULES,
  type CompletenessScore,
  type ValidationIssue,
} from './relationship-validation';
import type { EntityInput, RelationshipInput } from './pipeline';

export type AuditConfig = {
  mode?: 'completeness' | 'directional' | 'full';
  minScore?: number;          // Nodes below this get flagged (default 40)
  maxRequeue?: number;        // Max items to add to research queue (default 10)
  dryRun?: boolean;           // If true, report issues but don't queue anything
};

export type AuditResult = {
  runId: string;
  mode: string;
  nodesScanned: number;
  relationshipsChecked: number;
  issuesFound: number;
  nodesRequeued: number;
  scores: CompletenessScore[];
  directionIssues: { relationship: string; issues: ValidationIssue[] }[];
  log: string[];
};

export async function runAudit(config: AuditConfig = {}): Promise<AuditResult> {
  const mode = config.mode ?? 'full';
  const minScore = config.minScore ?? 40;
  const maxRequeue = config.maxRequeue ?? 10;
  const dryRun = config.dryRun ?? false;
  const log: string[] = [];

  const addLog = (msg: string) => {
    log.push(`[audit] ${msg}`);
    console.log(`[audit] ${msg}`);
  };

  // Create run record
  const run = await prisma.agentRun.create({
    data: {
      runType: 'audit',
      status: 'running',
      maxTopics: maxRequeue,
    },
  });

  addLog(`Audit run started: ${run.id} (mode: ${mode}, minScore: ${minScore}, dryRun: ${dryRun})`);

  const scores: CompletenessScore[] = [];
  const directionIssues: { relationship: string; issues: ValidationIssue[] }[] = [];
  let nodesRequeued = 0;

  try {
    // ── Fetch all actors and relationships ──
    const actors = await prisma.politician.findMany({
      select: { id: true, name: true, type: true, description: true },
    });

    const relationships = await prisma.actorRelationship.findMany({
      include: {
        source: { select: { id: true, name: true, type: true } },
        target: { select: { id: true, name: true, type: true } },
      },
    });

    addLog(`Loaded ${actors.length} actors, ${relationships.length} relationships`);

    // ── Pass 1: Completeness scoring ──
    if (mode === 'completeness' || mode === 'full') {
      addLog('Running completeness audit...');

      for (const actor of actors) {
        const actorRels = relationships
          .filter((r) => r.sourceId === actor.id || r.targetId === actor.id)
          .map((r) => ({
            relationshipType: r.relationshipType,
            sourceName: r.source.name,
            targetName: r.target.name,
            amount: r.amount ? Number(r.amount) : null,
            description: r.description,
          }));

        const score = scoreEntityCompleteness(actor.name, actor.type, actorRels);
        scores.push(score);

        if (score.score < minScore) {
          addLog(`LOW SCORE: ${actor.name} (${actor.type}) = ${score.score}/100 — ${score.issues.join('; ')}`);
        }
      }

      // Sort worst first
      scores.sort((a, b) => a.score - b.score);
      addLog(`Completeness: ${scores.filter((s) => s.score < minScore).length} of ${scores.length} nodes below threshold (${minScore})`);
    }

    // ── Pass 2: Directional validation ──
    if (mode === 'directional' || mode === 'full') {
      addLog('Running directional validation...');

      for (const rel of relationships) {
        const relInput: RelationshipInput = {
          sourceName: rel.source.name,
          targetName: rel.target.name,
          tier: rel.tier,
          relationshipType: rel.relationshipType,
          description: rel.description || undefined,
          amount: rel.amount ? Number(rel.amount) : undefined,
          startDate: rel.startDate?.toISOString(),
          endDate: rel.endDate?.toISOString(),
          significance: rel.significance,
        };

        const entityLookup = new Map<string, EntityInput>();
        entityLookup.set(rel.source.name.toLowerCase(), {
          name: rel.source.name,
          type: rel.source.type,
        });
        entityLookup.set(rel.target.name.toLowerCase(), {
          name: rel.target.name,
          type: rel.target.type,
        });

        const result = validateRelationship(relInput, entityLookup);
        const significant = result.issues.filter(
          (i) => i.severity === 'error' || i.code === 'DIRECTION_FLIPPED' || i.code === 'DIRECTION_SUSPECT'
        );

        if (significant.length > 0) {
          const label = `${rel.source.name} → ${rel.target.name} (${rel.relationshipType})`;
          directionIssues.push({ relationship: label, issues: significant });
          addLog(`DIRECTION ISSUE: ${label} — ${significant.map((i) => i.message).join('; ')}`);
        }
      }

      addLog(`Directional: ${directionIssues.length} relationships with direction issues`);
    }

    // ── Pass 3: Type reclassification ──
    // Find actors typed as "politician" who are likely donors or operatives
    if (mode === 'full') {
      const misclassifiedCandidates = actors.filter((a) => a.type === 'politician');
      if (misclassifiedCandidates.length > 0) {
        const reclassified = await reclassifyActors(misclassifiedCandidates, relationships, dryRun, addLog);
        if (reclassified > 0) {
          addLog(`Reclassification: ${reclassified} actors re-typed`);
        }
      }
    }

    // ── Queue re-research for worst nodes ──
    if (!dryRun) {
      // Combine low-scoring nodes that need re-research
      const needsWork = scores
        .filter((s) => s.score < minScore)
        .slice(0, maxRequeue);

      // Also include nodes involved in directional issues
      const directionNodeNames = new Set<string>();
      for (const di of directionIssues) {
        const parts = di.relationship.split(' → ');
        if (parts[0]) directionNodeNames.add(parts[0].trim());
      }

      // Use LLM to generate targeted re-research prompts
      if (needsWork.length > 0 || directionNodeNames.size > 0) {
        const reresearchTargets = await generateReresearchTopics(
          needsWork,
          directionIssues,
          addLog,
        );

        for (const target of reresearchTargets.slice(0, maxRequeue - nodesRequeued)) {
          // Check if already in queue
          const existing = await prisma.researchQueue.findFirst({
            where: {
              topic: { contains: target.topic.substring(0, 50) },
              status: { in: ['pending', 'processing'] },
            },
          });

          if (existing) {
            addLog(`Skip re-queue (exists): "${target.topic.substring(0, 60)}"`);
            continue;
          }

          await prisma.researchQueue.create({
            data: {
              topic: target.topic,
              rationale: target.rationale,
              priority: target.priority,
              source: 'audit',
              sourceRunId: run.id,
            },
          });

          nodesRequeued++;
          addLog(`Queued re-research: "${target.topic.substring(0, 80)}" [${target.priority}]`);
        }
      }
    }

    addLog(`Audit complete: ${scores.length} scored, ${directionIssues.length} direction issues, ${nodesRequeued} queued for re-research`);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        topicsDiscovered: nodesRequeued,
        log: JSON.stringify(log),
      },
    });

  } catch (err: any) {
    addLog(`Audit failed: ${err.message}`);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        log: JSON.stringify(log),
      },
    });
  }

  return {
    runId: run.id,
    mode,
    nodesScanned: scores.length,
    relationshipsChecked: directionIssues.length > 0 ? directionIssues.length : 0,
    issuesFound: scores.filter((s) => s.score < minScore).length + directionIssues.length,
    nodesRequeued,
    scores,
    directionIssues,
    log,
  };
}

// ── Generate smart re-research topics for bad nodes ──

async function generateReresearchTopics(
  lowScoreNodes: CompletenessScore[],
  directionIssues: { relationship: string; issues: ValidationIssue[] }[],
  addLog: (msg: string) => void,
): Promise<{ topic: string; rationale: string; priority: string }[]> {
  if (lowScoreNodes.length === 0 && directionIssues.length === 0) return [];

  const nodeProblems = lowScoreNodes.map((n) =>
    `${n.entityName} (${n.entityType}, score ${n.score}/100): ${n.issues.join('; ')}`
  ).join('\n');

  const directionProblems = directionIssues.slice(0, 10).map((d) =>
    `${d.relationship}: ${d.issues.map((i) => i.message).join('; ')}`
  ).join('\n');

  try {
    const response = await callLLM([
      {
        role: 'system',
        content: `You are a data quality analyst for a political evidence graph. Given nodes with quality problems, generate SPECIFIC re-research topics that will fix the issues.

Rules:
1. Each topic should be a concrete, pasteable research query — not vague.
2. For PACs/financial entities: the topic MUST ask for FEC filing data, funding sources, recipients, and dollar amounts.
3. For directional errors: the topic should clarify who gave to whom, who appointed whom, etc.
4. For low-connection nodes: the topic should ask for the entity's most important relationships.
5. Prioritize: "high" for nodes that are embarrassingly wrong (reversed relationships, PACs with no financial data), "medium" for incomplete but not wrong.

Return JSON array:
[
  {
    "topic": "Re-research [Entity]: [specific what to look up]",
    "rationale": "Current data problem: [what's wrong]",
    "priority": "high|medium"
  }
]

Return ONLY the JSON array.`,
      },
      {
        role: 'user',
        content: `NODES WITH LOW QUALITY SCORES:
${nodeProblems || '(none)'}

RELATIONSHIPS WITH DIRECTIONAL ISSUES:
${directionProblems || '(none)'}

Generate targeted re-research topics to fix the worst problems. Max 10.`,
      },
    ], { temperature: 0.1 });

    if (!response.content) return [];
    const parsed = parseJSONResponse(response.content);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((t: any) => ({
        topic: String(t?.topic || '').trim(),
        rationale: String(t?.rationale || '').trim(),
        priority: ['high', 'medium', 'low'].includes(t?.priority) ? t.priority : 'medium',
      }))
      .filter((t) => t.topic.length > 0);
  } catch (err: any) {
    addLog(`Failed to generate re-research topics: ${err.message}`);
    // Fallback: generate simple topics from the node names
    return lowScoreNodes.slice(0, 5).map((n) => ({
      topic: `Re-research ${n.entityName}: fill missing ${n.missingRelTypes.join(', ') || 'connections'} and add sourced evidence with dollar amounts and dates`,
      rationale: `Audit score ${n.score}/100: ${n.issues[0] || 'incomplete data'}`,
      priority: n.score < 20 ? 'high' : 'medium',
    }));
  }
}

// ── Reclassify mistyped actors ──
// Sends batches of "politician"-typed actors to the LLM to determine
// if they should actually be donor, operative, lobbyist, or media_figure.

async function reclassifyActors(
  candidates: { id: string; name: string; type: string; description: string | null }[],
  relationships: any[],
  dryRun: boolean,
  addLog: (msg: string) => void,
): Promise<number> {
  // Build context about each candidate's relationships
  const candidateContext = candidates.slice(0, 40).map((actor) => {
    const rels = relationships
      .filter((r: any) => r.sourceId === actor.id || r.targetId === actor.id)
      .map((r: any) => {
        const isSource = r.sourceId === actor.id;
        return `${isSource ? '' : `${r.source.name} `}${r.relationshipType}${isSource ? ` ${r.target.name}` : ''}`;
      });
    return `${actor.name}: ${actor.description || 'no description'} | relationships: ${rels.join(', ') || 'none'}`;
  }).join('\n');

  try {
    const response = await callLLM([
      {
        role: 'system',
        content: `You are reclassifying actors in a political knowledge graph. Every actor below is currently typed as "politician" but may be misclassified.

Available types:
- politician: elected officials, appointed government officials, judges — people who hold/held state power
- donor: individuals whose PRIMARY relevance is funding political activity. Their structural role in the network is as a money source. Examples: George Soros, Charles Koch, Sheldon Adelson, Harlan Crow, Robert Mercer
- operative: political strategists, fixers, dark money architects who aren't elected, aren't registered lobbyists, aren't media. Their power is institutional engineering. Examples: Leonard Leo, Karl Rove, Roger Stone, Steve Bannon, Grover Norquist
- lobbyist: registered or de facto lobbyists — influence-for-hire professionals
- media_figure: people whose power is narrative control

Rules:
1. Only reclassify if you are CONFIDENT the current type is wrong. When in doubt, keep "politician".
2. Someone who is a politician AND a donor stays "politician" (e.g., a senator who also donates is still a politician).
3. The key question: what is this person's PRIMARY structural role in the political power network?

Return JSON array:
[
  { "name": "exact name", "currentType": "politician", "newType": "donor|operative|lobbyist|media_figure|politician", "confidence": "high|medium", "reason": "why" }
]

Only include entries where newType differs from currentType AND confidence is high.
Return ONLY the JSON array.`,
      },
      {
        role: 'user',
        content: `Reclassify these actors if needed:\n\n${candidateContext}`,
      },
    ], { temperature: 0.1 });

    if (!response.content) return 0;
    const parsed = parseJSONResponse(response.content);
    if (!Array.isArray(parsed)) return 0;

    let reclassified = 0;

    for (const decision of parsed) {
      if (!decision?.name || !decision?.newType) continue;
      if (decision.newType === 'politician') continue;
      if (decision.confidence !== 'high') continue;

      const actor = candidates.find(
        (a) => a.name.toLowerCase() === String(decision.name).toLowerCase()
      );
      if (!actor) continue;

      if (dryRun) {
        addLog(`WOULD RECLASSIFY: ${actor.name} from "politician" → "${decision.newType}" (${decision.reason})`);
        reclassified++;
        continue;
      }

      try {
        await prisma.politician.update({
          where: { id: actor.id },
          data: { type: decision.newType },
        });
        reclassified++;
        addLog(`RECLASSIFIED: ${actor.name} from "politician" → "${decision.newType}" (${decision.reason})`);
      } catch (err: any) {
        addLog(`Failed to reclassify ${actor.name}: ${err.message}`);
      }
    }

    return reclassified;
  } catch (err: any) {
    addLog(`Reclassification LLM call failed: ${err.message}`);
    return 0;
  }
}
