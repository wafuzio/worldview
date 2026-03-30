'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Tag = { id: string; name: string; color: string; synonyms: { phrase: string }[] };
type Evidence = {
  id: string;
  title: string;
  content: string | null;
  rawContent: string | null;
  sourceType: string;
  suggestedTags: string | null;
  suggestedQuestions: string | null;
  categoryId?: string | null;
};

type UrlExtraction = {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  content: string;
  sourceType: 'impartial' | 'partisan';
  politicalLean: number;
  credibility: number;
  matchedTags: { id: string; name: string; color: string; matchCount: number }[];
  aiSuggestions: {
    sourceName: string;
    sourceType: string;
    politicalLean: number;
    credibility: number;
    suggestedTags: string[];
    keyFigures: { name: string; role: string; portrayal: string }[];
    claims: string[];
    summary: string;
    issues: string[];
    bias_indicators: string[];
  } | null;
  metadata: { author: string; image: string; keywords: string[] };
};

export default function DocumentsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState<'impartial' | 'partisan'>('impartial');
  const [credibility, setCredibility] = useState(3);
  const [politicalLean, setPoliticalLean] = useState(0);
  const [publishedAt, setPublishedAt] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [dateAccuracy, setDateAccuracy] = useState<'day' | 'month' | 'year' | 'approximate'>('day');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [suggestions, setSuggestions] = useState<{ tags: string[]; questions: any[] }>({ tags: [], questions: [] });
  const [extraction, setExtraction] = useState<UrlExtraction | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [entities, setEntities] = useState<{
    people: any[];
    organizations: any[];
    places: any[];
    legislation: any[];
    events: any[];
    media: any[];
    other: any[];
  } | null>(null);
  const [extractingEntities, setExtractingEntities] = useState(false);
  const [extractedEvents, setExtractedEvents] = useState<any[]>([]);
  const [extractingEvents, setExtractingEvents] = useState(false);
  const [existingEvidence, setExistingEvidence] = useState<Evidence[]>([]);
  const [showBrowser, setShowBrowser] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetch('/api/tags?includeSynonyms=true')
      .then((r) => r.json())
      .then(setTags);
    
    // Load existing evidence
    fetch('/api/evidence')
      .then((r) => r.json())
      .then(setExistingEvidence);
  }, []);

  const loadEvidence = async (id: string) => {
    const res = await fetch(`/api/evidence/${id}`);
    const data = await res.json();
    setEvidence(data);
    setTitle(data.title || '');
    setSummary(data.summary || '');
    setSourceName(data.sourceName || '');
    setSourceType(data.sourceType || 'impartial');
    setCredibility(data.credibility || 3);
    setPoliticalLean(data.politicalLean || 0);
    setUrl(data.sourceUrl || '');
    setPublishedAt(data.publishedAt ? data.publishedAt.split('T')[0] : '');
    setEventDate(data.eventDate ? data.eventDate.split('T')[0] : '');
    setDateAccuracy(data.dateAccuracy || 'day');
    setEditMode(true);
    setShowBrowser(false);
  };

  const saveEvidence = async () => {
    if (!evidence) return;
    setLoading(true);
    
    const res = await fetch(`/api/evidence/${evidence.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        summary,
        sourceName,
        sourceType,
        credibility,
        politicalLean,
        sourceUrl: url,
        publishedAt: publishedAt || null,
        eventDate: eventDate || null,
        dateAccuracy,
      }),
    });
    
    if (res.ok) {
      // Refresh the list
      const listRes = await fetch('/api/evidence');
      setExistingEvidence(await listRes.json());
    }
    setLoading(false);
  };

  const deleteEvidence = async (id: string) => {
    if (!confirm('Delete this evidence?')) return;
    
    await fetch(`/api/evidence/${id}`, { method: 'DELETE' });
    setExistingEvidence(prev => prev.filter(e => e.id !== id));
    if (evidence?.id === id) {
      setEvidence(null);
      setEditMode(false);
    }
  };

  const resetForm = () => {
    setEvidence(null);
    setExtraction(null);
    setEntities(null);
    setTitle('');
    setSummary('');
    setSourceName('');
    setUrl('');
    setSourceType('impartial');
    setCredibility(3);
    setPoliticalLean(0);
    setPublishedAt('');
    setEventDate('');
    setDateAccuracy('day');
    setSelectedTags([]);
    setEditMode(false);
    setShowBrowser(true);
  };

  // Extract URL metadata and auto-populate fields
  const extractUrl = async () => {
    if (!url) return;
    setExtracting(true);

    try {
      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data: UrlExtraction = await res.json();
      
      if (data.title) {
        setExtraction(data);
        
        // Auto-populate form fields
        setTitle(data.aiSuggestions?.sourceName ? `${data.title}` : data.title);
        setSummary(data.aiSuggestions?.summary || data.summary || '');
        setSourceName(data.aiSuggestions?.sourceName || data.sourceName || '');
        setSourceType(data.sourceType);
        setCredibility(data.aiSuggestions?.credibility || data.credibility);
        setPoliticalLean(data.aiSuggestions?.politicalLean || data.politicalLean);
        
        // Auto-select matched tags
        const matchedIds = data.matchedTags.map(t => t.id);
        setSelectedTags(matchedIds);
        
        // Add AI suggested tags to suggestions
        if (data.aiSuggestions?.suggestedTags) {
          setSuggestions(prev => ({ ...prev, tags: data.aiSuggestions!.suggestedTags }));
        }
      }
    } catch (error) {
      console.error('Extraction failed:', error);
    }

    setExtracting(false);
  };

  // Extract named entities from content
  const extractEntities = async (content: string) => {
    setExtractingEntities(true);
    try {
      const res = await fetch('/api/entities/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.categorized) {
        setEntities(data.categorized);
      }
    } catch (error) {
      console.error('Entity extraction failed:', error);
    }
    setExtractingEntities(false);
  };

  // Extract historical events from content
  const extractEvents = async (content: string) => {
    setExtractingEvents(true);
    try {
      const res = await fetch('/api/events/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, evidenceId: evidence?.id }),
      });
      const data = await res.json();
      if (data.events) {
        setExtractedEvents(data.events);
      }
    } catch (error) {
      console.error('Event extraction failed:', error);
    }
    setExtractingEvents(false);
  };

  // Save an extracted event to the database
  const saveEvent = async (event: any) => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          evidenceId: evidence?.id,
          excerpt: event.excerpt,
        }),
      });
      if (res.ok) {
        // Remove from extracted list
        setExtractedEvents(prev => prev.filter(e => e.title !== event.title));
      }
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('url', url);
    formData.append('title', title);
    formData.append('sourceType', sourceType);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setEvidence(data);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);
    formData.append('sourceType', sourceType);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setEvidence(data);
    setLoading(false);
  };

  const analyzeDocument = async (action: string) => {
    if (!evidence) return;
    setAnalyzing(true);

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidenceId: evidence.id, action }),
    });
    const data = await res.json();

    if (action === 'suggest_tags') {
      setSuggestions((prev) => ({ ...prev, tags: data.result || [] }));
    } else if (action === 'generate_questions') {
      setSuggestions((prev) => ({ ...prev, questions: data.result || [] }));
    }

    setAnalyzing(false);
  };

  // Highlight tags and synonyms in content
  const highlightContent = useCallback((content: string) => {
    if (!content || tags.length === 0) return content;

    let highlighted = content;
    const matches: { start: number; end: number; color: string; tag: string }[] = [];

    // Find all tag and synonym matches
    for (const tag of tags) {
      const patterns = [tag.name, ...(tag.synonyms?.map((s) => s.phrase) || [])];
      for (const pattern of patterns) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        let match;
        while ((match = regex.exec(content)) !== null) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            color: tag.color,
            tag: tag.name,
          });
        }
      }
    }

    // Sort by position (reverse to replace from end)
    matches.sort((a, b) => b.start - a.start);

    // Apply highlights
    for (const m of matches) {
      const before = highlighted.slice(0, m.start);
      const text = highlighted.slice(m.start, m.end);
      const after = highlighted.slice(m.end);
      highlighted = `${before}<mark style="background-color: ${m.color}40; border-bottom: 2px solid ${m.color};" title="${m.tag}">${text}</mark>${after}`;
    }

    return highlighted;
  }, [tags]);

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Document Editor</h1>
          <div className="flex gap-4">
            {(evidence || !showBrowser) && (
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
              >
                ← Back to List
              </button>
            )}
            <Link href="/admin" className="text-blue-600 hover:underline py-2">← Back to Admin</Link>
          </div>
        </div>

        {/* Evidence Browser */}
        {showBrowser && !evidence && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Existing Evidence ({existingEvidence.length})</h2>
              <button
                onClick={() => setShowBrowser(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add New
              </button>
            </div>
            
            {existingEvidence.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No evidence yet. Click "Add New" to get started.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {existingEvidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3 border rounded hover:bg-slate-50 cursor-pointer group"
                    onClick={() => loadEvidence(ev.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{ev.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          ev.sourceType === 'partisan' 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {ev.sourceType}
                        </span>
                      </div>
                      {ev.content && (
                        <p className="text-sm text-slate-500 truncate">{ev.content.slice(0, 100)}...</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteEvidence(ev.id); }}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload Section */}
        {!evidence && !showBrowser && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Add Document</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Source Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={sourceType === 'impartial'}
                    onChange={() => setSourceType('impartial')}
                  />
                  <span>Impartial (factual reporting)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={sourceType === 'partisan'}
                    onChange={() => setSourceType('partisan')}
                  />
                  <span>Partisan (opinion/spin to fact-check)</span>
                </label>
              </div>
            </div>

            {/* URL Input with Extract Button */}
            <div className="space-y-4">
              <h3 className="font-medium">From URL</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="flex-1 p-2 border rounded"
                />
                <button
                  type="button"
                  onClick={extractUrl}
                  disabled={extracting || !url}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {extracting ? 'Analyzing...' : '🔍 Analyze URL'}
                </button>
              </div>
            </div>

            {/* Extraction Results */}
            {extraction && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-purple-900">Auto-Extracted Data</h3>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      extraction.sourceType === 'partisan' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {extraction.sourceType}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100">
                      Credibility: {extraction.credibility}/5
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      extraction.politicalLean > 0.3 ? 'bg-red-100 text-red-700' :
                      extraction.politicalLean < -0.3 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      Lean: {extraction.politicalLean > 0 ? '+' : ''}{(extraction.politicalLean * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* AI Analysis Results */}
                {extraction.aiSuggestions && (
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-purple-800">Key Figures Detected:</p>
                      <ul className="mt-1 space-y-1">
                        {extraction.aiSuggestions.keyFigures?.map((fig, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              fig.portrayal === 'positive' ? 'bg-green-500' :
                              fig.portrayal === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            <span>{fig.name}</span>
                            <span className="text-slate-500">({fig.role})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-purple-800">Issues Identified:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {extraction.aiSuggestions.issues?.map((issue, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </div>
                    {extraction.aiSuggestions.bias_indicators?.length > 0 && (
                      <div className="md:col-span-2">
                        <p className="font-medium text-orange-800">Bias Indicators:</p>
                        <ul className="mt-1 text-orange-700 text-xs space-y-1">
                          {extraction.aiSuggestions.bias_indicators.map((ind, i) => (
                            <li key={i}>⚠️ {ind}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {extraction.aiSuggestions.claims?.length > 0 && (
                      <div className="md:col-span-2">
                        <p className="font-medium text-purple-800">Claims to Fact-Check:</p>
                        <ul className="mt-1 space-y-1">
                          {extraction.aiSuggestions.claims.slice(0, 5).map((claim, i) => (
                            <li key={i} className="text-slate-700">• {claim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Matched Tags (Issues) - Clickable to add */}
                {extraction.matchedTags.length > 0 && (
                  <div>
                    <p className="font-medium text-purple-800 text-sm">Issue Tags (click to add):</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extraction.matchedTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            if (!selectedTags.includes(tag.id)) {
                              setSelectedTags([...selectedTags, tag.id]);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-white text-xs transition-all ${
                            selectedTags.includes(tag.id) ? 'ring-2 ring-offset-1 ring-green-500' : 'hover:ring-2 hover:ring-offset-1'
                          }`}
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name} ({tag.matchCount}) {selectedTags.includes(tag.id) && '✓'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggested Tags - Clickable */}
                {suggestions.tags.length > 0 && (
                  <div>
                    <p className="font-medium text-purple-800 text-sm">AI Suggested Tags (click to add):</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestions.tags.map((tagName, i) => {
                        const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (existingTag && !selectedTags.includes(existingTag.id)) {
                                setSelectedTags([...selectedTags, existingTag.id]);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-xs transition-all ${
                              existingTag 
                                ? selectedTags.includes(existingTag.id)
                                  ? 'bg-green-600 text-white ring-2 ring-offset-1 ring-green-500'
                                  : 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                            }`}
                            disabled={!existingTag}
                            title={existingTag ? 'Click to add' : 'Tag not in system - create it first'}
                          >
                            {tagName} {existingTag && selectedTags.includes(existingTag.id) && '✓'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Extract Entities & Events Buttons */}
                <div className="pt-2 border-t flex gap-2">
                  <button
                    type="button"
                    onClick={() => extractEntities(extraction.content)}
                    disabled={extractingEntities}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {extractingEntities ? 'Extracting...' : '👤 Extract Names & Entities'}
                  </button>
                  <button
                    type="button"
                    onClick={() => extractEvents(extraction.content)}
                    disabled={extractingEvents}
                    className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                  >
                    {extractingEvents ? 'Extracting...' : '📅 Extract Timeline Events'}
                  </button>
                </div>
              </div>
            )}

            {/* Extracted Entities Display */}
            {entities && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-indigo-900">Named Entities</h3>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {/* People */}
                  {entities.people.length > 0 && (
                    <div>
                      <p className="font-medium text-indigo-800 mb-2">👤 People ({entities.people.length})</p>
                      <ul className="space-y-1">
                        {entities.people.map((e, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                              e.sentiment === 'positive' ? 'bg-green-500' :
                              e.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            <div>
                              <span className="font-medium">{e.name}</span>
                              {e.title && <span className="text-slate-500 text-xs block">{e.title}</span>}
                              {e.affiliation && <span className="text-slate-400 text-xs">({e.affiliation})</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Organizations */}
                  {entities.organizations.length > 0 && (
                    <div>
                      <p className="font-medium text-indigo-800 mb-2">🏛️ Organizations ({entities.organizations.length})</p>
                      <ul className="space-y-1">
                        {entities.organizations.map((e, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                              e.sentiment === 'positive' ? 'bg-green-500' :
                              e.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            <span>{e.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Places */}
                  {entities.places.length > 0 && (
                    <div>
                      <p className="font-medium text-indigo-800 mb-2">📍 Places ({entities.places.length})</p>
                      <ul className="space-y-1">
                        {entities.places.map((e, i) => (
                          <li key={i}>{e.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Legislation */}
                  {entities.legislation.length > 0 && (
                    <div>
                      <p className="font-medium text-indigo-800 mb-2">📜 Legislation ({entities.legislation.length})</p>
                      <ul className="space-y-1">
                        {entities.legislation.map((e, i) => (
                          <li key={i}>{e.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Media */}
                  {entities.media.length > 0 && (
                    <div>
                      <p className="font-medium text-indigo-800 mb-2">📰 Media ({entities.media.length})</p>
                      <ul className="space-y-1">
                        {entities.media.map((e, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                              e.sentiment === 'positive' ? 'bg-green-500' :
                              e.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            <span>{e.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Events */}
                  {entities.events.length > 0 && (
                    <div>
                      <p className="font-medium text-indigo-800 mb-2">📅 Events ({entities.events.length})</p>
                      <ul className="space-y-1">
                        {entities.events.map((e, i) => (
                          <li key={i}>{e.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Extracted Events Display */}
            {extractedEvents.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-amber-900">📅 Extracted Timeline Events ({extractedEvents.length})</h3>
                  <span className="text-xs text-amber-600">Click "Save" to add events to the database</span>
                </div>
                
                <div className="space-y-3">
                  {extractedEvents.map((event, i) => (
                    <div key={i} className="bg-white rounded p-3 border border-amber-100">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              event.eventType === 'legislation' ? 'bg-purple-100 text-purple-700' :
                              event.eventType === 'vote' ? 'bg-blue-100 text-blue-700' :
                              event.eventType === 'speech' ? 'bg-green-100 text-green-700' :
                              event.eventType === 'scandal' ? 'bg-red-100 text-red-700' :
                              event.eventType === 'election' ? 'bg-indigo-100 text-indigo-700' :
                              event.eventType === 'court' ? 'bg-slate-100 text-slate-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {event.eventType}
                            </span>
                            <span className="text-sm font-medium text-amber-800">
                              {event.eventDate}
                              {event.dateAccuracy !== 'day' && ` (${event.dateAccuracy})`}
                            </span>
                          </div>
                          <h4 className="font-medium mt-1">{event.title}</h4>
                          {event.description && (
                            <p className="text-sm text-slate-600 mt-1">{event.description}</p>
                          )}
                          {event.primaryActors && event.primaryActors.length > 0 && (
                            <p className="text-xs text-slate-500 mt-1">
                              Actors: {event.primaryActors.join(', ')}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-xs text-slate-400">📍 {event.location}</p>
                          )}
                          {event.excerpt && (
                            <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-amber-300 pl-2">
                              "{event.excerpt.slice(0, 150)}..."
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 ml-3">
                          <span className="text-xs text-center text-slate-400">
                            ★ {event.significance}/5
                          </span>
                          <button
                            onClick={() => saveEvent(event)}
                            className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setExtractedEvents(prev => prev.filter((_, idx) => idx !== i))}
                            className="px-3 py-1 text-slate-500 text-sm hover:text-red-600"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Form (auto-populated) */}
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Article title"
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Source Name</label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g., Heritage Foundation"
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full p-2 border rounded"
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Source Type</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as 'impartial' | 'partisan')}
                    className="w-full p-2 border rounded"
                  >
                    <option value="impartial">Impartial</option>
                    <option value="partisan">Partisan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Credibility (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={credibility}
                    onChange={(e) => setCredibility(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Political Lean</label>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={politicalLean}
                    onChange={(e) => setPoliticalLean(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Left</span>
                    <span>{(politicalLean * 100).toFixed(0)}%</span>
                    <span>Right</span>
                  </div>
                </div>
              </div>

              {/* Date Fields */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Published Date</label>
                  <input
                    type="date"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                  <p className="text-xs text-slate-400 mt-1">When the article was published</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                  <p className="text-xs text-slate-400 mt-1">When the event occurred (if different)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date Accuracy</label>
                  <select
                    value={dateAccuracy}
                    onChange={(e) => setDateAccuracy(e.target.value as 'day' | 'month' | 'year' | 'approximate')}
                    className="w-full p-2 border rounded"
                  >
                    <option value="day">Exact day</option>
                    <option value="month">Month only</option>
                    <option value="year">Year only</option>
                    <option value="approximate">Approximate</option>
                  </select>
                </div>
              </div>

              {/* Tag Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag.id)}
                        onChange={(e) => setSelectedTags(
                          e.target.checked 
                            ? [...selectedTags, tag.id] 
                            : selectedTags.filter(id => id !== tag.id)
                        )}
                      />
                      <span
                        className="px-2 py-0.5 rounded text-white text-sm"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {editMode ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveEvidence}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : '💾 Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-slate-200 rounded hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !url}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save to Database'}
                </button>
              )}
            </form>

            {/* File Upload */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-2">Or Upload File</h3>
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.md,.pdf,.docx,.html"
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        )}

        {/* Document Viewer */}
        {evidence && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{evidence.title}</h2>
                    <span className={`text-xs px-2 py-1 rounded ${
                      evidence.sourceType === 'partisan' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {evidence.sourceType}
                    </span>
                  </div>
                  <button
                    onClick={() => setEvidence(null)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    × Close
                  </button>
                </div>

                {/* Highlighted Content */}
                <div
                  className="prose max-w-none text-sm leading-relaxed"
                  onMouseUp={handleTextSelect}
                  dangerouslySetInnerHTML={{
                    __html: highlightContent(evidence.rawContent || evidence.content || ''),
                  }}
                />
              </div>

              {/* Selected Text */}
              {selectedText && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium mb-2">Selected Text</h3>
                  <p className="text-sm mb-3">"{selectedText}"</p>
                  <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                    Add as Excerpt
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* AI Analysis */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">AI Analysis</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => analyzeDocument('suggest_tags')}
                    disabled={analyzing}
                    className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {analyzing ? 'Analyzing...' : 'Suggest Tags'}
                  </button>
                  <button
                    onClick={() => analyzeDocument('generate_questions')}
                    disabled={analyzing}
                    className="w-full px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Generate Questions
                  </button>
                  <button
                    onClick={() => analyzeDocument('extract_claims')}
                    disabled={analyzing}
                    className="w-full px-3 py-2 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:opacity-50"
                  >
                    Extract Claims
                  </button>
                  <button
                    onClick={() => analyzeDocument('detect_politicians')}
                    disabled={analyzing}
                    className="w-full px-3 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50"
                  >
                    Detect Politicians
                  </button>
                  <button
                    onClick={() => analyzeDocument('check_backlog')}
                    disabled={analyzing}
                    className="w-full px-3 py-2 bg-rose-600 text-white text-sm rounded hover:bg-rose-700 disabled:opacity-50"
                  >
                    Check Against Backlog
                  </button>
                </div>
              </div>

              {/* Suggested Tags */}
              {suggestions.tags.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-3">Suggested Tags (click to add)</h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.tags.map((tagName, i) => {
                      const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (existingTag && !selectedTags.includes(existingTag.id)) {
                              setSelectedTags([...selectedTags, existingTag.id]);
                            }
                          }}
                          className={`px-2 py-1 text-sm rounded ${
                            existingTag
                              ? selectedTags.includes(existingTag.id)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          disabled={!existingTag}
                          title={existingTag ? 'Click to add' : 'Create this tag first'}
                        >
                          {existingTag && selectedTags.includes(existingTag.id) ? '✓' : '+'} {tagName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggested Questions */}
              {suggestions.questions.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold mb-3">Suggested Questions</h3>
                  <div className="space-y-3">
                    {suggestions.questions.map((q: any, i: number) => (
                      <div key={i} className="text-sm border-b pb-2 last:border-0">
                        <p className="font-medium">{q.text}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {q.leftLabel} ↔ {q.rightLabel}
                        </p>
                        <button 
                          onClick={async () => {
                            const res = await fetch('/api/questions', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                text: q.text,
                                leftLabel: q.leftLabel,
                                rightLabel: q.rightLabel,
                                categoryId: evidence?.categoryId,
                              }),
                            });
                            if (res.ok) {
                              setSuggestions(prev => ({
                                ...prev,
                                questions: prev.questions.filter((_, idx) => idx !== i)
                              }));
                            }
                          }}
                          className="text-blue-600 text-xs hover:underline mt-1"
                        >
                          Add Question
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag Legend */}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold mb-3">Tag Legend</h3>
                <div className="space-y-1">
                  {tags.slice(0, 10).map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                      {tag.synonyms?.length > 0 && (
                        <span className="text-xs text-slate-400">
                          (+{tag.synonyms.length} synonyms)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
