// LLM utility supporting AlchemyAI Relay, OpenAI, and GitHub Models
//
// Provider priority:
//   1. ALCHEMY_API_KEY  → AlchemyAI / Gale relay (OpenAI-compatible, multi-model)
//   2. OPENAI_API_KEY   → Direct OpenAI
//   3. GITHUB_TOKEN     → GitHub Models (Azure-hosted)

const DEFAULT_RELAY_URL = 'https://relay.ai.gale.technology/api/relay/openai/v1';
const DEFAULT_RELAY_MODEL = 'gpt-5.4-2026-03-05';
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1500;
const FETCH_TIMEOUT_MS = 120_000; // 2 minute timeout per LLM call

type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type LLMResponse = {
  content: string | null;
  error?: string;
  model?: string;
  provider?: string;
};

type LLMOptions = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
  retries?: number;
};

export async function callLLM(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (alchemyKey) {
    return callAlchemyRelay(messages, alchemyKey, options);
  } else if (openaiKey) {
    return callOpenAI(messages, openaiKey, options);
  } else if (githubToken) {
    return callGitHubModels(messages, githubToken, options);
  }

  return { content: null, error: 'No LLM API key configured. Set ALCHEMY_API_KEY, OPENAI_API_KEY, or GITHUB_TOKEN in .env' };
}

async function callWithRetry(
  fn: () => Promise<LLMResponse>,
  retries: number = MAX_RETRIES
): Promise<LLMResponse> {
  let lastError: string | undefined;
  for (let attempt = 0; attempt < retries; attempt++) {
    const result = await fn();
    if (result.content !== null || (result.error && !isRetryable(result.error))) {
      return result;
    }
    lastError = result.error;
    const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
    console.warn(`[llm] Retry ${attempt + 1}/${retries} after ${wait}ms: ${lastError}`);
    await new Promise(r => setTimeout(r, wait));
  }
  return { content: null, error: `Failed after ${retries} retries: ${lastError}` };
}

function isRetryable(error: string): boolean {
  const retryable = [
    '429',
    'rate limit',
    'timeout',
    'aborted',
    'aborterror',
    'operation was aborted',
    'ECONNRESET',
    'ENOTFOUND',
    '502',
    '503',
    '504',
  ];
  return retryable.some(r => error.toLowerCase().includes(r.toLowerCase()));
}

async function callAlchemyRelay(messages: LLMMessage[], apiKey: string, options?: LLMOptions): Promise<LLMResponse> {
  const baseUrl = (process.env.ALCHEMY_RELAY_BASE_URL || DEFAULT_RELAY_URL).replace(/\/+$/, '');
  const model = options?.model || DEFAULT_RELAY_MODEL;
  const timeoutMs = Math.max(30_000, Math.min(options?.timeoutMs ?? FETCH_TIMEOUT_MS, 15 * 60_000));

  return callWithRetry(async () => {
    let timeout: NodeJS.Timeout | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_completion_tokens: options?.maxTokens ?? 32000,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      timeout = undefined;

      if (!response.ok) {
        const error = await response.text();
        console.error(`[llm] Alchemy relay error (${response.status}):`, error.substring(0, 200));
        return { content: null, error: `Alchemy relay error: ${response.status}`, provider: 'alchemy' };
      }

      const result = await response.json();
      return {
        content: result.choices?.[0]?.message?.content || null,
        model,
        provider: 'alchemy',
      };
    } catch (error: any) {
      console.error('[llm] Alchemy relay error:', error.message);
      return { content: null, error: `Alchemy relay: ${error.message}`, provider: 'alchemy' };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }, options?.retries ?? MAX_RETRIES);
}

async function callGitHubModels(messages: LLMMessage[], token: string, options?: LLMOptions): Promise<LLMResponse> {
  return callWithRetry(async () => {
    try {
      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: options?.model || 'gpt-4o-mini',
          messages,
          temperature: options?.temperature ?? 0.3,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('GitHub Models error:', error);
        return { content: null, error: `GitHub Models API error: ${response.status}`, provider: 'github' };
      }

      const result = await response.json();
      return { content: result.choices?.[0]?.message?.content || null, provider: 'github' };
    } catch (error) {
      console.error('GitHub Models error:', error);
      return { content: null, error: 'Failed to call GitHub Models', provider: 'github' };
    }
  });
}

