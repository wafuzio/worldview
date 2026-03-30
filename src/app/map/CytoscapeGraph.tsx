'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular, EventObject } from 'cytoscape';
// @ts-expect-error — no types for cose-bilkent
import coseBilkent from 'cytoscape-cose-bilkent';
import { getNodeImage, getNodeBorderColor } from './node-images';

if (typeof window !== 'undefined') {
  try { cytoscape.use(coseBilkent); } catch { /* already registered */ }
}

// ── Types ──

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  description: string | null;
  title: string | null;
  affiliation: string | null;
  tags: string[];
  connectionCount: number;
  imageUrl?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  tier: string;
  relationshipType: string;
  significance: number;
  description: string | null;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  evidence: { id: string; title: string; sourceUrl: string | null; excerpt: string | null }[];
}

interface CytoscapeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerId?: string | null;
  onNodeSelect: (node: GraphNode | null) => void;
  onNodeExpand: (nodeId: string) => void;
}

const REL_LABELS: Record<string, string> = {
  funded_by: 'funded by', appointed_by: 'appointed by', employed_by: 'employed by',
  voted_for: 'voted for', donated_to: 'donated to', contracted_with: 'contracted with',
  endorsed: 'endorsed', met_with: 'met with', communicated_with: 'comm. with',
  testified_before: 'testified before', lobbied: 'lobbied', briefed_by: 'briefed by',
  served_on_board_with: 'board with', influenced_by: 'influenced by',
  aligned_with: 'aligned with', protected_by: 'protected by', enabled: 'enabled',
  shielded_from_investigation: 'shielded', authored: 'authored', founded: 'founded',
  member_of: 'member of', ruled_on: 'ruled on', inferred_affiliation: 'likely affiliated with',
  inferred_same_entity: 'likely same entity as',
  indirect_connection: 'indirect connection',
  placeholder_link: 'possible link (to verify)',
};

// Edge color by tier
const TIER_EDGE_COLORS: Record<string, string> = {
  documented: '#64748b',
  interactional: '#f59e0b',
  analytical: '#ef4444',
};

