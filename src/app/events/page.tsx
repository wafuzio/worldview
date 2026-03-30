'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Tag = { id: string; name: string; color: string };
type EventSource = {
  id: string;
  relationship: string;
  excerpt: string | null;
  evidence: {
    id: string;
    title: string;
    sourceName: string | null;
    sourceUrl: string | null;
  };
};
type Event = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  endDate: string | null;
  dateAccuracy: string;
  location: string | null;
  eventType: string;
  significance: number;
  primaryActors: string | null;
  tags: { tag: Tag }[];
  sources: EventSource[];
};

const EVENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'speech', label: '🎤 Speech' },
  { value: 'vote', label: '🗳️ Vote' },
  { value: 'policy', label: '📋 Policy' },
  { value: 'scandal', label: '⚠️ Scandal' },
  { value: 'election', label: '🏛️ Election' },
  { value: 'protest', label: '✊ Protest' },
  { value: 'legislation', label: '📜 Legislation' },
  { value: 'court', label: '⚖️ Court' },
  { value: 'general', label: '📌 General' },
];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [eventType, setEventType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(setTags);
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    
    if (selectedTags.length) params.set('tags', selectedTags.join(','));
    if (eventType) params.set('type', eventType);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('sortOrder', sortOrder);

    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedTags, eventType, startDate, endDate, sortOrder]);

  const formatDate = (dateStr: string, accuracy: string) => {
    const date = new Date(dateStr);
    if (accuracy === 'year') {
      return date.getFullYear().toString();
    } else if (accuracy === 'month') {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } else if (accuracy === 'approximate') {
      return `~${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}`;
    }
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getTypeIcon = (type: string) => {
    const found = EVENT_TYPES.find(t => t.value === type);
    return found?.label.split(' ')[0] || '📌';
  };

  const parseActors = (actors: string | null): string[] => {
    if (!actors) return [];
    try {
      return JSON.parse(actors);
    } catch {
      return [];
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📅 Events Timeline</h1>
          <div className="flex gap-4">
            <Link href="/timeline" className="text-blue-600 hover:underline">Evidence Timeline</Link>
            <Link href="/admin/documents" className="text-blue-600 hover:underline">Add Evidence</Link>
            <Link href="/" className="text-blue-600 hover:underline">← Back to Quiz</Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filter Events</h2>
          
          {/* Event Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Event Type</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setEventType(type.value)}
                  className={`px-3 py-1 rounded text-sm ${
                    eventType === type.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Filter by Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTags(prev => 
                    prev.includes(tag.id) 
                      ? prev.filter(id => id !== tag.id)
                      : [...prev, tag.id]
                  )}
                  className={`px-3 py-1 rounded text-sm text-white transition-all ${
                    selectedTags.includes(tag.id) ? 'ring-2 ring-offset-2 ring-blue-500' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: tag.color }}
                >
                  {selectedTags.includes(tag.id) && '✓ '}{tag.name}
                </button>
              ))}
            </div>
          </div>

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

        {/* Events List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No events found.
            <br />
            <Link href="/admin/documents" className="text-blue-600 hover:underline">
              Extract events from evidence
            </Link>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-300" />

            {events.map((event, idx) => (
              <div key={event.id} className="relative pl-16 pb-8">
                {/* Date marker */}
                <div className="absolute left-0 w-12 h-12 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center text-2xl">
                  {getTypeIcon(event.eventType)}
                </div>
                
                <div className="bg-white rounded-lg shadow p-4">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-blue-600">
                          {formatDate(event.eventDate, event.dateAccuracy)}
                        </span>
                        {event.endDate && (
                          <span className="text-sm text-slate-500">
                            → {formatDate(event.endDate, event.dateAccuracy)}
                          </span>
                        )}
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
                      </div>
                      <h3 className="text-lg font-semibold">{event.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      {'★'.repeat(event.significance)}
                      {'☆'.repeat(5 - event.significance)}
                    </div>
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-slate-600 mb-3">{event.description}</p>
                  )}

                  {/* Actors & Location */}
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-3">
                    {parseActors(event.primaryActors).length > 0 && (
                      <div>
                        <span className="font-medium">Actors:</span>{' '}
                        {parseActors(event.primaryActors).join(', ')}
                      </div>
                    )}
                    {event.location && (
                      <div>📍 {event.location}</div>
                    )}
                  </div>

                  {/* Tags */}
                  {event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {event.tags.map(({ tag }) => (
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

                  {/* Sources */}
                  {event.sources.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs font-medium text-slate-500 mb-2">
                        Sources ({event.sources.length}):
                      </p>
                      <div className="space-y-2">
                        {event.sources.map(source => (
                          <div key={source.id} className="text-sm bg-slate-50 rounded p-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                source.relationship === 'primary_source' ? 'bg-green-100 text-green-700' :
                                source.relationship === 'contradicts' ? 'bg-red-100 text-red-700' :
                                source.relationship === 'analysis' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {source.relationship}
                              </span>
                              <span className="font-medium">{source.evidence.title}</span>
                              {source.evidence.sourceName && (
                                <span className="text-slate-400">({source.evidence.sourceName})</span>
                              )}
                              {source.evidence.sourceUrl && (
                                <a 
                                  href={source.evidence.sourceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                >
                                  View →
                                </a>
                              )}
                            </div>
                            {source.excerpt && (
                              <p className="text-xs text-slate-500 mt-1 italic">
                                "{source.excerpt}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
