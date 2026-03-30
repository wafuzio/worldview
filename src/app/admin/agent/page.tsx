'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

type QueueItem = {
  id: string;
  topic: string;
  rationale: string | null;
  priority: string;
  depth: string;
  source: string;
  status: string;
  error: string | null;
  attempts: number;
  evidenceCreated: number | null;
  entitiesCreated: number | null;
  relationshipsCreated: number | null;
  createdAt: string;
  processedAt: string | null;
};

type AgentRunSummary = {
  id: string;
  runType: string;
  status: string;
  topicsProcessed: number;
  topicsSucceeded: number;
  topicsFailed: number;
  topicsDiscovered: number;
  evidenceCreated: number;
  entitiesCreated: number;
  maxTopics: number;
  depth: string;
  startedAt: string;
  completedAt: string | null;
};

type AgentStatus = {
  queue: { pending: number; processing: number; completed: number; failed: number; total: number };
  database: { evidence: number; entities: number; politicians: number; relationships: number; events: number };
  recentRuns: AgentRunSummary[];
  llmProvider: string;
};

type NewNodeSummary = {
  id: string;
  name: string;
  type: string;
  tags: string[];
  totalConnections: number;
  connectionsToExistingNodes: {
    relationshipId: string;
    relationshipType: string;
    tier: string;
    significance: number;
    direction: 'outbound' | 'inbound';
    otherNodeId: string;
    otherNodeName: string;
  }[];
};