export default function CytoscapeGraph({
  nodes, edges, centerId, onNodeSelect, onNodeExpand,
}: CytoscapeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Edge popup state
  const [edgePopup, setEdgePopup] = useState<{
    edge: GraphEdge;
    x: number;
    y: number;
  } | null>(null);

  const buildElements = useCallback(() => {
    const nodeIds = new Set(nodes.map((n) => n.id));

    const cyNodes = nodes.map((n) => ({
      data: {
        id: n.id,
        label: n.name,
        type: n.type,
        description: n.description,
        title: n.title,
        affiliation: n.affiliation,
        tags: n.tags,
        connectionCount: n.connectionCount,
        image: getNodeImage(n.type, n.imageUrl),
        borderColor: getNodeBorderColor(n.type),
        nodeSize: Math.max(52, Math.min(88, 44 + n.connectionCount * 4)),
      },
    }));

    let skippedEdgeCount = 0;
    const cyEdges = edges
      .filter((e) => {
        const valid = nodeIds.has(e.source) && nodeIds.has(e.target);
        if (!valid) skippedEdgeCount += 1;
        return valid;
      })
      .map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: REL_LABELS[e.relationshipType] || e.relationshipType.replace(/_/g, ' '),
          tier: e.tier,
          relationshipType: e.relationshipType,
          significance: e.significance,
          description: e.description,
          amount: e.amount,
          edgeColor: TIER_EDGE_COLORS[e.tier] || '#94a3b8',
          edgeWidth: Math.max(1, e.significance * 0.7),
          lineStyle: e.tier === 'analytical' ? 'dotted' : e.tier === 'interactional' ? 'dashed' : 'solid',
          evidence: e.evidence,
          // Store full edge data for popup
          _fullEdge: JSON.stringify(e),
        },
      }));

    if (skippedEdgeCount > 0) {
      console.warn(`[CytoscapeGraph] skipped ${skippedEdgeCount} edges with missing endpoint nodes`);
    }

    return [...cyNodes, ...cyEdges];
  }, [nodes, edges]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;
    let centerFocusTimeout: number | null = null;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(),
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      selectionType: 'single',
      minZoom: 0.12,
      maxZoom: 3,

      style: [
        // ── Nodes — clean white with colored ring ──
        {
          selector: 'node',
          style: {
            'width': 'data(nodeSize)',
            'height': 'data(nodeSize)',
            'background-image': 'data(image)',
            'background-fit': 'cover',
            'background-color': '#f8fafc',
            'border-width': 3,
            'border-color': 'data(borderColor)',
            'border-opacity': 1,
            'label': 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
            'font-size': 10,
            'font-family': 'Inter, system-ui, sans-serif',
            'color': '#334155',
            'text-outline-color': '#ffffff',
            'text-outline-width': 2,
            'text-max-width': '90px',
            'text-wrap': 'wrap',
            'overlay-opacity': 0,
            'shadow-blur': 8,
            'shadow-color': '#00000012',
            'shadow-offset-x': 0,
            'shadow-offset-y': 2,
            'shadow-opacity': 1,
            'transition-property': 'border-width, opacity, width, height',
            'transition-duration': 250,
          } as any,
        },

        {
          selector: 'node.focused',
          style: {
            'border-width': 5,
            'shadow-blur': 16,
            'shadow-color': '#00000020',
            'font-size': 12,
            'font-weight': 700,
            'color': '#0f172a',
            'z-index': 10,
          } as any,
        },

        {
          selector: 'node.neighbor',
          style: {
            'opacity': 1,
            'border-width': 3,
          } as cytoscape.Css.Node,
        },

        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.15,
          } as cytoscape.Css.Node,
        },

        // ── Edges — color by tier ──
        {
          selector: 'edge',
          style: {
            'width': 'data(edgeWidth)',
            'line-color': 'data(edgeColor)',
            'line-style': 'data(lineStyle)' as any,
            'line-opacity': 0.5,
            'target-arrow-color': 'data(edgeColor)',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
            'label': '',
            'font-size': 8,
            'font-family': 'Inter, system-ui, sans-serif',
            'color': '#64748b',
            'text-outline-color': '#ffffff',
            'text-outline-width': 2,
            'text-rotation': 'autorotate',
            'overlay-opacity': 0,
            'transition-property': 'line-opacity, opacity',
            'transition-duration': 250,
          } as any,
        },

        {
          selector: 'edge.highlighted',
          style: {
            'line-opacity': 0.9,
            'width': 2.5,
            'label': 'data(label)',
            'z-index': 10,
          } as any,
        },

        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.06,
          } as cytoscape.Css.Edge,
        },
      ],

      layout: {
        name: 'cose-bilkent',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: 140,
        nodeRepulsion: 8000,
        edgeElasticity: 0.15,
        gravity: 0.2,
        gravityRange: 2.0,
        tile: true,
        fit: true,
        padding: 60,
      } as any,
    });

    cyRef.current = cy;

    // ── Node tap ──
    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target as NodeSingular;
      const d = node.data();
      setEdgePopup(null); // close any edge popup

      onNodeSelect({
        id: d.id, name: d.label, type: d.type,
        description: d.description, title: d.title,
        affiliation: d.affiliation, tags: d.tags || [],
        connectionCount: d.connectionCount,
      });

      highlightNeighborhood(cy, node);

      // Ensure recenter happens on normal click/tap, not only dbltap.
      if (d.id && d.id !== centerId) {
        onNodeExpand(d.id);
      }
    });

    // ── Node double-tap → expand ──
    cy.on('dbltap', 'node', (evt: EventObject) => {
      onNodeExpand(evt.target.data('id'));
    });

    // ── Edge tap → show evidence popup ──
    cy.on('tap', 'edge', (evt: EventObject) => {
      const edge = evt.target as EdgeSingular;
      const fullEdge: GraphEdge = JSON.parse(edge.data('_fullEdge'));
      const renderedPos = edge.midpoint();
      const pan = cy.pan();
      const zoom = cy.zoom();

      // Convert graph coords to screen coords
      const screenX = renderedPos.x * zoom + pan.x;
      const screenY = renderedPos.y * zoom + pan.y;

      setEdgePopup({ edge: fullEdge, x: screenX, y: screenY });
    });

    // ── Canvas tap → clear ──
    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        clearHighlights(cy);
        onNodeSelect(null);
        setEdgePopup(null);
      }
    });

    // Center on focus node after layout
    if (centerId) {
      let focused = false;
      const focusCenterNode = () => {
        if (focused) return;
        const centerNode = cy.getElementById(centerId);
        if (centerNode.length === 0) return;

        focused = true;
        const center = centerNode as NodeSingular;
        refocusOnNode(cy, center);

        const d = center.data();
        onNodeSelect({
          id: d.id, name: d.label, type: d.type,
          description: d.description, title: d.title,
          affiliation: d.affiliation, tags: d.tags || [],
          connectionCount: d.connectionCount,
        });
      };

      // Primary path
      cy.one('layoutstop', focusCenterNode);
      // Fallback path for cases where layoutstop may have already fired
      centerFocusTimeout = window.setTimeout(focusCenterNode, 250);
    }

    return () => {
      if (centerFocusTimeout) window.clearTimeout(centerFocusTimeout);
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, centerId, buildElements, onNodeSelect, onNodeExpand]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-white" />

      {/* ── Edge evidence popup ── */}
      {edgePopup && (
        <div
          className="absolute z-50 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
          style={{ left: Math.min(edgePopup.x, (containerRef.current?.clientWidth || 800) - 340), top: edgePopup.y + 10 }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-800">
                {REL_LABELS[edgePopup.edge.relationshipType] || edgePopup.edge.relationshipType.replace(/_/g, ' ')}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {nodes.find(n => n.id === edgePopup.edge.source)?.name}
                {' \u2192 '}
                {nodes.find(n => n.id === edgePopup.edge.target)?.name}
              </div>
            </div>
            <button onClick={() => setEdgePopup(null)} className="text-slate-400 hover:text-slate-600 text-sm ml-2">x</button>
          </div>

          {/* Description */}
          {edgePopup.edge.description && (
            <div className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
              {edgePopup.edge.description}
            </div>
          )}

          {/* Meta row */}
          <div className="px-4 py-2 flex items-center gap-2 flex-wrap border-b border-slate-100 text-xs">
            <span className={`px-2 py-0.5 rounded-full ${
              edgePopup.edge.tier === 'documented' ? 'bg-slate-100 text-slate-600' :
              edgePopup.edge.tier === 'interactional' ? 'bg-amber-50 text-amber-700' :
              'bg-red-50 text-red-600'
            }`}>
              {edgePopup.edge.tier}
            </span>
            <span className="text-slate-400">sig {edgePopup.edge.significance}/5</span>
            {edgePopup.edge.amount && (
              <span className="text-emerald-600 font-medium">${edgePopup.edge.amount.toLocaleString()}</span>
            )}
            {edgePopup.edge.startDate && (
              <span className="text-slate-400">
                {new Date(edgePopup.edge.startDate).getFullYear()}
                {edgePopup.edge.endDate ? `-${new Date(edgePopup.edge.endDate).getFullYear()}` : '-present'}
              </span>
            )}
          </div>

          {/* Evidence / Sources */}
          {edgePopup.edge.evidence.length > 0 ? (
            <div className="px-4 py-3 space-y-2">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sources</div>
              {edgePopup.edge.evidence.map((ev) => (
                <div key={ev.id} className="group">
                  {ev.sourceUrl ? (
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline block"
                    >
                      {ev.title}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-600">{ev.title}</span>
                  )}
                  {ev.excerpt && (
                    <p className="text-xs text-slate-400 mt-0.5 italic">{ev.excerpt}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 italic">No sources linked yet</div>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 text-xs space-y-2 pointer-events-none shadow-sm">
        <div className="text-slate-500 font-medium mb-1">Node Types</div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Politician', color: '#3b82f6' },
            { label: 'Party', color: '#8b5cf6' },
            { label: 'Lobbyist', color: '#f59e0b' },
            { label: 'PAC', color: '#10b981' },
            { label: 'Corporation', color: '#ef4444' },
            { label: 'Media', color: '#ec4899' },
            { label: 'Organization', color: '#06b6d4' },
            { label: 'Legislation', color: '#0f766e' },
            { label: 'Event', color: '#ea580c' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 bg-white" style={{ borderColor: item.color }} />
              <span className="text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="text-slate-500 font-medium mt-2 mb-1">Connections</div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#64748b" strokeWidth="2" /></svg>
            <span className="text-slate-500">Documented</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" /></svg>
            <span className="text-slate-500">Interactional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="#ef4444" strokeWidth="2" strokeDasharray="1,3" /></svg>
            <span className="text-slate-500">Analytical</span>
          </div>
        </div>
        <div className="text-slate-400 mt-1">Click node to inspect + re-center  |  Click edge for evidence  |  Double-click also re-centers</div>
      </div>
    </div>
  );
}

function highlightNeighborhood(cy: Core, node: NodeSingular) {
  clearHighlights(cy);
  const connectedEdges = node.connectedEdges();
  const neighborhood = node.neighborhood();

  cy.elements().addClass('dimmed');
  node.removeClass('dimmed').addClass('focused');
  neighborhood.nodes().removeClass('dimmed').addClass('neighbor');
  connectedEdges.removeClass('dimmed').addClass('highlighted');
}

function clearHighlights(cy: Core) {
  cy.elements().removeClass('dimmed focused neighbor highlighted');
}

function refocusOnNode(cy: Core, node: NodeSingular) {
  highlightNeighborhood(cy, node);

  const neighborhood = node.neighborhood().add(node);

  neighborhood.layout({
    name: 'concentric',
    animate: true,
    animationDuration: 500,
    fit: false,
    concentric: (n: any) => (n.id() === node.id() ? 10 : 1),
    levelWidth: () => 1,
    minNodeSpacing: 60,
    startAngle: (3 / 2) * Math.PI,
    boundingBox: {
      x1: (node.position('x') as number) - 300,
      y1: (node.position('y') as number) - 300,
      w: 600,
      h: 600,
    },
  } as any).run();

  setTimeout(() => {
    cy.animate({
      center: { eles: node },
      zoom: 1.2,
    } as any, {
      duration: 400,
      easing: 'ease-in-out-cubic' as any,
    });
  }, 80);
}
