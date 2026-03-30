'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Category = { id: string; name: string; slug: string };
type Tag = { id: string; name: string; color: string };

export default function IngestPage() {
  const [activeTab, setActiveTab] = useState<'topic' | 'research' | 'url' | 'manual'>('topic');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/tags').then(r => r.json()),
    ]).then(([cats, tgs]) => {
      setCategories(cats);
      setTags(tgs);
    });
  }, []);

  const tabs = [
    { key: 'topic' as const, label: 'Topic Research', desc: 'Type a topic or concept and the system will research and populate itself via LLM' },
    { key: 'research' as const, label: 'Paste Research', desc: 'Paste structured JSON from an LLM research session' },
    { key: 'url' as const, label: 'Submit URL', desc: 'Add a URL to extract and process' },
    { key: 'manual' as const, label: 'Manual Entry', desc: 'Manually add a single evidence source' },
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Ingest Evidence</h1>
            <p className="text-slate-500 mt-1">Add sources via LLM research, URL, or manual entry</p>
          </div>
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">&larr; Admin Panel</Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {tabs.find(t => t.key === activeTab)?.desc}
        </p>

        {activeTab === 'topic' && <TopicResearchForm />}
        {activeTab === 'research' && <ResearchPasteForm />}
        {activeTab === 'url' && <UrlSubmitForm />}
        {activeTab === 'manual' && <ManualEntryForm categories={categories} tags={tags} />}
      </div>
    </main>
  );
}

// ── Topic Research Form ──

