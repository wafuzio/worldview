export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { callLLM, parseJSONResponse } from '@/lib/llm';

// LLM integration for analyzing documents
// Requires GITHUB_TOKEN or OPENAI_API_KEY in .env

export async function POST(request: Request) {
  const data = await request.json();
  const { evidenceId, action } = data;

  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: { tags: { include: { tag: true } } },
  });

  if (!evidence || !evidence.rawContent) {
    return NextResponse.json({ error: 'Evidence not found or no content' }, { status: 404 });
  }

  try {
    let prompt = '';
    
    switch (action) {
      case 'suggest_tags':
        prompt = `Analyze this article and suggest relevant political/policy topic tags. Return as JSON array of strings.

Article:
${evidence.rawContent.slice(0, 4000)}

Return only a JSON array like: ["Immigration", "Healthcare", "Economy"]`;
        break;
        
      case 'generate_questions':
        prompt = `Based on this article, generate neutral quiz questions that could assess someone's political beliefs on the topics covered. Each question should have a left-leaning and right-leaning perspective label.

Article:
${evidence.rawContent.slice(0, 4000)}

Return as JSON array: [{"text": "question", "leftLabel": "left position", "rightLabel": "right position"}]`;
        break;
        
      case 'extract_claims':
        prompt = `Extract factual claims, promises, or statements from this article that could be fact-checked. Include who made the claim if mentioned.

Article:
${evidence.rawContent.slice(0, 4000)}

Return as JSON array: [{"claim": "the claim", "speaker": "who said it or null", "context": "brief context"}]`;
        break;
        
      case 'detect_politicians':
        prompt = `Identify all politicians, political parties, and public figures mentioned in this article. Note how they are portrayed.

Article:
${evidence.rawContent.slice(0, 4000)}

Return as JSON array: [{"name": "full name", "type": "politician/party/pundit", "portrayal": "positive/negative/neutral", "context": "brief context"}]`;
        break;
        
      case 'check_backlog':
        // Note: Statement model requires prisma generate after schema update
        // For now, analyze the article for fact-checkable claims
        prompt = `Analyze this article and identify claims that should be fact-checked or compared against politicians' past statements.

Article:
${evidence.rawContent.slice(0, 3000)}

Return as JSON array: [{"claim": "the claim made", "speaker": "who said it", "checkWorthy": true/false, "reason": "why this should be checked"}]`;
        break;
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const response = await callLLM([
      { role: 'system', content: 'You are a neutral political analyst. Return only valid JSON, no markdown.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3 });

    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: 500 });
    }

    const parsed = parseJSONResponse(response.content);

    if (!parsed) {
      return NextResponse.json({ error: 'Failed to parse LLM response' }, { status: 500 });
    }

    return NextResponse.json({ result: parsed, action });

  } catch (error) {
    console.error('LLM analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
