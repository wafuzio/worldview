// GET /api/search?q=powell+memo
// Cross-table keyword search: evidence, entities, relationships, actions,
// analyses, timeline events, politicians, institutions.
// Returns a coverage summary + matching records so you know what you have
// before firing an LLM research pass.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    // Run all searches in parallel
    const [
      evidence,
      entities,
      politicians,
      institutions,
      analyses,
      events,
      actions,
      relationships,
    ] = await Promise.all([
      // Evidence: search title, summary, content, sourceName
      prisma.evidence.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
            { content: { contains: q } },
            { sourceName: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          summary: true,
          sourceUrl: true,
          sourceName: true,
          eventDate: true,
          sourceClassification: true,
          verificationStatus: true,
          corroborationCount: true,
          independentSourceCount: true,
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // Entities: search name, description, aliases
      prisma.entity.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { aliases: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          title: true,
          affiliation: true,
          _count: { select: { evidence: true } },
        },
        take: 30,
      }),

      // Politicians/actors: search name, description, affiliation
      prisma.politician.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
            { affiliation: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          affiliation: true,
          description: true,
          _count: {
            select: {
              stances: true,
              evidenceMentions: true,
              statements: true,
              actions: true,
            },
          },
        },
        take: 20,
      }),

      // Institutions: search name, description
      prisma.institution.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
        },
        take: 20,
      }),

      // Analyses: search title, content
      prisma.analysis.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { content: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          claimClassification: true,
          analysisType: true,
          author: true,
          evidence: { select: { title: true } },
        },
        take: 20,
      }),

      // Timeline events: model is "Event" in schema
      prisma.event.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          eventDate: true,
          eventType: true,
          significance: true,
        },
        orderBy: { eventDate: 'asc' },
        take: 30,
      }),

      // Political actions: search title, description, targetLegislation, context
      prisma.politicalAction.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { targetLegislation: { contains: q } },
            { context: { contains: q } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          actionDate: true,
          actionType: true,
          targetLegislation: true,
          politician: { select: { name: true } },
        },
        take: 20,
      }),

      // Actor relationships: search description
      prisma.actorRelationship.findMany({
        where: {
          OR: [
            { description: { contains: q } },
          ],
        },
        select: {
          id: true,
          tier: true,
          relationshipType: true,
          description: true,
          source: { select: { name: true } },
          target: { select: { name: true } },
        },
        take: 20,
      }),
    ]);

    // Build coverage summary
    const coverage = {
      evidence: evidence.length,
      entities: entities.length,
      politicians: politicians.length,
      institutions: institutions.length,
      analyses: analyses.length,
      timelineEvents: events.length,
      politicalActions: actions.length,
      relationships: relationships.length,
      total: evidence.length + entities.length + politicians.length +
        institutions.length + analyses.length + events.length +
        actions.length + relationships.length,
    };

    // Category distribution across evidence
    const categoryDistribution: Record<string, number> = {};
    for (const e of evidence) {
      if (e.category) {
        categoryDistribution[e.category.name] = (categoryDistribution[e.category.name] || 0) + 1;
      }
    }

    // Tag distribution across evidence
    const tagDistribution: Record<string, number> = {};
    for (const e of evidence) {
      for (const t of e.tags) {
        tagDistribution[t.tag.name] = (tagDistribution[t.tag.name] || 0) + 1;
      }
    }

    // Verification status breakdown
    const verificationBreakdown: Record<string, number> = {};
    for (const e of evidence) {
      const status = e.verificationStatus || 'unknown';
      verificationBreakdown[status] = (verificationBreakdown[status] || 0) + 1;
    }

    // Relationship tier breakdown
    const tierBreakdown: Record<string, number> = {};
    for (const r of relationships) {
      tierBreakdown[r.tier] = (tierBreakdown[r.tier] || 0) + 1;
    }

    // Gap analysis: what's MISSING
    const gaps: string[] = [];
    if (evidence.length === 0) gaps.push('No evidence found — fresh topic');
    if (evidence.length > 0 && relationships.length === 0) gaps.push('Evidence exists but no actor relationships mapped');
    if (evidence.length > 0 && events.length === 0) gaps.push('Evidence exists but no timeline events');
    if (evidence.length > 0 && analyses.length === 0) gaps.push('Evidence exists but no interpretive analyses');
    if (evidence.length > 0 && actions.length === 0) gaps.push('Evidence exists but no political actions tracked');
    if (politicians.length === 0 && entities.length > 0) gaps.push('Entities found but no politician records');
    if (evidence.length > 3 && Object.keys(categoryDistribution).length === 1) {
      gaps.push(`All evidence in single category (${Object.keys(categoryDistribution)[0]}) — may need cross-pillar coverage`);
    }
    const unverified = evidence.filter((e: any) => e.verificationStatus === 'single_source' || e.verificationStatus === 'inconclusive');
    if (unverified.length > evidence.length * 0.5 && evidence.length > 2) {
      gaps.push(`${unverified.length} of ${evidence.length} evidence items are single-source or inconclusive`);
    }

    // Build copy-pasteable context block for Gap Fill prompt
    const contextLines: string[] = [];
    contextLines.push(`Coverage for "${q}":`);
    contextLines.push(`- ${evidence.length} evidence items (${Object.entries(verificationBreakdown).map(([k, v]) => `${v} ${k}`).join(', ')})`);
    contextLines.push(`- ${entities.length} entities: ${entities.slice(0, 8).map((e: any) => `${e.name} (${e.type})`).join(', ')}${entities.length > 8 ? `, +${entities.length - 8} more` : ''}`);
    contextLines.push(`- ${politicians.length} politicians/actors: ${politicians.slice(0, 6).map((p: any) => p.name).join(', ')}${politicians.length > 6 ? `, +${politicians.length - 6} more` : ''}`);
    contextLines.push(`- ${relationships.length} relationships (${Object.entries(tierBreakdown).map(([k, v]) => `Tier ${k === 'documented' ? '1' : k === 'interactional' ? '2' : '3'}: ${v}`).join(', ')})`);
    contextLines.push(`- ${events.length} timeline events`);
    contextLines.push(`- ${actions.length} political actions`);
    contextLines.push(`- ${analyses.length} analyses`);
    if (Object.keys(categoryDistribution).length > 0) {
      contextLines.push(`- Categories: ${Object.entries(categoryDistribution).map(([k, v]) => `${k} (${v})`).join(', ')}`);
    }
    if (Object.keys(tagDistribution).length > 0) {
      contextLines.push(`- Tags: ${Object.entries(tagDistribution).map(([k, v]) => `${k} (${v})`).join(', ')}`);
    }
    if (evidence.length > 0) {
      contextLines.push('');
      contextLines.push('Evidence titles already in database:');
      for (const e of evidence.slice(0, 20)) {
        contextLines.push(`  - "${e.title}" [${e.verificationStatus}] (${e.sourceName || 'unknown source'})`);
      }
      if (evidence.length > 20) contextLines.push(`  ... +${evidence.length - 20} more`);
    }
    if (gaps.length > 0) {
      contextLines.push('');
      contextLines.push('Gaps detected:');
      for (const g of gaps) {
        contextLines.push(`- ${g}`);
      }
    }
    const copyPasteContext = contextLines.join('\n');

    return NextResponse.json({
      query: q,
      coverage,
      gaps,
      breakdown: {
        categories: categoryDistribution,
        tags: tagDistribution,
        verificationStatus: verificationBreakdown,
        relationshipTiers: tierBreakdown,
      },
      copyPasteContext,
      results: {
        evidence: evidence.map((e: any) => ({
          ...e,
          tags: e.tags.map((t: any) => t.tag.name),
        })),
        entities,
        politicians,
        institutions,
        analyses,
        timelineEvents: events,
        politicalActions: actions,
        relationships: relationships.map((r: any) => ({
          ...r,
          sourceName: r.source.name,
          targetName: r.target.name,
        })),
      },
    });
  } catch (e: any) {
    console.error('[search] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
