import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  try {
    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorldviewQuiz/1.0)',
      },
    });
    const html = await response.text();

    // Extract metadata from HTML
    const metadata = extractMetadata(html, url);

    // Get existing tags for matching
    const tags = await prisma.tag.findMany({
      include: { synonyms: true },
    });

    // Find matching tags based on content
    const matchedTags = findMatchingTags(metadata.content, tags);

    // Detect political lean and source type
    const analysis = analyzeContent(metadata.content, url);

    // If OpenAI key is available, get AI suggestions
    let aiSuggestions = null;
    if (process.env.OPENAI_API_KEY) {
      aiSuggestions = await getAISuggestions(metadata, url);
    }

    return NextResponse.json({
      // Auto-extracted fields
      title: metadata.title,
      summary: metadata.description,
      sourceName: metadata.siteName || extractDomain(url),
      sourceUrl: url,
      publishedAt: metadata.publishedDate,
      
      // Content for further processing
      content: metadata.content,
      
      // Auto-detected
      sourceType: analysis.sourceType,
      politicalLean: analysis.politicalLean,
      credibility: analysis.credibility,
      
      // Tag suggestions
      matchedTags: matchedTags,
      
      // AI suggestions (if available)
      aiSuggestions: aiSuggestions,
      
      // Raw metadata for reference
      metadata: {
        author: metadata.author,
        image: metadata.image,
        keywords: metadata.keywords,
      },
    });

  } catch (error) {
    console.error('URL extraction error:', error);
    return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 });
  }
}

function extractMetadata(html: string, url: string) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  const title = ogTitleMatch?.[1] || titleMatch?.[1] || '';

  // Extract description
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
  const description = ogDescMatch?.[1] || descMatch?.[1] || '';

  // Extract site name
  const siteNameMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
  const siteName = siteNameMatch?.[1] || '';

  // Extract author
  const authorMatch = html.match(/<meta[^>]*name="author"[^>]*content="([^"]+)"/i);
  const author = authorMatch?.[1] || '';

  // Extract published date
  const dateMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i);
  const publishedDate = dateMatch?.[1] || null;

  // Extract image
  const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  const image = imageMatch?.[1] || '';

  // Extract keywords
  const keywordsMatch = html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i);
  const keywords = keywordsMatch?.[1]?.split(',').map(k => k.trim()) || [];

  // Extract main content (simplified)
  const content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000);

  return { title, description, siteName, author, publishedDate, image, keywords, content };
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. and extract main domain name
    return hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return 'Unknown';
  }
}

function findMatchingTags(content: string, tags: any[]): { id: string; name: string; color: string; matchCount: number }[] {
  const contentLower = content.toLowerCase();
  const matches: { id: string; name: string; color: string; matchCount: number }[] = [];

  for (const tag of tags) {
    let matchCount = 0;
    
    // Check tag name
    const tagRegex = new RegExp(`\\b${tag.name.toLowerCase()}\\b`, 'g');
    const tagMatches = contentLower.match(tagRegex);
    if (tagMatches) matchCount += tagMatches.length;

    // Check synonyms
    for (const syn of tag.synonyms || []) {
      const synRegex = new RegExp(`\\b${syn.phrase.toLowerCase()}\\b`, 'g');
      const synMatches = contentLower.match(synRegex);
      if (synMatches) matchCount += synMatches.length;
    }

    if (matchCount > 0) {
      matches.push({ id: tag.id, name: tag.name, color: tag.color, matchCount });
    }
  }

  // Sort by match count
  return matches.sort((a, b) => b.matchCount - a.matchCount);
}

function analyzeContent(content: string, url: string): { sourceType: 'impartial' | 'partisan'; politicalLean: number; credibility: number } {
  const contentLower = content.toLowerCase();
  const urlLower = url.toLowerCase();

  // Known partisan domains
  const partisanRight = ['heritage.org', 'breitbart', 'dailywire', 'foxnews', 'newsmax', 'oann', 'theblaze'];
  const partisanLeft = ['huffpost', 'motherjones', 'dailykos', 'thinkprogress', 'salon.com', 'vox.com'];
  const factual = ['reuters', 'apnews', 'bbc.com', 'npr.org', 'pbs.org', 'c-span'];

  let sourceType: 'impartial' | 'partisan' = 'impartial';
  let politicalLean = 0;
  let credibility = 3;

  // Check URL against known sources
  for (const domain of partisanRight) {
    if (urlLower.includes(domain)) {
      sourceType = 'partisan';
      politicalLean = 0.7;
      credibility = 2;
      break;
    }
  }
  for (const domain of partisanLeft) {
    if (urlLower.includes(domain)) {
      sourceType = 'partisan';
      politicalLean = -0.7;
      credibility = 2;
      break;
    }
  }
  for (const domain of factual) {
    if (urlLower.includes(domain)) {
      sourceType = 'impartial';
      politicalLean = 0;
      credibility = 5;
      break;
    }
  }

  // Detect fundraising/campaign pages
  if (urlLower.includes('donate') || urlLower.includes('campaign') || 
      urlLower.includes('contribute') || urlLower.includes('eoy-campaign') ||
      contentLower.includes('donate now') || contentLower.includes('contribute today')) {
    sourceType = 'partisan';
    credibility = 1;
  }

  // Detect emotional/partisan language patterns
  const partisanPhrases = [
    'radical left', 'radical right', 'socialist agenda', 'fascist',
    'destroy america', 'save america', 'fight back', 'take action now',
    'they want to', 'the left wants', 'the right wants', 'liberals want',
    'conservatives want', 'wake up', 'mainstream media', 'fake news',
    'deep state', 'big government', 'freedom fighters'
  ];

  let partisanScore = 0;
  for (const phrase of partisanPhrases) {
    if (contentLower.includes(phrase)) {
      partisanScore++;
    }
  }

  if (partisanScore >= 3) {
    sourceType = 'partisan';
    credibility = Math.min(credibility, 2);
  }

  return { sourceType, politicalLean, credibility };
}

async function getAISuggestions(metadata: any, url: string) {
  const { callLLM, parseJSONResponse } = await import('@/lib/llm');

  const prompt = `Analyze this webpage and provide structured suggestions:

URL: ${url}
Title: ${metadata.title}
Description: ${metadata.description}
Content excerpt: ${metadata.content.slice(0, 2000)}

Return JSON with:
{
  "sourceName": "Official name of the organization/publication",
  "sourceType": "impartial" or "partisan",
  "politicalLean": number from -1 (far left) to 1 (far right),
  "credibility": number 1-5,
  "suggestedTags": ["tag1", "tag2"],
  "keyFigures": [{"name": "Person Name", "role": "their role", "portrayal": "positive/negative/neutral"}],
  "claims": ["claim 1", "claim 2"],
  "summary": "2-3 sentence neutral summary",
  "issues": ["issue1", "issue2"],
  "bias_indicators": ["indicator1", "indicator2"]
}`;

  try {
    const response = await callLLM([
      { role: 'system', content: 'You are a neutral media analyst. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.3 });

    if (response.error) {
      console.error('LLM error:', response.error);
      return null;
    }

    return parseJSONResponse(response.content);
  } catch (error) {
    console.error('AI suggestion error:', error);
    return null;
  }
}

