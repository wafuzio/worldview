'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { GraphNode, GraphEdge } from './CytoscapeGraph';

// Dynamic import — Cytoscape needs window/document
const CytoscapeGraph = dynamic(() => import('./CytoscapeGraph'), { ssr: false });

// ── Relationship type labels ──
const REL_LABELS: Record<string, string> = {
  funded_by: 'funded by', appointed_by: 'appointed by', employed_by: 'employed by',
  voted_for: 'voted for', donated_to: 'donated to', contracted_with: 'contracted with',
  endorsed: 'endorsed', met_with: 'met with', communicated_with: 'communicated with',
  testified_before: 'testified before', lobbied: 'lobbied', briefed_by: 'briefed by',
  served_on_board_with: 'served on board with', influenced_by: 'influenced by',
  aligned_with: 'aligned with', protected_by: 'protected by', enabled: 'enabled',
  shielded_from_investigation: 'shielded from investigation', authored: 'authored',
  founded: 'founded', member_of: 'member of', ruled_on: 'ruled on',
  inferred_affiliation: 'likely affiliated with',
  inferred_same_entity: 'likely same entity as',
  indirect_connection: 'indirect connection',
  placeholder_link: 'possible link (to verify)',
};

// ── Type badge colors ──
const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  politician: { bg: 'bg-blue-50', text: 'text-blue-600' },
  donor: { bg: 'bg-green-50', text: 'text-green-700' },
  operative: { bg: 'bg-violet-50', text: 'text-violet-600' },
  party: { bg: 'bg-purple-50', text: 'text-purple-600' },
  lobbyist: { bg: 'bg-amber-50', text: 'text-amber-600' },
  pac: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  corporation: { bg: 'bg-red-50', text: 'text-red-600' },
  media_figure: { bg: 'bg-pink-50', text: 'text-pink-600' },
  organization: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  legislation: { bg: 'bg-teal-50', text: 'text-teal-700' },
  event: { bg: 'bg-orange-50', text: 'text-orange-700' },
};

// ── Tier styling ──
const TIER_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  documented: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Documented' },
  interactional: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Interactional' },
  analytical: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Analytical' },
};

interface SearchResult {
  id: string;
  name: string;
  type: string;
  title: string | null;
  affiliation: string | null;
}

interface ExistingNodeOption {
  id: string;
  name: string;
  type: string;
}

interface PathTraceResult {
  found: boolean;
  hops?: number;
  message?: string;
  from?: { id: string; name: string; type: string };
  to?: { id: string; name: string; type: string };
  nodes?: { id: string; name: string; type: string }[];
  edges?: {
    id: string;
    sourceId: string;
    sourceName: string;
    targetId: string;
    targetName: string;
    relationshipType: string;
    tier: string;
    significance: number;
    description: string | null;
    evidenceCount: number;
    originalDirection: 'forward' | 'reverse';
  }[];
}

function normalizeNodeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MapPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [viaNodeIds, setViaNodeIds] = useState<Set<string>>(new Set());
  const [centerId, setCenterId] = useState<string | null>(null);
  const [centerName, setCenterName] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [depth, setDepth] = useState(2);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filters
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [minSignificance, setMinSignificance] = useState(1);
  const [includeIndirect, setIncludeIndirect] = useState(true);
  const [preserveContext, setPreserveContext] = useState(true);
  const [editorMode, setEditorMode] = useState(false);
  const [newLinkedNodeName, setNewLinkedNodeName] = useState('');
  const [newLinkedNodeType, setNewLinkedNodeType] = useState('organization');
  const [placeholderQuery, setPlaceholderQuery] = useState('');
  const [existingNodeOptions, setExistingNodeOptions] = useState<ExistingNodeOption[]>([]);
  const [selectedExistingNodeId, setSelectedExistingNodeId] = useState('');
  const [loadingExistingNodes, setLoadingExistingNodes] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [traceNodeOptions, setTraceNodeOptions] = useState<ExistingNodeOption[]>([]);
  const [loadingTraceNodes, setLoadingTraceNodes] = useState(false);
  const [traceFromName, setTraceFromName] = useState('');
  const [traceToName, setTraceToName] = useState('');
  const [tracingPath, setTracingPath] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceResult, setTraceResult] = useState<PathTraceResult | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Fetch graph data ──
  const fetchGraph = useCallback(
    async (nodeId?: string | null, d?: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (!preserveContext) {
        if (nodeId) params.set('centerId', nodeId);
        if (d) params.set('depth', String(d));
      }
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (minSignificance > 1) params.set('minSignificance', String(minSignificance));
      if (includeIndirect) params.set('includeIndirect', 'true');

      try {
        const res = await fetch(`/api/graph?${params}`);
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setViaNodeIds(new Set<string>(data.viaNodeIds || []));
      } catch (err) {
        console.error('Failed to fetch graph:', err);
      } finally {
        setLoading(false);
      }
    },
    [tierFilter, minSignificance, includeIndirect, preserveContext]
  );

  useEffect(() => {
    fetchGraph(centerId, depth);
  }, [fetchGraph, centerId, depth]);

  // ── Search ──
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/graph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const results = await res.json();
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 250);
  }, []);

  const selectCenter = useCallback((id: string, name: string) => {
    setCenterId(id);
    setCenterName(name);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setDepth(2);
  }, []);

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setLinkStatus(null);
    if (node) setMobileSidebarOpen(true);
  }, []);

  const handleNodeExpand = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    selectCenter(nodeId, node?.name || '');
    setLinkStatus(null);
  }, [nodes, selectCenter]);

  const centeredNode = centerId ? nodes.find((n) => n.id === centerId) || null : null;
  const inspectedNode = selectedNode || centeredNode;

  const createLinkedPlaceholder = useCallback(async () => {
    if (!inspectedNode || !newLinkedNodeName.trim()) return;
    setLinking(true);
    setLinkStatus(null);
    try {
      const res = await fetch('/api/graph/placeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: inspectedNode.id,
          targetName: newLinkedNodeName.trim(),
          targetType: newLinkedNodeType,
          relationshipType: 'placeholder_link',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create linked placeholder');

      const queueText = data.queued
        ? 'Research topic queued.'
        : data.existingTopic
          ? 'Queue topic already exists.'
          : 'No queue item created.';
      const imageText = data.imageAutoApplied
        ? ` Image auto-filled (${data.imageSource || 'suggested source'}).`
        : ' Image not found yet.';
      setLinkStatus(`Linked ${inspectedNode.name} -> ${data.target?.name}. ${queueText}${imageText}`);
      setNewLinkedNodeName('');
      await fetchGraph(centerId, depth);
    } catch (e: any) {
      setLinkStatus(e.message || 'Failed creating linked placeholder');
    } finally {
      setLinking(false);
    }
  }, [inspectedNode, newLinkedNodeName, newLinkedNodeType, fetchGraph, centerId, depth]);

  const loadExistingNodeOptions = useCallback(async (query?: string) => {
    setLoadingExistingNodes(true);
    try {
      const params = new URLSearchParams();
      params.set('all', 'true');
      params.set('limit', '500');
      const q = (query ?? placeholderQuery).trim();
      if (q) params.set('q', q);

      const res = await fetch(`/api/graph/placeholders?${params.toString()}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setExistingNodeOptions(items);
      if (items.length === 0) {
        setSelectedExistingNodeId('');
      } else if (!items.some((item: ExistingNodeOption) => item.id === selectedExistingNodeId)) {
        setSelectedExistingNodeId(items[0].id);
      }
    } catch {
      setExistingNodeOptions([]);
      setSelectedExistingNodeId('');
    } finally {
      setLoadingExistingNodes(false);
    }
  }, [placeholderQuery, selectedExistingNodeId]);

  useEffect(() => {
    if (editorMode) {
      loadExistingNodeOptions('');
    }
  }, [editorMode, loadExistingNodeOptions]);

  useEffect(() => {
    if (!editorMode) return;
    const timeout = setTimeout(() => {
      loadExistingNodeOptions(placeholderQuery);
    }, 250);
    return () => clearTimeout(timeout);
  }, [editorMode, placeholderQuery, loadExistingNodeOptions]);

  const connectExistingNode = useCallback(async () => {
    if (!inspectedNode || !selectedExistingNodeId) return;
    setLinking(true);
    setLinkStatus(null);
    try {
      const res = await fetch('/api/graph/placeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: inspectedNode.id,
          targetId: selectedExistingNodeId,
          relationshipType: 'placeholder_link',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect existing node');

      const queueText = data.queued
        ? 'Research topic queued.'
        : data.existingTopic
          ? 'Queue topic already exists.'
          : 'No queue item created.';
      setLinkStatus(`Linked ${inspectedNode.name} -> ${data.target?.name}. ${queueText}`);
      await fetchGraph(centerId, depth);
    } catch (e: any) {
      setLinkStatus(e.message || 'Failed connecting existing node');
    } finally {
      setLinking(false);
    }
  }, [inspectedNode, selectedExistingNodeId, fetchGraph, centerId, depth]);

  const loadTraceNodeOptions = useCallback(async () => {
    setLoadingTraceNodes(true);
    try {
      const res = await fetch('/api/graph/placeholders?all=true&limit=5000');
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setTraceNodeOptions(items);
    } catch {
      setTraceNodeOptions([]);
    } finally {
      setLoadingTraceNodes(false);
    }
  }, []);

  useEffect(() => {
    loadTraceNodeOptions();
  }, [loadTraceNodeOptions]);

  const traceConnectionPath = useCallback(async () => {
    setTraceError(null);
    setTraceResult(null);
    const fromInput = traceFromName.trim();
    const toInput = traceToName.trim();
    if (!fromInput || !toInput) {
      setTraceError('Enter both node names to trace a path.');
      return;
    }

    const fromNorm = normalizeNodeName(fromInput);
    const toNorm = normalizeNodeName(toInput);
    const fromMatch = traceNodeOptions.find((n) => normalizeNodeName(n.name) === fromNorm)
      || traceNodeOptions.find((n) => normalizeNodeName(n.name).includes(fromNorm));
    const toMatch = traceNodeOptions.find((n) => normalizeNodeName(n.name) === toNorm)
      || traceNodeOptions.find((n) => normalizeNodeName(n.name).includes(toNorm));

    if (!fromMatch || !toMatch) {
      setTraceError('Could not resolve one or both node names. Pick from suggestions or refresh node list.');
      return;
    }

    setTracingPath(true);
    try {
      const params = new URLSearchParams({
        fromId: fromMatch.id,
        toId: toMatch.id,
      });
      const res = await fetch(`/api/graph/path?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trace path');
      setTraceResult(data);
      if (data?.found && data?.from?.id) {
        selectCenter(data.from.id, data.from.name);
        setMobileSidebarOpen(true);
      }
    } catch (e: any) {
      setTraceError(e.message || 'Failed to trace path');
    } finally {
      setTracingPath(false);
    }
  }, [traceFromName, traceToName, traceNodeOptions, selectCenter]);

  // Find edges connected to inspected node
  const selectedNodeEdges = inspectedNode
    ? edges.filter((e) => e.source === inspectedNode.id || e.target === inspectedNode.id)
    : [];

  const strongestConnection = useMemo(() => {
    if (!inspectedNode || selectedNodeEdges.length === 0) return null;
    const strongest = [...selectedNodeEdges].sort((a, b) => b.significance - a.significance)[0];
    if (!strongest) return null;
    const otherId = strongest.source === inspectedNode.id ? strongest.target : strongest.source;
    const otherNode = nodes.find((n) => n.id === otherId);
    if (!otherNode) return null;
    const label = REL_LABELS[strongest.relationshipType] || strongest.relationshipType.replace(/_/g, ' ');
    return { otherNode, label, significance: strongest.significance };
  }, [inspectedNode, nodes, selectedNodeEdges]);

  const filteredExistingNodeOptions = useMemo(() => {
    const q = placeholderQuery.trim().toLowerCase();
    if (!q) return existingNodeOptions;
    return existingNodeOptions.filter((p) => `${p.name} ${p.type}`.toLowerCase().includes(q));
  }, [existingNodeOptions, placeholderQuery]);

  return (
    <div className="h-screen flex flex-col bg-white text-slate-900 overflow-hidden">
      {/* ── Top bar ── */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm shrink-0 z-40">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
          <a href="/" className="text-lg font-semibold text-slate-900 tracking-tight shrink-0">
            WORLDVIEW
          </a>
          <div className="hidden sm:block h-5 w-px bg-slate-300" />
          <h1 className="hidden sm:block text-sm font-medium text-slate-500 shrink-0">Corruption Map</h1>

          {/* Search */}
          <div className="relative order-3 sm:order-none w-full sm:w-auto sm:flex-1 sm:max-w-md sm:ml-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              placeholder="Search actors, organizations, PACs..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {searchResults.map((r) => {
                  const badge = TYPE_BADGE[r.type] || TYPE_BADGE.organization;
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectCenter(r.id, r.name)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
                    >
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} capitalize shrink-0`}>
                        {r.type.replace('_', ' ')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-900 truncate">{r.name}</div>
                        {r.title && <div className="text-xs text-slate-500 truncate">{r.title}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="order-4 sm:order-none flex items-center gap-2 ml-0 sm:ml-auto shrink-0 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <label className="text-xs text-slate-500">Tier:</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1.5 text-slate-700"
            >
              <option value="all">All</option>
              <option value="documented">Documented</option>
              <option value="interactional">Interactional</option>
              <option value="analytical">Analytical</option>
            </select>

            <label className="text-xs text-slate-500">Min sig:</label>
            <select
              value={minSignificance}
              onChange={(e) => setMinSignificance(parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1.5 text-slate-700"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}+</option>
              ))}
            </select>

            <label className="text-xs text-slate-500">Indirect:</label>
            <button
              onClick={() => setIncludeIndirect((v) => !v)}
              className={`text-xs px-2 py-1.5 rounded border ${
                includeIndirect
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {includeIndirect ? 'On' : 'Off'}
            </button>

            <label className="text-xs text-slate-500">Keep full network:</label>
            <button
              onClick={() => setPreserveContext((v) => !v)}
              className={`text-xs px-2 py-1.5 rounded border ${
                preserveContext
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {preserveContext ? 'On' : 'Off'}
            </button>

            <label className="text-xs text-slate-500">Editor:</label>
            <button
              onClick={() => setEditorMode((v) => !v)}
              className={`text-xs px-2 py-1.5 rounded border ${
                editorMode
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {editorMode ? 'On' : 'Off'}
            </button>

            {centerId && !preserveContext && (
              <>
                <label className="text-xs text-slate-500">Depth:</label>
                <select
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1.5 text-slate-700"
                >
                  <option value={1}>1 hop</option>
                  <option value={2}>2 hops</option>
                  <option value={3}>3 hops</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {centerId && (
          <div className="px-4 pb-2 text-xs space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCenterId(null); setCenterName(null); setSelectedNode(null); }}
                className="text-blue-600 hover:text-blue-500 transition-colors"
              >
                All Actors
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700 font-medium">{centerName}</span>
              <span className="text-slate-400 ml-1">
                ({nodes.length} nodes, {edges.length} connections)
              </span>
            </div>

            {centeredNode && (
              <div className="flex items-center gap-2 text-slate-500">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${(TYPE_BADGE[centeredNode.type] || TYPE_BADGE.organization).bg} ${(TYPE_BADGE[centeredNode.type] || TYPE_BADGE.organization).text}`}>
                  {centeredNode.type.replace('_', ' ')}
                </span>
                <span className="truncate">
                  {centeredNode.title || centeredNode.description || 'No role description available yet.'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Graph canvas */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400 text-sm">Loading graph...</div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-slate-400 text-lg">No actors in the database yet</div>
              <p className="text-slate-500 text-sm max-w-md text-center">
                Add politicians, organizations, and their relationships through the admin panel
                or run the graph seed to populate the corruption map.
              </p>
              <a href="/admin" className="text-sm px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-colors">
                Go to Admin Panel
              </a>
            </div>
          ) : (
            <CytoscapeGraph
              nodes={nodes}
              edges={edges}
              centerId={centerId}
              viaNodeIds={viaNodeIds}
              onNodeSelect={handleNodeSelect}
              onNodeExpand={handleNodeExpand}
            />
          )}

          <button
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="md:hidden absolute bottom-4 right-4 z-30 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow-lg"
          >
            {mobileSidebarOpen ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {mobileSidebarOpen && (
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden absolute inset-0 bg-slate-900/25 z-40"
            aria-label="Close details panel overlay"
          />
        )}

        {/* ── Sidebar: Node Detail ── */}
        <div
          className={`fixed md:static top-0 right-0 h-full md:h-auto w-[92vw] max-w-[420px] md:w-96 border-l border-slate-200 bg-slate-50 overflow-y-auto shrink-0 z-50 md:z-auto transition-transform duration-200 ${
            mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="md:hidden sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
            <div className="text-sm font-medium text-slate-700">Node Details</div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-700"
            >
              Close
            </button>
          </div>
          {!inspectedNode ? (
            <div className="p-4">
              <h2 className="text-base font-semibold text-slate-900">Node Details</h2>
              <p className="text-sm text-slate-500 mt-2">
                Click any node to inspect essential facts and evidence-backed connections.
              </p>
              <div className="mt-4 bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                <h3 className="text-sm font-medium text-slate-700">Trace Connection Path</h3>
                <p className="text-xs text-slate-500">
                  Pick any two nodes by name and trace the shortest known relationship path between them.
                </p>
                <input
                  list="trace-node-options"
                  value={traceFromName}
                  onChange={(e) => setTraceFromName(e.target.value)}
                  placeholder="From node (e.g., Jeffrey Epstein)"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  list="trace-node-options"
                  value={traceToName}
                  onChange={(e) => setTraceToName(e.target.value)}
                  placeholder="To node (e.g., Elon Musk)"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <datalist id="trace-node-options">
                  {traceNodeOptions.map((n) => (
                    <option key={n.id} value={n.name} />
                  ))}
                </datalist>
                <div className="flex gap-2">
                  <button
                    onClick={traceConnectionPath}
                    disabled={tracingPath || !traceFromName.trim() || !traceToName.trim()}
                    className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {tracingPath ? 'Tracing...' : 'Trace Path'}
                  </button>
                  <button
                    onClick={loadTraceNodeOptions}
                    disabled={loadingTraceNodes}
                    className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {loadingTraceNodes ? 'Refreshing...' : 'Refresh Nodes'}
                  </button>
                </div>
                {traceError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    {traceError}
                  </div>
                )}
                {traceResult && !traceResult.found && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    {traceResult.message || 'No path found between these nodes yet.'}
                  </div>
                )}
                {traceResult?.found && (traceResult.edges?.length || 0) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs text-slate-600">
                      Path found: <span className="font-medium text-slate-800">{traceResult.hops} hops</span>
                    </div>
                    {(traceResult.edges || []).map((edge, idx) => {
                      const rel = REL_LABELS[edge.relationshipType] || edge.relationshipType.replace(/_/g, ' ');
                      return (
                        <div key={edge.id} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                          <button
                            onClick={() => selectCenter(edge.sourceId, edge.sourceName)}
                            className="font-medium text-blue-700 hover:text-blue-600"
                          >
                            {edge.sourceName}
                          </button>{' '}
                          <span className="text-slate-500">{rel}</span>{' '}
                          <button
                            onClick={() => selectCenter(edge.targetId, edge.targetName)}
                            className="font-medium text-blue-700 hover:text-blue-600"
                          >
                            {edge.targetName}
                          </button>{' '}
                          <span className="text-slate-400">(step {idx + 1})</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{inspectedNode.name}</h2>
                  {inspectedNode.title && (
                    <div className="text-sm text-slate-500 mt-0.5">{inspectedNode.title}</div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
                >
                  x
                </button>
              </div>

              {/* Type + Affiliation badges */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const badge = TYPE_BADGE[inspectedNode.type] || TYPE_BADGE.organization;
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} capitalize`}>
                      {inspectedNode.type.replace('_', ' ')}
                    </span>
                  );
                })()}
                {inspectedNode.affiliation && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    {inspectedNode.affiliation}
                  </span>
                )}
              </div>

              {/* Essential Facts */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                <h3 className="text-sm font-medium text-slate-700">Essential Facts</h3>
                <div className="text-xs text-slate-600">
                  Entity type: <span className="font-medium text-slate-800 capitalize">{inspectedNode.type.replace('_', ' ')}</span>
                </div>
                <div className="text-xs text-slate-600">
                  Role/summary: <span className="font-medium text-slate-800">{inspectedNode.title || inspectedNode.description || 'No summary yet'}</span>
                </div>
                <div className="text-xs text-slate-600">
                  Direct connections: <span className="font-medium text-slate-800">{selectedNodeEdges.length}</span>
                </div>
                <div className="text-xs text-slate-600">
                  Connections with sources: <span className="font-medium text-slate-800">{selectedNodeEdges.filter((e) => (e.evidence?.length || 0) > 0).length}</span>
                </div>
                {strongestConnection && (
                  <div className="text-xs text-slate-600">
                    Strongest link: <span className="font-medium text-slate-800">{strongestConnection.label} {strongestConnection.otherNode.name}</span> (sig {strongestConnection.significance}/5)
                  </div>
                )}
              </div>

              {/* Description */}
              {inspectedNode.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{inspectedNode.description}</p>
              )}

              {/* Tags */}
              {inspectedNode.tags && inspectedNode.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {inspectedNode.tags.map((tag: string) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleNodeExpand(inspectedNode.id)}
                  className="flex-1 text-sm px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Re-center on this node
                </button>
              </div>

              {editorMode && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Add Connected Placeholder</h3>
                  <p className="text-xs text-slate-500">
                    Create a new node linked to this node, then auto-queue research to verify and enrich it.
                  </p>
                  <input
                    value={newLinkedNodeName}
                    onChange={(e) => setNewLinkedNodeName(e.target.value)}
                    placeholder='e.g., Proud Boys'
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newLinkedNodeType}
                      onChange={(e) => setNewLinkedNodeType(e.target.value)}
                      className="border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-700"
                    >
                      <option value="organization">Organization</option>
                      <option value="corporation">Corporation</option>
                      <option value="politician">Person</option>
                      <option value="party">Party</option>
                      <option value="lobbyist">Lobbyist</option>
                      <option value="pac">PAC</option>
                      <option value="media_figure">Media Figure</option>
                      <option value="legislation">Legislation</option>
                      <option value="event">Event</option>
                    </select>
                    <button
                      onClick={createLinkedPlaceholder}
                      disabled={linking || !newLinkedNodeName.trim()}
                      className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {linking ? 'Adding...' : 'Add + Queue'}
                    </button>
                  </div>
                  {linkStatus && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                      {linkStatus}
                    </div>
                  )}
                </div>
              )}

              {editorMode && (
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Connect Existing Node</h3>
                  <p className="text-xs text-slate-500">
                    Link this node to any existing node and queue research for evidence-backed connection details.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={placeholderQuery}
                      onChange={(e) => setPlaceholderQuery(e.target.value)}
                      placeholder="Search existing nodes..."
                      className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => loadExistingNodeOptions(placeholderQuery)}
                      disabled={loadingExistingNodes}
                      className="px-2 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Refresh
                    </button>
                  </div>
                  <select
                    value={selectedExistingNodeId}
                    onChange={(e) => setSelectedExistingNodeId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-700"
                    disabled={loadingExistingNodes || filteredExistingNodeOptions.length === 0}
                  >
                    {filteredExistingNodeOptions.length === 0 ? (
                      <option value="">No nodes found</option>
                    ) : (
                      filteredExistingNodeOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type.replace('_', ' ')})
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={connectExistingNode}
                    disabled={linking || !selectedExistingNodeId}
                    className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {linking ? 'Connecting...' : 'Connect + Queue Research'}
                  </button>
                </div>
              )}

              <div className="border-t border-slate-200" />

              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                <h3 className="text-sm font-medium text-slate-700">Trace Connection Path</h3>
                <p className="text-xs text-slate-500">
                  Pick any two nodes by name and trace the shortest known relationship path between them.
                </p>
                <input
                  list="trace-node-options"
                  value={traceFromName}
                  onChange={(e) => setTraceFromName(e.target.value)}
                  placeholder="From node (e.g., Jeffrey Epstein)"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  list="trace-node-options"
                  value={traceToName}
                  onChange={(e) => setTraceToName(e.target.value)}
                  placeholder="To node (e.g., Elon Musk)"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <datalist id="trace-node-options">
                  {traceNodeOptions.map((n) => (
                    <option key={n.id} value={n.name} />
                  ))}
                </datalist>
                <div className="flex gap-2">
                  <button
                    onClick={traceConnectionPath}
                    disabled={tracingPath || !traceFromName.trim() || !traceToName.trim()}
                    className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {tracingPath ? 'Tracing...' : 'Trace Path'}
                  </button>
                  <button
                    onClick={loadTraceNodeOptions}
                    disabled={loadingTraceNodes}
                    className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {loadingTraceNodes ? 'Refreshing...' : 'Refresh Nodes'}
                  </button>
                </div>
                {traceError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    {traceError}
                  </div>
                )}
                {traceResult && !traceResult.found && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    {traceResult.message || 'No path found between these nodes yet.'}
                  </div>
                )}
                {traceResult?.found && (traceResult.edges?.length || 0) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs text-slate-600">
                      Path found: <span className="font-medium text-slate-800">{traceResult.hops} hops</span>
                    </div>
                    {(traceResult.edges || []).map((edge, idx) => {
                      const rel = REL_LABELS[edge.relationshipType] || edge.relationshipType.replace(/_/g, ' ');
                      return (
                        <div key={edge.id} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                          <button
                            onClick={() => selectCenter(edge.sourceId, edge.sourceName)}
                            className="font-medium text-blue-700 hover:text-blue-600"
                          >
                            {edge.sourceName}
                          </button>{' '}
                          <span className="text-slate-500">{rel}</span>{' '}
                          <button
                            onClick={() => selectCenter(edge.targetId, edge.targetName)}
                            className="font-medium text-blue-700 hover:text-blue-600"
                          >
                            {edge.targetName}
                          </button>{' '}
                          <span className="text-slate-400">(step {idx + 1})</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connections */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">
                  Connections ({selectedNodeEdges.length})
                </h3>
                <div className="space-y-3">
                  {selectedNodeEdges
                    .sort((a, b) => b.significance - a.significance)
                    .map((edge) => {
                      const isSource = edge.source === inspectedNode.id;
                      const otherId = isSource ? edge.target : edge.source;
                      const otherNode = nodes.find((n) => n.id === otherId);
                      const label = REL_LABELS[edge.relationshipType] || edge.relationshipType.replace(/_/g, ' ');
                      const tierBadge = TIER_BADGE[edge.tier] || TIER_BADGE.documented;

                      return (
                        <div
                          key={edge.id}
                          className="bg-white rounded-lg p-3 space-y-2 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                          onClick={() => {
                            if (otherNode) selectCenter(otherNode.id, otherNode.name);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-700">
                                {isSource ? (
                                  <>
                                    <span className="text-slate-400">{label}</span>{' '}
                                    <span className="font-medium text-slate-900">{otherNode?.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-slate-900">{otherNode?.name}</span>{' '}
                                    <span className="text-slate-400">{label}</span>
                                  </>
                                )}
                              </div>
                              {edge.description && (
                                <div className="text-xs text-slate-500 mt-1">{edge.description}</div>
                              )}
                            </div>
                            <div className="flex gap-0.5 mt-1 shrink-0">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <div
                                  key={n}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    n <= edge.significance ? 'bg-amber-400' : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${tierBadge.bg} ${tierBadge.text}`}>
                              {tierBadge.label}
                            </span>
                            {edge.amount && (
                              <span className="text-xs text-emerald-600">${edge.amount.toLocaleString()}</span>
                            )}
                            {edge.startDate && (
                              <span className="text-xs text-slate-400">
                                {new Date(edge.startDate).getFullYear()}
                                {edge.endDate ? ` - ${new Date(edge.endDate).getFullYear()}` : ' - present'}
                              </span>
                            )}
                          </div>

                          {edge.evidence && edge.evidence.length > 0 && (
                            <div className="space-y-1">
                              {edge.evidence.slice(0, 3).map((ev) => (
                                <div key={ev.id} className="flex items-start gap-1.5">
                                  <span className="text-slate-400 text-xs mt-0.5">src</span>
                                  {ev.sourceUrl ? (
                                    <a
                                      href={ev.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-500 truncate"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {ev.title}
                                    </a>
                                  ) : (
                                    <span className="text-xs text-slate-500 truncate">{ev.title}</span>
                                  )}
                                </div>
                              ))}
                              {edge.evidence.length > 3 && (
                                <div className="text-xs text-slate-400">+{edge.evidence.length - 3} more</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
