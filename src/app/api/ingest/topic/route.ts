// POST /api/ingest/topic
// Accepts a topic name or concept, sends it to an LLM with the full
// research protocol, and ingests the structured result into the database.
//
// This is the "type a topic and the system populates itself" endpoint.
//
// Body: { "topic": "The Powell Memo", "depth": "standard" | "deep" }
// - "standard" = single LLM pass (~1 min)
// - "deep" = asks for evidence, then follow-up pass for relationships + analysis (~2 min)

import { NextRequest, NextResponse } from 'next/server';
import { callLLM, parseJSONResponse } from '@/lib/llm';
import { ingestResearch, ResearchInput } from '@/lib/pipeline';
import { logIngest } from '@/lib/ingest-log';
import { prioritizeSuggestedTopics } from '@/lib/topic-prioritization';

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
Tier 3 (analytical): influenced_by, aligned_with, protected_by, enabled, shielded_from_investigation

ACTION TYPES:
voted_yes, voted_no, sponsored, blocked, procedural_block, symbolic_vote, signed, vetoed, executive_order, appointed, public_stance, reversed_position, abstained, attempted_failed

Return your findings as a JSON object with this exact structure:

{
  "topic": "Brief description of what was researched",
  "summary": "2-3 sentence overview of findings",
  "evidence": [
    {
      "title": "Title of the evidence item",
      "summary": "Neutral 1-2 sentence summary of what this evidence shows",
      "sourceUrl": "REQUIRED: Real URL to original source (.gov, court records, congress.gov, established outlets, opensecrets.org). Write 'URL not confirmed' if unsure.",
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
      "type": "person|organization|legislation|court_case",
      "description": "Brief description",
      "title": "Current or relevant title",
      "affiliation": "Party or organizational affiliation",
      "aliases": ["Alternative names"],
      "tags": ["Freeform tags for character mapping — networks, affiliations, archetypes. E.g. 'dark money', 'federalist society', 'revolving door', 'koch network', 'corporate lobbying', 'civil rights', 'progressive coalition'. Be specific and descriptive. These power the relationship/network visualization."]
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
      "topic": "A specific follow-up research topic this investigation naturally leads to",
      "rationale": "Why this matters — what gap does it fill or what thread does it pull on",
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, depth = 'standard' } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: topic (string)' },
        { status: 400 }
      );
    }

    console.log(`[topic-ingest] Researching: "${topic}" (depth: ${depth})`);

    // First pass: main research
    const firstPass = await callLLM([
      { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
      { role: 'user', content: `RESEARCH REQUEST:\n${topic.trim()}` },
    ], { temperature: 0.2 });

    if (firstPass.error || !firstPass.content) {
      return NextResponse.json(
        { error: `LLM error on first pass: ${firstPass.error || 'No response'}` },
        { status: 502 }
      );
    }

    const firstData = parseJSONResponse(firstPass.content);
    if (!firstData) {
      return NextResponse.json(
        {
          error: 'Failed to parse LLM response as JSON',
          rawResponse: firstPass.content.substring(0, 500),
        },
        { status: 422 }
      );
    }

    let mergedData: ResearchInput = firstData;

    // Deep mode: second pass for relationships and analysis
    if (depth === 'deep') {
      console.log('[topic-ingest] Running deep follow-up pass...');

      const secondPass = await callLLM([
        { role: 'system', content: RESEARCH_SYSTEM_PROMPT },
        { role: 'user', content: `RESEARCH REQUEST:\n${topic.trim()}` },
        { role: 'assistant', content: JSON.stringify(firstData) },
        { role: 'user', content: DEEP_FOLLOW_UP_PROMPT },
      ], { temperature: 0.3 });

      if (secondPass.content) {
        const secondData = parseJSONResponse(secondPass.content);
        if (secondData) {
          mergedData = mergeResearchPasses(firstData, secondData);
          console.log('[topic-ingest] Merged deep pass results');
        } else {
          console.warn('[topic-ingest] Deep pass returned unparseable JSON, using first pass only');
        }
      }
    }

    // Save raw LLM output to disk BEFORE processing
    logIngest('topic', mergedData, { depth, originalQuery: topic });

    // Normalize and prioritize suggested topics for whole-database impact
    if (Array.isArray(mergedData.suggestedTopics) && mergedData.suggestedTopics.length > 0) {
      mergedData.suggestedTopics = await prioritizeSuggestedTopics(mergedData.suggestedTopics as any, 5);
    }

    // Ingest the merged result
    console.log('[topic-ingest] Ingesting into database...');
    const result = await ingestResearch(mergedData);

    return NextResponse.json(
      {
        ...result,
        topic,
        depth,
        llmSummary: mergedData.summary || null,
        suggestedTopics: mergedData.suggestedTopics || [],
      },
      { status: result.success ? 200 : 207 }
    );
  } catch (e: any) {
    console.error('[topic-ingest] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Merge two research passes by concatenating arrays and deduplicating by title/name
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
