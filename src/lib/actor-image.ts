type ActorType =
  | 'politician'
  | 'party'
  | 'lobbyist'
  | 'pac'
  | 'corporation'
  | 'media_figure'
  | 'organization'
  | 'legislation'
  | 'event'
  | string;

export type SuggestedActorImage = {
  imageUrl: string;
  source: string;
};

type SuggestActorImageOptions = {
  excludeUrls?: string[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function isPersonType(type: ActorType): boolean {
  return ['politician', 'lobbyist', 'media_figure', 'donor', 'operative'].includes(type);
}

function filePathFromCommons(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const res = await withTimeout(fetch(url, { headers: { 'User-Agent': 'worldview-agent/1.0' } }), timeoutMs);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

function toAbsoluteUrl(raw: string, base?: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

async function validateImageUrl(url: string, timeoutMs = 9000): Promise<boolean> {
  try {
    const head = await withTimeout(
      fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'worldview-agent/1.0' },
      }),
      timeoutMs
    );

    if (head.ok) {
      const ct = (head.headers.get('content-type') || '').toLowerCase();
      if (ct.startsWith('image/')) return true;
    }
  } catch {
    // Some hosts block HEAD; fall through to GET.
  }

  try {
    const get = await withTimeout(
      fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'worldview-agent/1.0' },
      }),
      timeoutMs
    );
    if (!get.ok) return false;
    const ct = (get.headers.get('content-type') || '').toLowerCase();
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}

async function firstValidImage(
  candidates: Array<{ url: string | null | undefined; source: string }>,
  excluded: Set<string>
): Promise<SuggestedActorImage | null> {
  for (const candidate of candidates) {
    if (!candidate.url) continue;
    if (excluded.has(candidate.url)) continue;
    if (await validateImageUrl(candidate.url)) {
      return { imageUrl: candidate.url, source: candidate.source };
    }
  }
  return null;
}

async function searchCommonsLogo(name: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} logo filetype:bitmap`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${query}&srlimit=5&format=json`;
    const data = await fetchJson(url);
    const results: any[] = data?.query?.search || [];
    if (results.length === 0) return null;

    const logoLike = results.find((r) => /logo/i.test(String(r?.title || ''))) || results[0];
    const title = String(logoLike?.title || '');
    if (!title.startsWith('File:')) return null;
    return filePathFromCommons(title.replace(/^File:/, ''));
  } catch {
    return null;
  }
}

async function findLogoFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const res = await withTimeout(
      fetch(websiteUrl, { headers: { 'User-Agent': 'worldview-agent/1.0' }, redirect: 'follow' }),
      9000
    );
    if (!res.ok) return null;
    const html = await res.text();

    const candidates: string[] = [];

    const metaPatterns = [
      /<meta[^>]*property=["']og:logo["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']og:logo["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    ];
    for (const pattern of metaPatterns) {
      const m = html.match(pattern);
      if (m?.[1]) candidates.push(m[1]);
    }

    const iconMatches = html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/ig) || [];
    for (const raw of iconMatches) {
      const m = raw.match(/href=["']([^"']+)["']/i);
      if (m?.[1]) candidates.push(m[1]);
    }

    const logoImgMatch = html.match(/<img[^>]*?(?:class|id)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i);
    if (logoImgMatch?.[1]) candidates.push(logoImgMatch[1]);

    const unique = Array.from(new Set(candidates))
      .map((c) => toAbsoluteUrl(c, websiteUrl))
      .filter((u): u is string => Boolean(u));

    const found = await firstValidImage(
      unique.map((u) => ({ url: u, source: 'website:meta-or-icon' })),
      new Set<string>()
    );
    return found?.imageUrl || null;
  } catch {
    return null;
  }
}

export async function suggestActorImage(
  name: string,
  type: ActorType,
  options: SuggestActorImageOptions = {}
): Promise<SuggestedActorImage | null> {
  try {
    const excluded = new Set((options.excludeUrls || []).map((u) => u.trim()).filter(Boolean));
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=5`;
    const search = await fetchJson(searchUrl);
    const candidates: any[] = search?.search || [];
    if (candidates.length === 0) return null;

    const exact = candidates.find((c) => String(c?.label || '').toLowerCase() === name.toLowerCase());
    const orderedCandidates = exact
      ? [exact, ...candidates.filter((c) => c?.id !== exact.id)]
      : candidates;

    for (const candidate of orderedCandidates) {
      if (!candidate?.id) continue;

      const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${candidate.id}.json`;
      const entityData = await fetchJson(entityUrl);
      const entity = entityData?.entities?.[candidate.id];
      const claims = entity?.claims || {};

      const p18 = claims?.P18?.[0]?.mainsnak?.datavalue?.value; // image
      const p154 = claims?.P154?.[0]?.mainsnak?.datavalue?.value; // logo image
      const p158 = claims?.P158?.[0]?.mainsnak?.datavalue?.value; // seal image
      const website = claims?.P856?.[0]?.mainsnak?.datavalue?.value; // official website

      if (isPersonType(type)) {
        const portrait = await firstValidImage([
          { url: p18 ? filePathFromCommons(p18) : null, source: `wikidata:${candidate.id}:P18` },
        ], excluded);
        if (portrait) return portrait;
        continue;
      }

      const primaryLogo = await firstValidImage([
        { url: p154 ? filePathFromCommons(p154) : null, source: `wikidata:${candidate.id}:P154` },
        { url: p158 ? filePathFromCommons(p158) : null, source: `wikidata:${candidate.id}:P158` },
      ], excluded);
      if (primaryLogo) return primaryLogo;

      const commonsLogo = await searchCommonsLogo(name);
      if (commonsLogo && !excluded.has(commonsLogo) && await validateImageUrl(commonsLogo)) {
        return { imageUrl: commonsLogo, source: `commons:logo-search:${candidate.id}` };
      }

      if (website) {
        const siteLogo = await findLogoFromWebsite(website);
        if (siteLogo && !excluded.has(siteLogo)) {
          return { imageUrl: siteLogo, source: `website-logo:${candidate.id}` };
        }

        try {
          const host = new URL(website).hostname.replace(/^www\./, '');
          const clearbit = host ? `https://logo.clearbit.com/${host}` : null;
          if (clearbit && !excluded.has(clearbit) && await validateImageUrl(clearbit)) {
            return { imageUrl: clearbit, source: `clearbit:${host}` };
          }
        } catch {
          // Ignore malformed website values.
        }
      }

      // Last-resort generic image for orgs only if valid.
      if (p18) {
        const fallback = filePathFromCommons(p18);
        if (!excluded.has(fallback) && await validateImageUrl(fallback)) {
          return { imageUrl: fallback, source: `wikidata:${candidate.id}:P18` };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
