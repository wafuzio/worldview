export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { callLLM, parseJSONResponse } from '@/lib/llm';

type SuggestedBranch = {
  branchCondition: '<0' | '=0' | '>0';
  text: string;
  description?: string;
  leftLabel: string;
  rightLabel: string;
};

type SuggestedQuestion = {
  text: string;
  description?: string;
  leftLabel: string;
  rightLabel: string;
  categorySlug?: string;
  categoryName?: string;
  rationale?: string;
  importanceScore?: number;
  supportingEvidence?: {
    evidenceId: string;
    title: string;
    relevance?: string;
  }[];
  followUps?: SuggestedBranch[];
};

const MAX_SUGGESTIONS = 5;
const EVIDENCE_POOL_LIMIT = 120;

const PROCEDURAL_TERMS = [
  'feca',
  'fec',
  'committee',
  'amendment',
  'rulemaking',
  'appropriation',
  'procedural',
  'corrupt practices act',
  'tillman act',
  'beaumont',
  'buckley',
  'citizens united',
];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedCategoryId = typeof body.categoryId === 'string' ? body.categoryId : undefined;
    const requestedCount = Number.isFinite(body.count) ? Number(body.count) : MAX_SUGGESTIONS;
    const count = Math.min(Math.max(requestedCount, 1), MAX_SUGGESTIONS);

    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true, description: true },
    });

    if (categories.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const categoryBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

    const evidence = await prisma.evidence.findMany({
      where: {
        ...(requestedCategoryId ? { categoryId: requestedCategoryId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: EVIDENCE_POOL_LIMIT,
      select: {
        id: true,
        title: true,
        summary: true,
        sourceName: true,
        sourceUrl: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        tags: {
          select: {
            tag: {
              select: { name: true },
            },
          },
          take: 5,
        },
      },
    });

    if (evidence.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const evidenceLines = evidence
      .map((ev) => {
        const tagText = ev.tags.map((t) => t.tag.name).join(', ');
        const summary = (ev.summary || '').replace(/\s+/g, ' ').slice(0, 320);
        return [
          `- id: ${ev.id}`,
          `title: ${ev.title}`,
          `category: ${ev.category?.slug || 'unknown'}`,
          `source: ${ev.sourceName || 'unknown'}${ev.sourceUrl ? ` (${ev.sourceUrl})` : ''}`,
          `tags: ${tagText || 'none'}`,
          `summary: ${summary}`,
        ].join(' | ');
      })
      .join('\n');

    const categoryContext = categories
      .map((c) => `${c.slug}: ${c.name}${c.description ? ` - ${c.description}` : ''}`)
      .join('\n');

    const systemPrompt = `You design political self-reflection questions with strict neutrality.

Your goals:
1) Generate broad moral-compass questions, not procedural/legal trivia.
2) Ground each suggestion directly in provided evidence IDs/titles.
3) Keep wording neutral, values-focused, and broadly applicable.
4) Pair each main question with branch follow-ups that force concrete choices.

Output ONLY valid JSON.`;

    const userPrompt = `Create up to ${count} suggested QUESTION SETS.

Critical framing rules:
- Main question must be broad and principle-first (high-level civic values).
- Avoid legal/procedural jargon and case-name framing in the main question.
- Good pattern: "Should X generally have power over Y, or should national standards apply?"
- Include branch follow-ups that ask "which things" when the user leans either direction or chooses middle.

Output requirements for each suggestion:
- text
- description (1 sentence, moral/civic framing)
- leftLabel
- rightLabel
- categorySlug (must match allowed slugs)
- rationale (1 sentence why this is a high-importance gap)
- importanceScore (0-100, where 100 = highest overall importance)
- supportingEvidence [{ evidenceId, title, relevance }], 2-4 items
- followUps: 2-4 items using branchCondition of "<0", "=0", or ">0"
  - "<0" = user leaned leftLabel side
  - "=0" = user chose middle / "depends"
  - ">0" = user leaned rightLabel side
  - each follow-up includes text, description, leftLabel, rightLabel

Allowed category slugs:
${categoryContext}

Evidence corpus:
${evidenceLines}

Return this exact JSON shape:
{
  "suggestions": [
    {
      "text": "...",
      "description": "...",
      "leftLabel": "...",
      "rightLabel": "...",
      "categorySlug": "...",
      "rationale": "...",
      "importanceScore": 85,
      "supportingEvidence": [
        { "evidenceId": "...", "title": "...", "relevance": "..." }
      ],
      "followUps": [
        {
          "branchCondition": "=0",
          "text": "If your answer is 'it depends', which policy areas should states control most?",
          "description": "...",
          "leftLabel": "States should decide",
          "rightLabel": "National standards should apply"
        }
      ]
    }
  ]
}`;

    const llmRes = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2 }
    );

    if (llmRes.error || !llmRes.content) {
      return NextResponse.json({ error: llmRes.error || 'Suggestion generation failed' }, { status: 500 });
    }

    const parsed = parseJSONResponse(llmRes.content);
    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : Array.isArray(parsed) ? parsed : [];

    const evidenceById = new Map(evidence.map((ev) => [ev.id, ev]));
    const suggestions: Array<SuggestedQuestion & { categoryId: string; followUps: SuggestedBranch[] }> = [];

    const branchConditionSet = new Set(['<0', '=0', '>0']);

    for (const item of rawSuggestions) {
      if (!item || typeof item !== 'object') continue;
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      const leftLabel = typeof item.leftLabel === 'string' ? item.leftLabel.trim() : '';
      const rightLabel = typeof item.rightLabel === 'string' ? item.rightLabel.trim() : '';
      const description = typeof item.description === 'string' ? item.description.trim() : undefined;
      const rationale = typeof item.rationale === 'string' ? item.rationale.trim() : undefined;
      const importanceScore = typeof item.importanceScore === 'number' ? item.importanceScore : 50;
      const incomingSlug = typeof item.categorySlug === 'string' ? item.categorySlug.trim().toLowerCase() : '';
      const incomingName = typeof item.categoryName === 'string' ? item.categoryName.trim().toLowerCase() : '';
      const category = categoryBySlug.get(incomingSlug) || categoryByName.get(incomingName);

      if (!text || !leftLabel || !rightLabel || !category) continue;

      const proceduralHits = PROCEDURAL_TERMS.filter((term) => text.toLowerCase().includes(term)).length;
      if (proceduralHits >= 2) continue;

      const supportingEvidenceInput = Array.isArray(item.supportingEvidence) ? item.supportingEvidence : [];
      const supportingEvidence: SuggestedQuestion['supportingEvidence'] = supportingEvidenceInput
        .map((ev: any) => {
          const evidenceId = typeof ev?.evidenceId === 'string' ? ev.evidenceId : '';
          const matched = evidenceById.get(evidenceId);
          if (!matched) return null;
          return {
            evidenceId: matched.id,
            title: matched.title,
            relevance: typeof ev?.relevance === 'string' ? ev.relevance.slice(0, 220) : undefined,
          };
        })
        .filter(Boolean) as SuggestedQuestion['supportingEvidence'];

      if (!supportingEvidence || supportingEvidence.length === 0) continue;

      const rawFollowUps = Array.isArray(item.followUps) ? item.followUps : [];
      const followUps: SuggestedBranch[] = rawFollowUps
        .map((f: any) => {
          const branchCondition = typeof f?.branchCondition === 'string' ? f.branchCondition.trim() : '';
          if (!branchConditionSet.has(branchCondition)) return null;
          const fText = typeof f?.text === 'string' ? f.text.trim() : '';
          const fLeft = typeof f?.leftLabel === 'string' ? f.leftLabel.trim() : '';
          const fRight = typeof f?.rightLabel === 'string' ? f.rightLabel.trim() : '';
          if (!fText || !fLeft || !fRight) return null;
          return {
            branchCondition: branchCondition as '<0' | '=0' | '>0',
            text: fText,
            description: typeof f?.description === 'string' ? f.description.trim().slice(0, 240) : undefined,
            leftLabel: fLeft,
            rightLabel: fRight,
          };
        })
        .filter(Boolean) as SuggestedBranch[];

      suggestions.push({
        text,
        leftLabel,
        rightLabel,
        description,
        rationale,
        importanceScore: Math.max(0, Math.min(100, Math.round(importanceScore))),
        categorySlug: category.slug,
        categoryName: category.name,
        categoryId: category.id,
        supportingEvidence: supportingEvidence.slice(0, 4),
        followUps: followUps.slice(0, 4),
      });
    }

    const sorted = suggestions
      .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
      .slice(0, count);

    return NextResponse.json({
      suggestions: sorted,
      metadata: {
        requestedCount: count,
        evidenceConsidered: evidence.length,
      },
    });
  } catch (error) {
    console.error('Question suggestion error:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
