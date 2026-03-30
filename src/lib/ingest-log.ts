// Saves raw ingest input to disk as timestamped JSON files.
// These are your receipts — if the database resets, you can re-ingest from these.
//
// Files land in /data/research-logs/{type}/{timestamp}-{slug}.json
// The /data directory is gitignored but persists on disk.

import fs from 'fs';
import path from 'path';

const LOG_ROOT = path.join(process.cwd(), 'data', 'research-logs');

type IngestType = 'research' | 'topic' | 'url' | 'manual';

export function logIngest(type: IngestType, input: any, meta?: Record<string, string>): string {
  const dir = path.join(LOG_ROOT, type);
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = slugify(input.topic || input.url || input.title || 'unnamed');
  const filename = `${timestamp}_${slug}.json`;
  const filepath = path.join(dir, filename);

  const logEntry = {
    _meta: {
      ingestType: type,
      timestamp: now.toISOString(),
      ...meta,
    },
    input,
  };

  fs.writeFileSync(filepath, JSON.stringify(logEntry, null, 2), 'utf-8');
  console.log(`[ingest-log] Saved: ${type}/${filename}`);

  return filepath;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// List all log files for a given type, newest first
export function listLogs(type?: IngestType): { type: string; filename: string; path: string; timestamp: string }[] {
  const results: { type: string; filename: string; path: string; timestamp: string }[] = [];

  const types = type ? [type] : ['research', 'topic', 'url', 'manual'] as IngestType[];

  for (const t of types) {
    const dir = path.join(LOG_ROOT, t);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const match = f.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      results.push({
        type: t,
        filename: f,
        path: path.join(dir, f),
        timestamp: match ? match[1].replace(/-/g, (m, i) => i > 9 ? ':' : m).replace('T', 'T') : '',
      });
    }
  }

  return results.sort((a, b) => b.filename.localeCompare(a.filename));
}

// Read a specific log file
export function readLog(type: IngestType, filename: string): any {
  const filepath = path.join(LOG_ROOT, type, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}