async function callOpenAI(messages: LLMMessage[], apiKey: string, options?: LLMOptions): Promise<LLMResponse> {
  return callWithRetry(async () => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model || 'gpt-4o-mini',
          messages,
          temperature: options?.temperature ?? 0.3,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI error:', error);
        return { content: null, error: `OpenAI API error: ${response.status}`, provider: 'openai' };
      }

      const result = await response.json();
      return { content: result.choices?.[0]?.message?.content || null, provider: 'openai' };
    } catch (error) {
      console.error('OpenAI error:', error);
      return { content: null, error: 'Failed to call OpenAI', provider: 'openai' };
    }
  });
}

export function parseJSONResponse(content: string | null): any {
  if (!content) return null;
  
  // Helper: attempt JSON.parse with optional truncation repair
  const tryParse = (s: string): any => {
    try {
      return JSON.parse(s);
    } catch {
      // Attempt to repair truncated JSON by closing open brackets/braces
      return tryRepairTruncated(s);
    }
  };

  // Direct parse
  const direct = tryParse(content.trim());
  if (direct !== null) return direct;

  // Try to extract JSON from markdown code blocks
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    const parsed = tryParse(match[1].trim());
    if (parsed !== null) return parsed;
  }
  
  // Try to find raw JSON object
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = tryParse(jsonMatch[0]);
    if (parsed !== null) return parsed;
  }

  // Last resort: find the opening brace and try to repair from there
  const braceIdx = content.indexOf('{');
  if (braceIdx !== -1) {
    const parsed = tryRepairTruncated(content.substring(braceIdx));
    if (parsed !== null) return parsed;
  }
  
  return null;
}

function tryRepairTruncated(s: string): any {
  // If the JSON was truncated mid-stream, try progressively aggressive repairs:
  // 1. Strip trailing incomplete key/value after the last complete value
  // 2. Close all open brackets and braces

  // First try as-is
  try { return JSON.parse(s); } catch {}

  // Find the last valid structural character
  let trimmed = s.replace(/,\s*$/, ''); // remove trailing comma
  
  // Count open vs close braces/brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;
  let lastGoodIdx = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
    
    // Track last position where we had a valid value end
    if (c === '}' || c === ']' || c === '"' || (c >= '0' && c <= '9') || c === 'e' || c === 'l' || c === 'u') {
      lastGoodIdx = i;
    }
  }

  if (braces === 0 && brackets === 0) {
    // Already balanced, try parse
    try { return JSON.parse(trimmed); } catch {}
  }

  // Cut to last good position and try to close
  trimmed = trimmed.substring(0, lastGoodIdx + 1);
  trimmed = trimmed.replace(/,\s*$/, '');
  
  // Close open brackets then braces
  for (let i = 0; i < brackets; i++) trimmed += ']';
  for (let i = 0; i < braces; i++) trimmed += '}';

  try { return JSON.parse(trimmed); } catch {}

  // More aggressive: strip back to the last complete array element or object property
  // Look for the last "}," or "]," or complete value before truncation
  const lastComplete = trimmed.replace(/,?\s*"[^"]*"?\s*:?\s*(?:"[^"]*)?$/, '');
  if (lastComplete !== trimmed) {
    let repaired = lastComplete.replace(/,\s*$/, '');
    // Recount and close
    braces = 0; brackets = 0; inString = false; escape = false;
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') braces++;
      else if (c === '}') braces--;
      else if (c === '[') brackets++;
      else if (c === ']') brackets--;
    }
    for (let i = 0; i < brackets; i++) repaired += ']';
    for (let i = 0; i < braces; i++) repaired += '}';
    try { return JSON.parse(repaired); } catch {}
  }

  return null;
}
