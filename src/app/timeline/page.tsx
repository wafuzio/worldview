'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Tag = { id: string; name: string; color: string };
type Evidence = {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string | null;
  sourceName: string | null;
  sourceType: string;
  eventDate: string | null;
  publishedAt: string | null;
  createdAt: string;
  politicalLean: number;
  tags: { tag: Tag }[];
};

type TimelineEntry = {
  date: string;
  items: Evidence[];
};

export default function TimelinePage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter state
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [anyTags, setAnyTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(setTags);
  }, []);

  const fetchTimeline = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    
    if (includeTags.length) params.set('includeTags', includeTags.join(','));
    if (excludeTags.length) params.set('excludeTags', excludeTags.join(','));
    if (anyTags.length) params.set('anyTags', anyTags.join(','));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('sortOrder', sortOrder);

    const res = await fetch(`/api/timeline?${params}`);
    const data = await res.json();
    setTimeline(data.timeline || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTimeline();
  }, [includeTags, excludeTags, anyTags, startDate, endDate, sortOrder]);

  const toggleTag = (tagId: string, list: 'include' | 'exclude' | 'any') => {
    const setters = {
      include: setIncludeTags,
      exclude: setExcludeTags,
      any: setAnyTags,
    };
    const current = { include: includeTags, exclude: excludeTags, any: anyTags }[list];
    
    // Remove from other lists first
    if (list !== 'include') setIncludeTags(prev => prev.filter(id => id !== tagId));
    if (list !== 'exclude') setExcludeTags(prev => prev.filter(id => id !== tagId));
    if (list !== 'any') setAnyTags(prev => prev.filter(id => id !== tagId));
    
    // Toggle in current list
    if (current.includes(tagId)) {
      setters[list](prev => prev.filter(id => id !== tagId));
    } else {
      setters[list](prev => [...prev, tagId]);
    }
  };

  const getTagState = (tagId: string): 'include' | 'exclude' | 'any' | null => {
    if (includeTags.includes(tagId)) return 'include';
    if (excludeTags.includes(tagId)) return 'exclude';
    if (anyTags.includes(tagId)) return 'any';
    return null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const clearFilters = () => {
    setIncludeTags([]);
    setExcludeTags([]);
    setAnyTags([]);
    setStartDate('');
    setEndDate('');
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📅 Evidence Timeline</h1>
          <div className="flex gap-4">
            <Link href="/admin/documents" className="text-blue-600 hover:underline">Add Evidence</Link>
            <Link href="/" className="text-blue-600 hover:underline">← Back to Quiz</Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Filter Timeline</h2>
            <button
              onClick={clearFilters}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Clear all filters
            </button>
          </div>

          {/* Tag Filters */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">
              Tags: <span className="font-normal text-slate-500">Click to cycle: off → must include (green) → must exclude (red) → any of (blue)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const state = getTagState(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (!state) toggleTag(tag.id, 'include');
                      else if (state === 'include') toggleTag(tag.id, 'exclude');
                      else if (state === 'exclude') toggleTag(tag.id, 'any');
                      else toggleTag(tag.id, 'include'); // Reset cycle
                    }}
                    className={`px-3 py-1 rounded text-sm transition-all ${
                      state === 'include' 
                        ? 'ring-2 ring-green-500 ring-offset-2' 
                        : state === 'exclude'
                        ? 'ring-2 ring-red-500 ring-offset-2 opacity-50 line-through'
                        : state === 'any'
                        ? 'ring-2 ring-blue-500 ring-offset-2'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ 
                      backgroundColor: tag.color, 
                      color: 'white',
                    }}
                  >
                    {state === 'include' && '✓ '}
                    {state === 'exclude' && '✗ '}
                    {state === 'any' && '◐ '}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Legend */}
          {(includeTags.length > 0 || excludeTags.length > 0 || anyTags.length > 0) && (
            <div className="text-sm text-slate-600 mb-4 p-3 bg-slate-50 rounded">
              <strong>Active filters:</strong>
              {includeTags.length > 0 && (
                <span className="ml-2">
                  <span className="text-green-600">Must have ALL:</span>{' '}
                  {includeTags.map(id => tags.find(t => t.id === id)?.name).join(', ')}
                </span>
              )}
              {excludeTags.length > 0 && (
                <span className="ml-2">
                  <span className="text-red-600">Must NOT have:</span>{' '}
                  {excludeTags.map(id => tags.find(t => t.id === id)?.name).join(', ')}
                </span>
              )}
              {anyTags.length > 0 && (
                <span className="ml-2">
                  <span className="text-blue-600">Has any of:</span>{' '}
                  {anyTags.map(id => tags.find(t => t.id === id)?.name).join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full p-2 border rounded"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading timeline...</div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No evidence found matching your filters.
            <br />
            <Link href="/admin/documents" className="text-blue-600 hover:underline">Add some evidence</Link>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-300" />

            {timeline.map((entry, idx) => (
              <div key={entry.date} className="relative pl-12 pb-8">
                {/* Date marker */}
                <div className="absolute left-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {idx + 1}
                </div>
                
                {/* Date header */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-slate-800">
                    {formatDate(entry.date)}
                  </h3>
                  <p className="text-sm text-slate-500">{entry.items.length} item{entry.items.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Items for this date */}
                <div className="space-y-3">
                  {entry.items.map(item => (
                    <div 
                      key={item.id} 
                      className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                        item.politicalLean > 0.3 ? 'border-red-400' :
                        item.politicalLean < -0.3 ? 'border-blue-400' :
                        'border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-slate-600 mt-1">{item.summary}</p>
                          {item.sourceName && (
                            <p className="text-xs text-slate-400 mt-2">
                              Source: {item.sourceName}
                              {item.sourceUrl && (
                                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-500 hover:underline">
                                  View →
                                </a>
                              )}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.sourceType === 'partisan' 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.sourceType}
                        </span>
                      </div>
                      
                      {/* Tags */}
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.tags.map(({ tag }) => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded text-white text-xs"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