export default function AgentDashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState('pending');
  const [isRunning, setIsRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDepth, setNewDepth] = useState('standard');
  const [runConfig, setRunConfig] = useState({ maxTopics: 5, depth: 'standard', autoQueue: true });
  const [discoveryMode, setDiscoveryMode] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'runs'>('overview');
  const [nowTick, setNowTick] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/queue?status=${queueFilter}&limit=100`);
      const data = await res.json();
      setQueueItems(data.items || []);
    } catch (e) {
      console.error('Failed to fetch queue:', e);
    }
  }, [queueFilter]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Auto-refresh while running
  useEffect(() => {
    if (!isRunning && !isDiscovering) return;
    const interval = setInterval(() => { fetchStatus(); fetchQueue(); }, 5000);
    return () => clearInterval(interval);
  }, [isRunning, isDiscovering, fetchStatus, fetchQueue]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleAddTopic = async () => {
    if (!newTopic.trim()) return;
    try {
      const res = await fetch('/api/agent/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic.trim(), priority: newPriority, depth: newDepth }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTopic('');
        fetchQueue();
        fetchStatus();
      } else {
        alert(data.error || 'Failed to add topic');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Auto-scroll the live feed when new events arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [liveEvents]);

  const handleRunAgent = async () => {
    setIsRunning(true);
    setRunResult(null);
    setLiveEvents([]);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runConfig),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        setRunResult(data);
        setIsRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setRunResult({ error: 'No stream available' });
        setIsRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              const stamped = { ...event, _time: new Date().toLocaleTimeString(), _ts: Date.now() };
              setLiveEvents(prev => {
                // Heartbeat: replace the last topic_phase for the same topic instead of stacking
                if (event.type === 'topic_phase' && prev.length > 0) {
                  const last = prev[prev.length - 1];
                  if (last.type === 'topic_phase' && last.topic === event.topic) {
                    return [...prev.slice(0, -1), stamped];
                  }
                }
                return [...prev, stamped];
              });

              if (event.type === 'complete' || event.type === 'error') {
                setRunResult(event);
                fetchStatus();
                fetchQueue();
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setRunResult({ error: e.message });
    } finally {
      setIsRunning(false);
      fetchStatus();
      fetchQueue();
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agent/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: discoveryMode, maxTopics: 5 }),
      });
      const data = await res.json();
      setRunResult(data);
      fetchStatus();
      fetchQueue();
    } catch (e: any) {
      setRunResult({ error: e.message });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleQueueAction = async (id: string, action: string, extra?: any) => {
    try {
      await fetch('/api/agent/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      fetchQueue();
      fetchStatus();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'bg-fuchsia-100 text-fuchsia-700';
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'low': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'processing': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'skipped': return 'bg-slate-100 text-slate-500';
      case 'running': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case 'suggested': return 'LLM Suggested';
      case 'discovered': return 'Web Discovery';
      case 'manual': return 'Manual';
      case 'gap_fill': return 'Gap Analysis';
      default: return s;
    }
  };

  const latestNewNodes: NewNodeSummary[] = Array.isArray(runResult?.stats?.newNodes)
    ? runResult.stats.newNodes
    : [];
  const lastEventTs = liveEvents.length > 0 ? (liveEvents[liveEvents.length - 1]?._ts ?? null) : null;
  const secondsSinceLastEvent = lastEventTs ? Math.max(0, Math.round((nowTick - lastEventTs) / 1000)) : null;
  const isEventStale = isRunning && (secondsSinceLastEvent ?? 0) >= 20;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Research Agent</h1>
            <p className="text-slate-500 mt-1">Automated topic discovery, research, and ingestion</p>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/admin/ingest" className="text-blue-600 hover:underline text-sm">Ingest</Link>
            <Link href="/admin" className="text-blue-600 hover:underline text-sm">Admin</Link>
            <Link href="/" className="text-blue-600 hover:underline text-sm">Quiz</Link>
          </div>
        </div>

        {/* Status Cards */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Pending Topics" value={status.queue.pending} sub={`${status.queue.total} total queued`} accent="blue" />
            <StatCard label="Evidence" value={status.database.evidence} sub={`${status.database.entities} entities`} accent="green" />
            <StatCard label="Relationships" value={status.database.relationships} sub={`${status.database.politicians} actors`} accent="purple" />
            <StatCard label="LLM Provider" value={status.llmProvider} sub={status.llmProvider === 'alchemy' ? 'AlchemyAI Relay' : status.llmProvider} accent="slate" isText />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
          {([
            { key: 'overview' as const, label: 'Overview & Controls' },
            { key: 'queue' as const, label: `Queue${status ? ` (${status.queue.pending})` : ''}` },
            { key: 'runs' as const, label: 'Run History' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Add Topic */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Topic to Queue</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTopic(); }}
                  className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., The revolving door between Goldman Sachs and the Treasury Department"
                />
                <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="p-3 border border-slate-300 rounded-lg">
                  <option value="urgent">Do Next</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select value={newDepth} onChange={e => setNewDepth(e.target.value)} className="p-3 border border-slate-300 rounded-lg">
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                </select>
                <button
                  onClick={handleAddTopic}
                  disabled={!newTopic.trim()}
                  className="px-5 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 font-medium whitespace-nowrap"
                >
                  Add to Queue
                </button>
              </div>
            </div>

            {/* Agent Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Run Agent */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-3">Run Research Agent</h2>
                <p className="text-sm text-slate-500 mb-4">Processes pending topics from the queue. Researches via LLM, ingests into DB, and queues suggested follow-ups.</p>
                <div className="flex gap-3 mb-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Max Topics</label>
                    <select
                      value={runConfig.maxTopics}
                      onChange={e => setRunConfig({ ...runConfig, maxTopics: parseInt(e.target.value) })}
                      className="p-2 border border-slate-300 rounded text-sm"
                    >
                      {[1, 2, 3, 5, 10, 15, 20].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Depth</label>
                    <select
                      value={runConfig.depth}
                      onChange={e => setRunConfig({ ...runConfig, depth: e.target.value })}
                      className="p-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="standard">Standard</option>
                      <option value="deep">Deep (2-pass)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Auto-queue</label>
                    <select
                      value={runConfig.autoQueue ? 'yes' : 'no'}
                      onChange={e => setRunConfig({ ...runConfig, autoQueue: e.target.value === 'yes' })}
                      className="p-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleRunAgent}
                  disabled={isRunning || (status?.queue.pending ?? 0) === 0}
                  className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-colors ${
                    isRunning ? 'bg-yellow-500 animate-pulse' :
                    (status?.queue.pending ?? 0) === 0 ? 'bg-slate-300 cursor-not-allowed' :
                    'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isRunning ? 'Agent Running...' :
                   (status?.queue.pending ?? 0) === 0 ? 'No Pending Topics' :
                   `Run Agent (${status?.queue.pending} pending)`}
                </button>
              </div>

              {/* Discover Topics */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-3">Discover New Topics</h2>
                <p className="text-sm text-slate-500 mb-4">Uses LLM to find new research-worthy political topics based on current events, DB gaps, and existing entities.</p>
                <div className="mb-4">
                  <label className="text-xs text-slate-500 block mb-1">Discovery Mode</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'all', label: 'All Modes', desc: 'Current events + gaps + deep dives' },
                      { value: 'current_events', label: 'Current Events', desc: 'Trending political topics' },
                      { value: 'gap_analysis', label: 'Gap Analysis', desc: 'Fill coverage holes' },
                      { value: 'deep_dive', label: 'Deep Dive', desc: 'Expand existing entities' },
                    ].map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setDiscoveryMode(mode.value)}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                          discoveryMode === mode.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title={mode.desc}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleDiscover}
                  disabled={isDiscovering}
                  className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-colors ${
                    isDiscovering ? 'bg-yellow-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isDiscovering ? 'Discovering...' : 'Discover Topics'}
                </button>
              </div>
            </div>

            {/* Live Feed — visible when running or has events */}
            {(isRunning || liveEvents.length > 0) && (
              <div className="bg-slate-900 rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
                  <div className="flex items-center gap-2">
                    {isRunning && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                    <h3 className="text-sm font-semibold text-slate-200">
                      {isRunning ? 'Agent Running' : 'Run Complete'}
                    </h3>
                    {liveEvents.length > 0 && (
                      <span className="text-xs text-slate-400">({liveEvents.length} events)</span>
                    )}
                    {isRunning && secondsSinceLastEvent !== null && (
                      <span className={`text-xs ${isEventStale ? 'text-amber-300' : 'text-slate-400'}`}>
                        last update {secondsSinceLastEvent}s ago
                      </span>
                    )}
                  </div>
                  {!isRunning && liveEvents.length > 0 && (
                    <button onClick={() => setLiveEvents([])} className="text-xs text-slate-400 hover:text-slate-200">Clear</button>
                  )}
                </div>
                <div ref={feedRef} className="p-4 max-h-80 overflow-y-auto space-y-1.5 font-mono text-xs">
                  {liveEvents.map((ev, i) => (
                    <LiveEventRow key={i} event={ev} />
                  ))}
                  {isRunning && (
                    <div className="flex items-center gap-2 text-slate-500 pt-1">
                      <span className="inline-block w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                      {isEventStale ? 'No new events yet (still running)...' : 'Waiting for next event...'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Run Result — discovery results or errors (non-SSE) */}
            {runResult && !isRunning && runResult.topics && runResult.topics.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Discovered Topics</h3>
                <div className="space-y-1">
                  {runResult.topics.map((t: any, i: number) => (
                    <div key={i} className="text-xs p-2 bg-white rounded border">
                      <span className={`inline-block px-1.5 py-0.5 rounded mr-2 ${priorityColor(t.priority)}`}>{t.priority}</span>
                      <strong>{t.topic}</strong>
                      <span className="text-slate-400 ml-2">({t.source})</span>
                      {t.rationale && <p className="text-slate-500 mt-0.5 ml-12">{t.rationale}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {runResult && !isRunning && runResult.error && liveEvents.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Error</h3>
                <p className="text-sm text-red-700">{runResult.error}</p>
              </div>
            )}

            {/* New Nodes Summary (from completed research-agent run) */}
            {runResult?.type === 'complete' && !isRunning && (
              <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-3">
                  New Nodes Created ({latestNewNodes.length})
                </h3>
                {latestNewNodes.length === 0 ? (
                  <p className="text-sm text-slate-500">No new nodes were created in this run.</p>
                ) : (
                  <div className="space-y-3">
                    {latestNewNodes.map((node) => (
                      <div key={node.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-slate-800">{node.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 capitalize">
                            {node.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-slate-500">
                            {node.totalConnections} total connection{node.totalConnections === 1 ? '' : 's'}
                          </span>
                        </div>

                        {node.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {node.tags.map((tag) => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-slate-500 mb-1">
                          Connections to existing nodes ({node.connectionsToExistingNodes.length})
                        </div>
                        {node.connectionsToExistingNodes.length === 0 ? (
                          <div className="text-xs text-slate-400">No direct links to pre-existing nodes yet.</div>
                        ) : (
                          <div className="space-y-1">
                            {node.connectionsToExistingNodes.map((c) => (
                              <div key={c.relationshipId} className="text-xs text-slate-700">
                                <span className="text-slate-500">{c.direction === 'outbound' ? 'to' : 'from'}</span>{' '}
                                <span className="font-medium">{c.otherNodeName}</span>{' '}
                                <span className="text-slate-400">({c.relationshipType.replace(/_/g, ' ')}, {c.tier}, sig {c.significance})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Queue Tab ── */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2">
              {['pending', 'completed', 'failed', 'skipped', 'all'].map(f => (
                <button
                  key={f}
                  onClick={() => setQueueFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize ${
                    queueFilter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f}
                </button>
              ))}
              <button
                onClick={() => { fetchQueue(); fetchStatus(); }}
                className="ml-auto px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Refresh
              </button>
            </div>

            {/* Queue Items */}
            {queueItems.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center text-slate-400">
                No {queueFilter === 'all' ? '' : queueFilter} topics in queue.
                {queueFilter === 'pending' && ' Add topics above or run Discovery.'}
              </div>
            ) : (
              <div className="space-y-2">
                {queueFilter === 'pending' && (
                  <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 text-xs text-fuchsia-700">
                    <span className="font-semibold">Do Next lane:</span> mark specific items as <code>Do Next</code> to force them ahead of the regular high-priority backlog.
                  </div>
                )}
                {queueItems.map(item => (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm p-4 group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${priorityColor(item.priority)}`}>{item.priority}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(item.status)}`}>{item.status}</span>
                          <span className="text-xs text-slate-400">{sourceLabel(item.source)}</span>
                        </div>
                        <p className="font-medium text-slate-800 text-sm">{item.topic}</p>
                        {item.rationale && (
                          <p className="text-xs text-slate-500 mt-0.5">{item.rationale}</p>
                        )}
                        {item.error && (
                          <p className="text-xs text-red-600 mt-0.5">Error: {item.error}</p>
                        )}
                        {item.status === 'completed' && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Created: {item.evidenceCreated ?? 0} evidence, {item.entitiesCreated ?? 0} entities, {item.relationshipsCreated ?? 0} relationships
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.status === 'pending' && (
                          <>
                            {item.priority !== 'urgent' ? (
                              <button onClick={() => handleQueueAction(item.id, 'pin_next')} className="px-2 py-1 text-xs text-fuchsia-700 hover:bg-fuchsia-50 rounded">Do Next</button>
                            ) : (
                              <button onClick={() => handleQueueAction(item.id, 'unpin_next', { priority: 'high' })} className="px-2 py-1 text-xs text-fuchsia-700 hover:bg-fuchsia-50 rounded">Clear Next</button>
                            )}
                            <button onClick={() => handleQueueAction(item.id, 'prioritize', { priority: 'high' })} className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded">Boost</button>
                            <button onClick={() => handleQueueAction(item.id, 'skip')} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 rounded">Skip</button>
                          </>
                        )}
                        {(item.status === 'failed' || item.status === 'skipped') && (
                          <button onClick={() => handleQueueAction(item.id, 'requeue')} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Re-queue</button>
                        )}
                        <button onClick={() => handleQueueAction(item.id, 'delete')} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Runs Tab ── */}
        {activeTab === 'runs' && (
          <div className="space-y-3">
            {status?.recentRuns.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center text-slate-400">
                No agent runs yet. Use the controls above to start.
              </div>
            ) : (
              status?.recentRuns.map(run => (
                <div key={run.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(run.status)}`}>{run.status}</span>
                      <span className="text-xs text-slate-400 capitalize">{run.runType}</span>
                      <span className="text-xs text-slate-400">{new Date(run.startedAt).toLocaleString()}</span>
                    </div>
                    {run.completedAt && (
                      <span className="text-xs text-slate-400">
                        {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-slate-600">Processed: <strong>{run.topicsProcessed}</strong></span>
                    {run.topicsSucceeded > 0 && <span className="text-green-600">Succeeded: <strong>{run.topicsSucceeded}</strong></span>}
                    {run.topicsFailed > 0 && <span className="text-red-600">Failed: <strong>{run.topicsFailed}</strong></span>}
                    {run.topicsDiscovered > 0 && <span className="text-indigo-600">Discovered: <strong>{run.topicsDiscovered}</strong></span>}
                    {run.evidenceCreated > 0 && <span className="text-blue-600">Evidence: <strong>+{run.evidenceCreated}</strong></span>}
                    {run.entitiesCreated > 0 && <span className="text-purple-600">Entities: <strong>+{run.entitiesCreated}</strong></span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function LiveEventRow({ event }: { event: any }) {
  const ev = event;
  const time = ev._time || '';

  switch (ev.type) {
    case 'start':
      return (
        <div className="flex items-center gap-2 text-blue-400">
          <span className="text-slate-500 w-16 shrink-0">{time}</span>
          <span className="text-blue-400 font-semibold">STARTED</span>
          <span className="text-slate-400">{ev.detail}</span>
        </div>
      );

    case 'topic_start':
      return (
        <div className="flex items-start gap-2 text-white pt-1">
          <span className="text-slate-500 w-16 shrink-0">{time}</span>
          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
            {ev.index}/{ev.total}
          </span>
          <span className="text-white font-medium">{ev.topic}</span>
        </div>
      );

    case 'topic_phase':
      return (
        <div className="flex items-center gap-2 text-slate-400 pl-[4.5rem]">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
          <span>{ev.phase}</span>
        </div>
      );

    case 'topic_done':
      return (
        <div className="flex items-center gap-2 text-green-400 pl-[4.5rem]">
          <span>&#10003;</span>
          <span>{ev.detail}</span>
        </div>
      );

    case 'topic_error':
      return (
        <div className="flex items-start gap-2 text-red-400 pl-[4.5rem]">
          <span className="shrink-0">&#10007;</span>
          <span className="break-all">{ev.detail}</span>
        </div>
      );

    case 'queued':
      return (
        <div className="flex items-center gap-2 text-indigo-400 pl-[4.5rem]">
          <span>+</span>
          <span>{ev.detail}</span>
        </div>
      );

    case 'complete':
      return (
        <div className="flex items-center gap-2 text-green-300 font-semibold pt-2 border-t border-slate-700 mt-2">
          <span className="text-slate-500 w-16 shrink-0">{time}</span>
          <span>DONE</span>
          {ev.stats && (
            <span className="text-slate-400 font-normal">
              {ev.stats.succeeded ?? ev.stats.topicsSucceeded ?? '?'} succeeded,
              {' '}{ev.stats.evidence ?? ev.stats.evidenceCreated ?? 0} evidence,
              {' '}{ev.stats.entities ?? ev.stats.entitiesCreated ?? 0} entities,
              {' '}{ev.stats.queued ?? ev.stats.topicsQueued ?? 0} queued
            </span>
          )}
        </div>
      );

    case 'error':
      return (
        <div className="flex items-center gap-2 text-red-400 font-semibold pt-2 border-t border-slate-700 mt-2">
          <span className="text-slate-500 w-16 shrink-0">{time}</span>
          <span>ERROR</span>
          <span className="font-normal">{ev.detail}</span>
        </div>
      );

    default:
      return (
        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-16 shrink-0">{time}</span>
          <span>{ev.type}: {ev.detail || ev.phase || ''}</span>
        </div>
      );
  }
}

function StatCard({ label, value, sub, accent, isText }: {
  label: string;
  value: number | string;
  sub: string;
  accent: string;
  isText?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    purple: 'border-purple-200 bg-purple-50',
    slate: 'border-slate-200 bg-slate-50',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[accent] || colors.slate}`}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold text-slate-800 mt-1`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}