function TopicResearchForm() {
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<'standard' | 'deep'>('standard');
  const [status, setStatus] = useState<'idle' | 'searching' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);

  const handleSearch = async () => {
    if (!topic.trim()) return;
    setStatus('searching');
    setExisting(null);
    setResult(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(topic.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setExisting({ error: data.error || `Search failed (${res.status})` });
      } else {
        setExisting(data);
      }
      setStatus('idle');
    } catch (e: any) {
      setExisting({ error: e.message });
      setStatus('idle');
    }
  };

  const handleResearch = async () => {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/ingest/topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, depth }),
      });
      const data = await res.json();
      setResult(data);
      setStatus(!res.ok || data.error ? 'error' : 'success');
    } catch (e: any) {
      setStatus('error');
      setResult({ error: e.message });
    }
  };

  const examples = [
    'The Powell Memo and its influence on corporate political strategy',
    'Citizens United v. FEC — full history, actors, and consequences',
    'The Southern Strategy and party realignment on civil rights',
    'Mitch McConnell\'s record on campaign finance reform',
    'The revolving door between Goldman Sachs and the Treasury Department',
    'How the Federalist Society shaped the federal judiciary',
  ];

  return (
    <div className="space-y-4">
      {/* Input + Search */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Topic, Concept, or Research Question
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={e => { setTopic(e.target.value); setExisting(null); }}
            className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="e.g., The Powell Memo"
            onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) handleSearch(); }}
          />
          <button
            onClick={handleSearch}
            disabled={!topic.trim() || status === 'searching'}
            className="px-5 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-lg hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm whitespace-nowrap"
          >
            {status === 'searching' ? 'Checking...' : 'Check Existing'}
          </button>
        </div>

        {/* Example topics */}
        {!topic && !existing && (
          <div className="mt-3">
            <p className="text-xs text-slate-400 mb-2">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {examples.map(ex => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setTopic(ex)}
                  className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors text-left"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Existing Coverage Panel */}
      {existing && existing.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-800">Search Error</p>
          <p className="text-sm text-red-600 mt-1">{existing.error}</p>
        </div>
      )}
      {existing && !existing.error && (
        <CoveragePanel data={existing} />
      )}

      {/* Research Controls — show after search, or if user just wants to go */}
      {(existing || topic.trim()) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-slate-700">Research Depth</label>
            {existing?.coverage?.total > 0 && (
              <span className="text-xs text-slate-400">
                Will add to {existing.coverage.total} existing record{existing.coverage.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              depth === 'standard' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input type="radio" name="depth" value="standard" checked={depth === 'standard'} onChange={() => setDepth('standard')} className="sr-only" />
              <span className="font-medium text-sm">Standard</span>
              <p className="text-xs text-slate-500 mt-1">Single LLM pass. Evidence, entities, relationships, timeline. ~1 min.</p>
            </label>
            <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              depth === 'deep' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input type="radio" name="depth" value="deep" checked={depth === 'deep'} onChange={() => setDepth('deep')} className="sr-only" />
              <span className="font-medium text-sm">Deep</span>
              <p className="text-xs text-slate-500 mt-1">Two-pass: first for evidence, then deeper relationships and analysis. ~2 min.</p>
            </label>
          </div>

          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-slate-400">
              {status === 'loading' && (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-pulse">Researching...</span>
                  <span className="text-xs">(this may take a minute)</span>
                </span>
              )}
            </span>
            <button
              onClick={handleResearch}
              disabled={!topic.trim() || status === 'loading'}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {status === 'loading' ? 'Researching...' : 'Research & Ingest'}
            </button>
          </div>
        </div>
      )}

      {/* Ingest Results */}
      {result && (
        <div className="space-y-4">
          {result.llmSummary && (
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <p className="text-sm font-medium text-slate-700 mb-1">LLM Summary</p>
              <p className="text-sm text-slate-600">{result.llmSummary}</p>
            </div>
          )}
          {result.suggestedTopics?.length > 0 && (
            <div className="bg-indigo-50 rounded-lg shadow-sm p-4 border border-indigo-200">
              <p className="text-sm font-semibold text-indigo-800 mb-2">Suggested Follow-up Topics</p>
              <div className="space-y-2">
                {result.suggestedTopics.map((t: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${
                      t.priority === 'high' ? 'bg-red-100 text-red-700' :
                      t.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{t.priority}</span>
                    <div>
                      <p className="text-sm font-medium text-indigo-900">{t.topic}</p>
                      <p className="text-xs text-indigo-600 mt-0.5">{t.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ResultPanel result={result} status={status} />
        </div>
      )}
    </div>
  );
}

// ── Coverage Panel (search results summary) ──

function CoveragePanel({ data }: { data: any }) {
  const { coverage, gaps, breakdown, results, copyPasteContext } = data;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (copyPasteContext) {
      navigator.clipboard.writeText(copyPasteContext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (coverage.total === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="font-medium text-slate-700">No existing data found</p>
        <p className="text-sm text-slate-500 mt-1">This is a fresh topic. Use Mode 1 (Fresh Research) from the protocol, or hit Research &amp; Ingest below.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Coverage counts bar */}
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-slate-800">
            {coverage.total} existing record{coverage.total !== 1 ? 's' : ''} found
          </p>
          <span className="text-xs text-slate-400">for &ldquo;{data.query}&rdquo;</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {coverage.evidence > 0 && <CountBadge label="Evidence" count={coverage.evidence} color="blue" />}
          {coverage.entities > 0 && <CountBadge label="Entities" count={coverage.entities} color="purple" />}
          {coverage.politicians > 0 && <CountBadge label="Politicians" count={coverage.politicians} color="slate" />}
          {coverage.institutions > 0 && <CountBadge label="Institutions" count={coverage.institutions} color="teal" />}
          {coverage.analyses > 0 && <CountBadge label="Analyses" count={coverage.analyses} color="amber" />}
          {coverage.timelineEvents > 0 && <CountBadge label="Timeline" count={coverage.timelineEvents} color="green" />}
          {coverage.politicalActions > 0 && <CountBadge label="Actions" count={coverage.politicalActions} color="red" />}
          {coverage.relationships > 0 && <CountBadge label="Relationships" count={coverage.relationships} color="indigo" />}
        </div>
      </div>

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="p-4 border-b bg-amber-50">
          <p className="text-sm font-medium text-amber-800 mb-1">Coverage Gaps</p>
          <ul className="text-sm text-amber-700 space-y-0.5">
            {gaps.map((g: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">&#9679;</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copy for LLM button */}
      {copyPasteContext && (
        <div className="p-3 border-b flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Copy this summary to paste into an LLM with the Gap Fill prompt (Mode 2 in RESEARCH_PROTOCOL.md)
          </p>
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {copied ? 'Copied!' : 'Copy for LLM'}
          </button>
        </div>
      )}

      {/* Breakdown details — collapsible */}
      <details className="group">
        <summary className="p-4 cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800 select-none">
          Show details
        </summary>
        <div className="px-4 pb-4 space-y-4">
          {/* Category distribution */}
          {Object.keys(breakdown.categories || {}).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Pillars</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(breakdown.categories).map(([name, count]: [string, any]) => (
                  <span key={name} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                    {name} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {Object.keys(breakdown.tags || {}).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(breakdown.tags).map(([name, count]: [string, any]) => (
                  <span key={name} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                    {name} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verification status */}
          {Object.keys(breakdown.verificationStatus || {}).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Verification</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(breakdown.verificationStatus).map(([status, count]: [string, any]) => (
                  <span key={status} className={`px-2 py-0.5 text-xs rounded ${
                    status === 'verified' ? 'bg-green-50 text-green-700' :
                    status === 'contested' ? 'bg-red-50 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {status} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Relationship tiers */}
          {Object.keys(breakdown.relationshipTiers || {}).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Relationship Tiers</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(breakdown.relationshipTiers).map(([tier, count]: [string, any]) => (
                  <span key={tier} className={`px-2 py-0.5 text-xs rounded ${
                    tier === 'documented' ? 'bg-green-50 text-green-700' :
                    tier === 'interactional' ? 'bg-blue-50 text-blue-700' :
                    'bg-purple-50 text-purple-700'
                  }`}>
                    Tier {tier === 'documented' ? '1' : tier === 'interactional' ? '2' : '3'}: {tier} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Evidence list */}
          {results.evidence?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Evidence Items</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {results.evidence.map((e: any) => (
                  <div key={e.id} className="flex items-start gap-2 p-2 bg-slate-50 rounded text-xs">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded font-medium ${
                      e.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                      e.verificationStatus === 'contested' ? 'bg-red-100 text-red-700' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {e.verificationStatus || '?'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{e.title}</p>
                      <p className="text-slate-500 truncate">{e.summary}</p>
                      {e.tags?.length > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {e.tags.map((t: string) => (
                            <span key={t} className="text-blue-600">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {e.sourceName && <span className="text-slate-400 whitespace-nowrap">{e.sourceName}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entities list */}
          {results.entities?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Entities</p>
              <div className="flex flex-wrap gap-1.5">
                {results.entities.map((e: any) => (
                  <span key={e.id} className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded">
                    {e.name}
                    <span className="text-purple-400 ml-1">({e.type}{e._count?.evidence > 0 ? `, ${e._count.evidence} refs` : ''})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {results.timelineEvents?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Timeline</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {results.timelineEvents.map((e: any) => (
                  <div key={e.id} className="flex gap-2 text-xs">
                    <span className="text-slate-400 whitespace-nowrap font-mono">{e.eventDate?.slice(0, 10) || '?'}</span>
                    <span className="text-slate-700">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function CountBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    slate: 'bg-slate-100 text-slate-700',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[color] || colors.slate}`}>
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}

// ── Research Paste Form ──

function ResearchPasteForm() {
  const [json, setJson] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    setStatus('loading');
    try {
      // Try to parse to validate
      let parsed;
      try {
        const cleaned = json.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        setStatus('error');
        setResult({ error: 'Invalid JSON. Make sure the LLM output is valid JSON.' });
        return;
      }

      const res = await fetch('/api/ingest/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setResult(data);
      setStatus(!res.ok || data.error ? 'error' : 'success');
    } catch (e: any) {
      setStatus('error');
      setResult({ error: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Paste LLM Research Output (JSON)
        </label>
        <textarea
          value={json}
          onChange={e => setJson(e.target.value)}
          className="w-full h-96 p-3 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder='Paste the JSON output from your LLM research session here. Supports raw JSON or JSON wrapped in ```json code blocks.'
        />
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-slate-400">
            {json.length > 0 ? `${json.length.toLocaleString()} characters` : 'No content'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!json.trim() || status === 'loading'}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {status === 'loading' ? 'Processing...' : 'Ingest Research'}
          </button>
        </div>
      </div>

      {result && <ResultPanel result={result} status={status} />}
    </div>
  );
}

// ── URL Submit Form ──

function UrlSubmitForm() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'source' | 'investigate'>('source');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/ingest/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode }),
      });
      const data = await res.json();
      setResult(data);
      setStatus(!res.ok || data.error ? 'error' : 'success');
    } catch (e: any) {
      setStatus('error');
      setResult({ error: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">URL</label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="https://..."
        />

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Mode</label>
          <div className="flex gap-3">
            <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              mode === 'source' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input type="radio" name="mode" value="source" checked={mode === 'source'} onChange={() => setMode('source')} className="sr-only" />
              <span className="font-medium text-sm">Add as Source</span>
              <p className="text-xs text-slate-500 mt-1">Save this URL as evidence. Basic metadata extraction.</p>
            </label>
            <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              mode === 'investigate' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input type="radio" name="mode" value="investigate" checked={mode === 'investigate'} onChange={() => setMode('investigate')} className="sr-only" />
              <span className="font-medium text-sm">Investigate</span>
              <p className="text-xs text-slate-500 mt-1">Fetch content and send to LLM for entity extraction and tagging.</p>
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || status === 'loading'}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {status === 'loading' ? 'Processing...' : mode === 'investigate' ? 'Fetch & Investigate' : 'Add Source'}
          </button>
        </div>
      </div>

      {result && <ResultPanel result={result} status={status} />}
    </div>
  );
}

// ── Manual Entry Form ──

function ManualEntryForm({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [content, setContent] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [sourceClassification, setSourceClassification] = useState('secondary_source');
  const [verificationStatus, setVerificationStatus] = useState('single_source');
  const [categorySlug, setCategorySlug] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/ingest/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          sourceUrl: sourceUrl || undefined,
          sourceName: sourceName || undefined,
          content: content || undefined,
          eventDate: eventDate || undefined,
          sourceClassification,
          verificationStatus,
          categorySlug: categorySlug || undefined,
          tagNames: selectedTags,
        }),
      });
      const data = await res.json();
      setResult(data);
      setStatus(!res.ok || data.error ? 'error' : 'success');
      if (res.ok && !data.error) {
        setTitle(''); setSummary(''); setSourceUrl(''); setSourceName('');
        setContent(''); setEventDate(''); setSelectedTags([]);
      }
    } catch (e: any) {
      setStatus('error');
      setResult({ error: e.message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            className="w-full p-2.5 border border-slate-300 rounded-lg" placeholder="Evidence title" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Summary *</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} required rows={2}
            className="w-full p-2.5 border border-slate-300 rounded-lg" placeholder="Neutral 1-2 sentence summary" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source URL</label>
            <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source Name</label>
            <input value={sourceName} onChange={e => setSourceName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg" placeholder="e.g., Congressional Record" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event Date</label>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source Type</label>
            <select value={sourceClassification} onChange={e => setSourceClassification(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg">
              <option value="primary_source">Primary Source</option>
              <option value="secondary_source">Secondary Source</option>
              <option value="opinion_editorial">Opinion / Editorial</option>
              <option value="raw_data">Raw Data</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Verification</label>
            <select value={verificationStatus} onChange={e => setVerificationStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg">
              <option value="verified">Verified</option>
              <option value="single_source">Single Source</option>
              <option value="contested">Contested</option>
              <option value="inconclusive">Inconclusive</option>
              <option value="misreported">Misreported</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select value={categorySlug} onChange={e => setCategorySlug(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-lg">
            <option value="">None</option>
            {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTags(prev =>
                  prev.includes(t.name) ? prev.filter(n => n !== t.name) : [...prev, t.name]
                )}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  selectedTags.includes(t.name)
                    ? 'text-white ring-2 ring-offset-1 ring-slate-400'
                    : 'text-white opacity-50 hover:opacity-75'
                }`}
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Content (optional)</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={6}
            className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-sm"
            placeholder="Full article text, transcript, or document content..." />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={status === 'loading'}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 font-medium">
            {status === 'loading' ? 'Saving...' : 'Add Evidence'}
          </button>
        </div>
      </div>

      {result && <ResultPanel result={result} status={status} />}
    </form>
  );
}

// ── Result Panel ──

function ResultPanel({ result, status }: { result: any; status: string }) {
  if (result.error && !result.created) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="font-medium text-red-800">Error</p>
        <p className="text-red-700 text-sm mt-1">{result.error}</p>
      </div>
    );
  }

  const created = result.created;
  const hasCreated = created && Object.values(created).some((v: any) => v > 0);

  return (
    <div className={`rounded-lg p-4 border ${status === 'success' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <p className={`font-medium ${status === 'success' ? 'text-green-800' : 'text-amber-800'}`}>
        {status === 'success' ? 'Ingestion Complete' : 'Partial Success'}
      </p>

      {hasCreated && (
        <div className="flex flex-wrap gap-3 mt-2">
          {created.evidence > 0 && <Badge label="Evidence" count={created.evidence} />}
          {created.entities > 0 && <Badge label="Entities" count={created.entities} />}
          {created.relationships > 0 && <Badge label="Relationships" count={created.relationships} />}
          {created.actions > 0 && <Badge label="Actions" count={created.actions} />}
          {created.analyses > 0 && <Badge label="Analyses" count={created.analyses} />}
          {created.events > 0 && <Badge label="Events" count={created.events} />}
          {created.tags > 0 && <Badge label="Tags" count={created.tags} />}
          {created.questions > 0 && <Badge label="Questions" count={created.questions} />}
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-amber-700">Warnings:</p>
          <ul className="text-sm text-amber-600 mt-1 space-y-0.5">
            {result.warnings.map((w: string, i: number) => (
              <li key={i}>&bull; {w}</li>
            ))}
          </ul>
        </div>
      )}

      {result.errors?.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium text-red-700">Errors:</p>
          <ul className="text-sm text-red-600 mt-1 space-y-0.5">
            {result.errors.map((e: string, i: number) => (
              <li key={i}>&bull; {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* For non-research ingestion, show the created item */}
      {result.id && result.title && (
        <p className="text-sm text-green-700 mt-2">Created: {result.title}</p>
      )}
    </div>
  );
}

function Badge({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-sm font-medium text-slate-700 border">
      <span className="font-bold text-slate-900">{count}</span> {label}
    </span>
  );
}
