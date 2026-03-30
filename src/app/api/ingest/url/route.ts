// POST /api/ingest/url
// Accepts a URL, attempts to extract content, and optionally sends to LLM for processing.
// Raw input saved to /data/research-logs/url/ before processing.
import { NextRequest, NextResponse } from 'next/server';
import { createManualEvidence } from '@/lib/pipeline';
import { callLLM, parseJSONResponse } from '@/lib/llm';
import { logIngest } from '@/lib/ingest-log';

export async function POST(req: NextRequest) {
  try {
    const { url, mode } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Missing required field: url' }, { status: 400 });
    }

    // Try to fetch the URL content
    let content = '';
    let title = url;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Worldview Research Bot/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const html = await response.text();
        // Basic extraction — strip HTML tags for content
        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000); // Limit for LLM context

        // Try to extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();
      }
    } catch {
      // URL fetch failed — that's ok, user can still process manually
    }

    // Save raw input to disk BEFORE processing
    logIngest('url', { url, mode, title, contentLength: content.length });

    if (mode === 'investigate' && content) {
      // Send to LLM for structured extraction
      const llmResult = await callLLM([
        {
          role: 'system',
          content: `You are a research assistant for Worldview. Extract structured evidence from the provided content. Return JSON with: { "title": "...", "summary": "neutral 2-sentence summary", "suggestedTags": ["tag1"], "suggestedCategory": "slug", "entities": [{"name": "...", "type": "person|organization|legislation"}], "keyClaimsToVerify": ["claim1"] }. Be neutral and clinical. Do not editorialize.`,
        },
        {
          role: 'user',
          content: `Extract structured data from this content:\n\nURL: ${url}\nTitle: ${title}\n\nContent:\n${content.slice(0, 10000)}`,
        },
      ], { temperature: 0.1 });

      const extracted = parseJSONResponse(llmResult.content);

      if (extracted) {
        // Create evidence with LLM-extracted metadata
        const result = await createManualEvidence({
          title: extracted.title || title,
          summary: extracted.summary || `Content from ${url}`,
          sourceUrl: url,
          sourceName: new URL(url).hostname.replace('www.', ''),
          content: content.slice(0, 50000),
          sourceClassification: 'secondary_source',
          verificationStatus: 'single_source',
          categorySlug: extracted.suggestedCategory,
          tagNames: extracted.suggestedTags,
        });

        return NextResponse.json({
          ...result,
          extracted,
          contentLength: content.length,
        });
      }
    }

    // Fallback: create basic evidence record
    const result = await createManualEvidence({
      title,
      summary: `Source from ${url}`,
      sourceUrl: url,
      sourceName: (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } })(),
      content: content || undefined,
      sourceClassification: 'secondary_source',
      verificationStatus: 'single_source',
    });

    return NextResponse.json({ ...result, contentLength: content.length });
  } catch (e: any) {
    console.error('URL ingest error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
