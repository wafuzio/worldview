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

type MissingNodeSuggestion = {
  name: string;
  type: string;
  rationale: string;
  importance: number;
  suggestedConnections: {
    existingNodeName: string;
    relationshipHypothesis: string;
  }[];
};

export default function AgentDashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState('pending');
  const [isRunning, setIsRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isDiscoveringNodes, setIsDiscoveringNodes] = useState(false);
  const [isAddingDiscoveredNodes, setIsAddingDiscoveredNodes] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [isDedupScanning, setIsDedupScanning] = useState(false);
  const [isDedupMerging, setIsDedupMerging] = useState(false);
  const [dedupResult, setDedupResult] = useState<any>(null);
  const [selectedDedupPairs, setSelectedDedupPairs] = useState<Set<string>>(new Set());
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDepth, setNewDepth] = useState('standard');
  const [runConfig, setRunConfig] = useState({ maxTopics: 5, depth: 'standard', autoQueue: true });
  const [connectionConfig, setConnectionConfig] = useState({
    maxNewLinks: 25,
    queueVerificationTopics: true,
    dryRun: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [discoveryMode, setDiscoveryMode] = useState<string>('all');
  const [nodeDiscoveryMax, setNodeDiscoveryMax] = useState(10);
  const [nodeSuggestions, setNodeSuggestions] = useState<MissingNodeSuggestion[]>([]);
  const [selectedNodeSuggestionNames, setSelectedNodeSuggestionNames] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ nodes: any[]; connections: any[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'runs' | 'activity' | 'quality'>('overview');
  const [cycleStatus, setCycleStatus] = useState<any>(null);
  const [isCycleRunning, setIsCycleRunning] = useState(false);
  const [cycleResult, setCycleResult] = useState<any>(null);
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

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/activity?limit=25');
      const data = await res.json();
      setRecentActivity(data);
    } catch (e) {
      console.error('Failed to fetch activity:', e);
    }
  }, []);

  const fetchCycleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/cycle');
      const data = await res.json();
      setCycleStatus(data);
    } catch (e) {
      console.error('Failed to fetch cycle status:', e);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  useEffect(() => { if (activeTab === 'activity') fetchActivity(); }, [activeTab, fetchActivity]);
  useEffect(() => { if (activeTab === 'quality') fetchCycleStatus(); }, [activeTab, fetchCycleStatus]);

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

  const handleDiscoverNodes = async () => {
    setIsDiscoveringNodes(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agent/discover-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', maxNodes: nodeDiscoveryMax }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to discover nodes');
      const suggestions: MissingNodeSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      setNodeSuggestions(suggestions);
      setSelectedNodeSuggestionNames(suggestions.map((s) => s.name));
    } catch (e: any) {
      setRunResult({ error: e.message });
    } finally {
      setIsDiscoveringNodes(false);
      fetchStatus();
    }
  };

  const toggleNodeSuggestion = (name: string) => {
    setSelectedNodeSuggestionNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleAddSelectedDiscoveredNodes = async () => {
    const selected = nodeSuggestions.filter((s) => selectedNodeSuggestionNames.includes(s.name));
    if (selected.length === 0) return;
    setIsAddingDiscoveredNodes(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agent/discover-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add selected nodes');
      setRunResult({ discoveredNodesAdd: data });
      setNodeSuggestions([]);
      setSelectedNodeSuggestionNames([]);
      fetchQueue();
      fetchStatus();
    } catch (e: any) {
      setRunResult({ error: e.message });
    } finally {
      setIsAddingDiscoveredNodes(false);
    }
  };

  const handleRunConnectionAgent = async () => {
    setIsConnecting(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agent/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionConfig),
      });
      const data = await res.json();
      setRunResult(data);
      fetchStatus();
      fetchQueue();
    } catch (e: any) {
      setRunResult({ error: e.message });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDedupScan = async () => {
    setIsDedupScanning(true);
    setDedupResult(null);
    setSelectedDedupPairs(new Set());
    try {
      const res = await fetch('/api/agent/dedup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setDedupResult(data);
      // Pre-select high-confidence duplicates
      const autoSelect = new Set<string>(
        (data.duplicates || [])
          .filter((d: any) => d.confidence === 'high')
          .map((d: any) => `${d.nodeA.id}__${d.nodeB.id}`)
      );
      setSelectedDedupPairs(autoSelect);
    } catch (e: any) {
      setDedupResult({ error: e.message });
    } finally {
      setIsDedupScanning(false);
    }
  };

  const handleDedupMerge = async () => {
    if (selectedDedupPairs.size === 0) return;
    setIsDedupMerging(true);
    try {
      const pairs = Array.from(selectedDedupPairs).map((key) => {
        const [idA, idB] = key.split('__');
        const match = dedupResult?.duplicates?.find(
          (d: any) => d.nodeA.id === idA && d.nodeB.id === idB
        );
        // Keep whichever name the LLM chose
        const keepIsA = match ? match.keepName === match.nodeA.name : true;
        return { keepId: keepIsA ? idA : idB, dropId: keepIsA ? idB : idA };
      });
      const res = await fetch('/api/agent/dedup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'merge', pairs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Merge failed');
      // Remove merged pairs from the candidate list and clear selection
      setSelectedDedupPairs(new Set());
      const mergedKeys = new Set(pairs.map((p) => `${p.keepId}__${p.dropId}`).concat(pairs.map((p) => `${p.dropId}__${p.keepId}`)));
      setDedupResult((prev: any) => ({
        ...prev,
        mergeResult: data,
        duplicates: (prev?.duplicates ?? []).filter(
          (d: any) => !mergedKeys.has(`${d.nodeA.id}__${d.nodeB.id}`) && !mergedKeys.has(`${d.nodeB.id}__${d.nodeA.id}`)
        ),
      }));
      fetchStatus();
    } catch (e: any) {
      setDedupResult((prev: any) => ({ ...prev, mergeError: (e as any).message }));
    } finally {
      setIsDedupMerging(false);
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
        <div className="flex flex-wrap justify-between items-start gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Research Agent</h1>
            <p className="text-slate-500 mt-1 text-sm">Automated topic discovery, research, and ingestion</p>
          </div>
          <div className="flex gap-3 items-center flex-shrink-0">
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
            { key: 'overview' as const, label: 'Overview', labelFull: 'Overview & Controls' },
            { key: 'activity' as const, label: 'Activity', labelFull: 'Recent Activity' },
            { key: 'queue' as const, label: `Queue${status ? ` (${status.queue.pending})` : ''}`, labelFull: `Queue${status ? ` (${status.queue.pending})` : ''}` },
            { key: 'runs' as const, label: 'Runs', labelFull: 'Run History' },
            { key: 'quality' as const, label: 'Quality', labelFull: 'Quality Cycle' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-2 sm:px-4 py-2.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.labelFull}</span>
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Add Topic */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Topic to Queue</h2>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTopic(); }}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., The revolving door between Goldman Sachs and the Treasury Department"
                />
                <div className="flex gap-2">
                  <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="flex-1 p-3 border border-slate-300 rounded-lg text-sm">
                    <option value="urgent">Do Next</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={newDepth} onChange={e => setNewDepth(e.target.value)} className="flex-1 p-3 border border-slate-300 rounded-lg text-sm">
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
            </div>

            {/* Agent Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Run Agent */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-3">Run Research Agent</h2>
                <p className="text-sm text-slate-500 mb-4">Processes pending topics from the queue. Researches via LLM, ingests into DB, and queues suggested follow-ups.</p>
                <div className="flex flex-wrap gap-3 mb-4">
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

              {/* Tighten Connections */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-3">Tighten Connections Agent</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Strengthens existing links, adds likely missing node connections, and optionally queues verification research.
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Max New Links</label>
                    <select
                      value={connectionConfig.maxNewLinks}
                      onChange={e => setConnectionConfig({ ...connectionConfig, maxNewLinks: parseInt(e.target.value) })}
                      className="p-2 border border-slate-300 rounded text-sm"
                    >
                      {[5, 10, 15, 25, 50, 100].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Queue Verify</label>
                    <select
                      value={connectionConfig.queueVerificationTopics ? 'yes' : 'no'}
                      onChange={e => setConnectionConfig({ ...connectionConfig, queueVerificationTopics: e.target.value === 'yes' })}
                      className="p-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Mode</label>
                    <select
                      value={connectionConfig.dryRun ? 'dry' : 'write'}
                      onChange={e => setConnectionConfig({ ...connectionConfig, dryRun: e.target.value === 'dry' })}
                      className="p-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="write">Apply</option>
                      <option value="dry">Dry Run</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleRunConnectionAgent}
                  disabled={isConnecting}
                  className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-colors ${
                    isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-cyan-600 hover:bg-cyan-700'
                  }`}
                >
                  {isConnecting ? 'Running Connection Agent...' : (connectionConfig.dryRun ? 'Run Dry Connection Audit' : 'Run Tighten Connections')}
                </button>
              </div>
            </div>

            {/* Discover Missing Nodes */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Discover Missing Nodes</h2>
              <p className="text-sm text-slate-500 mb-4">
                Suggests 5-10 likely missing high-value nodes from current graph coverage. Review and pick which ones to add.
              </p>
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Suggestion Count</label>
                  <select
                    value={nodeDiscoveryMax}
                    onChange={(e) => setNodeDiscoveryMax(parseInt(e.target.value))}
                    className="p-2 border border-slate-300 rounded text-sm"
                  >
                    {[5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleDiscoverNodes}
                  disabled={isDiscoveringNodes}
                  className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                    isDiscoveringNodes ? 'bg-yellow-500 animate-pulse' : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                >
                  {isDiscoveringNodes ? 'Discovering Nodes...' : 'Discover Missing Nodes'}
                </button>
                {nodeSuggestions.length > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedNodeSuggestionNames(nodeSuggestions.map((s) => s.name))}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedNodeSuggestionNames([])}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              {nodeSuggestions.length > 0 && (
                <div className="space-y-2 mb-4">
                  {nodeSuggestions.map((s) => {
                    const checked = selectedNodeSuggestionNames.includes(s.name);
                    return (
                      <label key={s.name} className="block border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleNodeSuggestion(s.name)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-800">{s.name}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 capitalize">
                                {s.type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                importance {s.importance}/5
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{s.rationale}</p>
                            {s.suggestedConnections?.length > 0 && (
                              <div className="text-xs text-slate-500 mt-1">
                                Suggested ties: {s.suggestedConnections.map((c) => c.existingNodeName).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleAddSelectedDiscoveredNodes}
                disabled={isAddingDiscoveredNodes || selectedNodeSuggestionNames.length === 0}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                  isAddingDiscoveredNodes ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'
                } disabled:bg-slate-300 disabled:cursor-not-allowed`}
              >
                {isAddingDiscoveredNodes
                  ? 'Adding Selected Nodes...'
                  : `Add Selected Nodes (${selectedNodeSuggestionNames.length})`}
              </button>
            </div>

            {/* Deduplicate Nodes */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Deduplicate Nodes</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Scans for nodes with similar names (e.g. "Richard Nixon" vs "Richard Nixon (politician)") and uses LLM to judge whether they're the same entity.
                  </p>
                </div>
                <button
                  onClick={handleDedupScan}
                  disabled={isDedupScanning || isDedupMerging}
                  className={`px-4 py-2 rounded-lg font-medium text-white transition-colors whitespace-nowrap ${
                    isDedupScanning ? 'bg-yellow-500 animate-pulse' : 'bg-rose-600 hover:bg-rose-700'
                  } disabled:opacity-50`}
                >
                  {isDedupScanning ? 'Scanning...' : 'Scan for Duplicates'}
                </button>
              </div>

              {dedupResult?.error && (
                <p className="text-sm text-red-600">{dedupResult.error}</p>
              )}

              {dedupResult && !dedupResult.error && (
                <>
                  <div className="flex flex-wrap gap-4 text-sm mb-4">
                    <span className="text-slate-600">Candidates checked: <strong>{dedupResult.totalCandidates ?? 0}</strong></span>
                    <span className="text-rose-600">Likely duplicates: <strong>{dedupResult.duplicates?.length ?? 0}</strong></span>
                    {(dedupResult.uncertain?.length ?? 0) > 0 && (
                      <span className="text-amber-600">Uncertain: <strong>{dedupResult.uncertain.length}</strong></span>
                    )}
                    <span className="text-slate-400">Not duplicates: <strong>{dedupResult.notDuplicatesCount ?? 0}</strong></span>
                  </div>

                  {dedupResult.mergeResult && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                      Merged <strong>{dedupResult.mergeResult.merged}</strong> node pair{dedupResult.mergeResult.merged !== 1 ? 's' : ''}.
                      {dedupResult.mergeResult.results?.some((r: any) => r.status === 'error') && (
                        <span className="text-red-600 ml-2">Some merges failed — check console.</span>
                      )}
                    </div>
                  )}
                  {dedupResult.mergeError && (
                    <p className="mb-4 text-sm text-red-600">{dedupResult.mergeError}</p>
                  )}

                  {(dedupResult.duplicates?.length ?? 0) > 0 && (
                    <>
                      <div className="space-y-2 mb-4">
                        {dedupResult.duplicates.map((d: any) => {
                          const key = `${d.nodeA.id}__${d.nodeB.id}`;
                          const checked = selectedDedupPairs.has(key);
                          return (
                            <label key={key} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedDedupPairs(prev => {
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key); else next.add(key);
                                    return next;
                                  });
                                }}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="font-medium text-slate-800">{d.nodeA.name}</span>
                                  <span className="text-slate-400 text-xs">({d.nodeA.type})</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="font-medium text-rose-700 line-through decoration-slate-400">{d.nodeB.name}</span>
                                  <span className="text-slate-400 text-xs">({d.nodeB.type})</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    d.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                    d.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>{d.confidence}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Keep: <strong>{d.keepName}</strong> — {d.reason}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={handleDedupMerge}
                          disabled={selectedDedupPairs.size === 0 || isDedupMerging}
                          className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                            isDedupMerging ? 'bg-yellow-500 animate-pulse' : 'bg-rose-600 hover:bg-rose-700'
                          } disabled:bg-slate-300 disabled:cursor-not-allowed`}
                        >
                          {isDedupMerging ? 'Merging...' : `Merge Selected (${selectedDedupPairs.size})`}
                        </button>
                        <button
                          onClick={() => setSelectedDedupPairs(new Set(dedupResult.duplicates.map((d: any) => `${d.nodeA.id}__${d.nodeB.id}`)))}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedDedupPairs(new Set())}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      </div>
                    </>
                  )}

                  {dedupResult.duplicates?.length === 0 && (
                    <p className="text-sm text-green-700">No duplicates found — graph looks clean.</p>
                  )}
                </>
              )}
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

            {runResult && !isRunning && typeof runResult.relationshipsScanned === 'number' && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Connection Agent Result</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-slate-700">Scanned: <strong>{runResult.relationshipsScanned}</strong></span>
                  <span className="text-green-700">Tightened: <strong>{runResult.relationshipsTightened}</strong></span>
                  <span className="text-blue-700">Created: <strong>{runResult.missingLinksCreated}</strong></span>
                  <span className="text-indigo-700">Queued Verify: <strong>{runResult.verificationTopicsQueued}</strong></span>
                  <span className="text-slate-500">Status: <strong>{runResult.status}</strong></span>
                </div>
              </div>
            )}

            {runResult?.discoveredNodesAdd && !isRunning && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Discovered Nodes Added</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-emerald-700">Added: <strong>{runResult.discoveredNodesAdd.added ?? 0}</strong></span>
                  <span className="text-blue-700">Queued: <strong>{runResult.discoveredNodesAdd.queued ?? 0}</strong></span>
                  <span className="text-slate-600">Already existed: <strong>{runResult.discoveredNodesAdd.skippedExisting ?? 0}</strong></span>
                </div>
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

        {/* ── Activity Tab ── */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Recent Activity</h2>
              <button
                onClick={fetchActivity}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Refresh
              </button>
            </div>

            {!recentActivity ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center text-slate-400">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Nodes */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                    Nodes ({recentActivity.nodes.length})
                  </h3>
                  {recentActivity.nodes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-6 text-center text-slate-400 text-sm">No nodes yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentActivity.nodes.map((node: any) => (
                        <div key={node.id} className="bg-white rounded-lg shadow-sm p-3">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              node.isNew ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {node.isNew ? 'new' : 'updated'}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                              {node.type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {new Date(node.updatedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-medium text-slate-800 text-sm">{node.name}</p>
                          {node.title && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{node.title}</p>
                          )}
                          {node.affiliation && (
                            <span className="text-xs text-slate-400">{node.affiliation}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Connections */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                    Connections ({recentActivity.connections.length})
                  </h3>
                  {recentActivity.connections.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-6 text-center text-slate-400 text-sm">No connections yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentActivity.connections.map((conn: any) => (
                        <div key={conn.id} className="bg-white rounded-lg shadow-sm p-3">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              conn.isNew ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {conn.isNew ? 'new' : 'updated'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              conn.tier === 'documented' ? 'bg-blue-100 text-blue-700' :
                              conn.tier === 'interactional' ? 'bg-purple-100 text-purple-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {conn.tier}
                            </span>
                            <span className="text-xs text-slate-400">sig {conn.significance}/5</span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {new Date(conn.updatedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800">
                            <span className="font-medium">{conn.source.name}</span>
                            <span className="text-slate-400 mx-1.5">{conn.relationshipType.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{conn.target.name}</span>
                          </p>
                          {conn.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{conn.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Queue Tab ── */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex flex-wrap gap-2">
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
                  <div key={item.id} className="bg-white rounded-lg shadow-sm p-3 group">
                    {/* Badges + actions in one row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {item.status === 'pending' ? (
                        <select
                          value={item.priority}
                          onChange={e => handleQueueAction(item.id, 'prioritize', { priority: e.target.value })}
                          className={`px-1.5 py-0.5 rounded text-xs font-medium border-0 cursor-pointer appearance-none ${priorityColor(item.priority)}`}
                        >
                          <option value="urgent">do next</option>
                          <option value="high">high</option>
                          <option value="medium">medium</option>
                          <option value="low">low</option>
                        </select>
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${priorityColor(item.priority)}`}>{item.priority}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(item.status)}`}>{item.status}</span>
                      <span className="text-xs text-slate-400">{sourceLabel(item.source)}</span>
                      <div className="flex gap-1 ml-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {item.status === 'pending' && (
                          <button onClick={() => handleQueueAction(item.id, 'skip')} className="px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 rounded">Skip</button>
                        )}
                        {(item.status === 'failed' || item.status === 'skipped') && (
                          <button onClick={() => handleQueueAction(item.id, 'requeue')} className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded">Re-queue</button>
                        )}
                        <button onClick={() => handleQueueAction(item.id, 'delete')} className="px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 rounded">Delete</button>
                      </div>
                    </div>
                    {/* Topic — full width, no competing column */}
                    <p className="font-medium text-slate-800 text-sm leading-snug">{item.topic}</p>
                    {item.rationale && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.rationale}</p>
                    )}
                    {item.error && (
                      <p className="text-xs text-red-600 mt-0.5 line-clamp-1">Error: {item.error}</p>
                    )}
                    {item.status === 'completed' && (
                      <p className="text-xs text-green-600 mt-0.5">
                        {item.evidenceCreated ?? 0} evidence · {item.entitiesCreated ?? 0} entities · {item.relationshipsCreated ?? 0} relationships
                      </p>
                    )}
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
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
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
