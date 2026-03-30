'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

// ── Types ──

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: string; // politician, party, lobbyist, pac, corporation, media_figure, organization
  description: string | null;
  title: string | null;
  affiliation: string | null;
  tags: string[];
  connectionCount: number;
}

export interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  tier: string; // documented, interactional, analytical
  relationshipType: string;
  significance: number;
  description: string | null;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  evidence: { id: string; title: string; sourceUrl: string | null; excerpt: string | null }[];
}

interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerId?: string | null;
  onNodeClick: (node: GraphNode) => void;
  onNodeExpand: (nodeId: string) => void;
  width: number;
  height: number;
}

// ── Color map for node types ──
const NODE_COLORS: Record<string, string> = {
  politician: '#3b82f6',    // blue
  party: '#8b5cf6',         // purple
  lobbyist: '#f59e0b',      // amber
  pac: '#10b981',           // emerald
  corporation: '#ef4444',   // red
  media_figure: '#ec4899',  // pink
  organization: '#06b6d4',  // cyan
};

// ── Edge styles by tier ──
const TIER_DASH: Record<string, string> = {
  documented: '0',            // solid
  interactional: '6,3',       // dashed
  analytical: '2,3',          // dotted
};

const TIER_OPACITY: Record<string, number> = {
  documented: 0.8,
  interactional: 0.5,
  analytical: 0.3,
};

// ── Relationship type labels ──
const REL_LABELS: Record<string, string> = {
  funded_by: 'funded by',
  appointed_by: 'appointed by',
  employed_by: 'employed by',
  voted_for: 'voted for',
  donated_to: 'donated to',
  contracted_with: 'contracted with',
  endorsed: 'endorsed',
  met_with: 'met with',
  communicated_with: 'communicated with',
  testified_before: 'testified before',
  lobbied: 'lobbied',
  briefed_by: 'briefed by',
  served_on_board_with: 'served on board with',
  influenced_by: 'influenced by',
  aligned_with: 'aligned with',
  protected_by: 'protected by',
  enabled: 'enabled',
  shielded_from_investigation: 'shielded from investigation',
  authored: 'authored',
  founded: 'founded',
  member_of: 'member of',
  ruled_on: 'ruled on',
};

export default function ForceGraph({
  nodes,
  edges,
  centerId,
  onNodeClick,
  onNodeExpand,
  width,
  height,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const getNodeRadius = useCallback((d: GraphNode) => {
    return Math.max(8, Math.min(30, 6 + d.connectionCount * 2.5));
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // ── Defs for arrowheads ──
    const defs = svg.append('defs');

    // One marker per tier
    ['documented', 'interactional', 'analytical'].forEach((tier) => {
      defs
        .append('marker')
        .attr('id', `arrow-${tier}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L10,0L0,4')
        .attr('fill', '#64748b')
        .attr('opacity', TIER_OPACITY[tier] ?? 0.5);
    });

    // ── Container with zoom ──
    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Center initial view
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));

    // ── Force simulation ──
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance((d) => {
            const sig = (d as GraphEdge).significance || 3;
            return 120 - sig * 12; // Higher significance = closer
          })
      )
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(500))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => getNodeRadius(d) + 4))
      .force('x', d3.forceX(0).strength(0.03))
      .force('y', d3.forceY(0).strength(0.03));

    // Pin center node
    if (centerId) {
      const centerNode = nodes.find((n) => n.id === centerId);
      if (centerNode) {
        centerNode.fx = 0;
        centerNode.fy = 0;
      }
    }

    simulationRef.current = simulation;

    // ── Draw edges ──
    const linkGroup = g.append('g').attr('class', 'links');

    const link = linkGroup
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#64748b')
      .attr('stroke-width', (d) => Math.max(1, d.significance * 0.8))
      .attr('stroke-dasharray', (d) => TIER_DASH[d.tier] || '0')
      .attr('stroke-opacity', (d) => TIER_OPACITY[d.tier] || 0.5)
      .attr('marker-end', (d) => `url(#arrow-${d.tier})`);

    // ── Edge hover zones (wider invisible lines for easier hover) ──
    const linkHover = linkGroup
      .selectAll<SVGLineElement, GraphEdge>('line.hover-zone')
      .data(edges)
      .join('line')
      .attr('class', 'hover-zone')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 12)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const tooltip = tooltipRef.current;
        if (!tooltip) return;

        const sourceNode = d.source as GraphNode;
        const targetNode = d.target as GraphNode;
        const label = REL_LABELS[d.relationshipType] || d.relationshipType.replace(/_/g, ' ');

        let html = `<div class="font-medium text-slate-100">${sourceNode.name}</div>`;
        html += `<div class="text-xs text-slate-400 my-1">${label}</div>`;
        html += `<div class="font-medium text-slate-100">${targetNode.name}</div>`;
        if (d.description) {
          html += `<div class="text-xs text-slate-500 mt-1 border-t border-slate-700 pt-1">${d.description}</div>`;
        }
        if (d.amount) {
          html += `<div class="text-xs text-emerald-400 mt-1">$${d.amount.toLocaleString()}</div>`;
        }
        html += `<div class="text-xs mt-1 text-slate-600">${d.tier} · significance ${d.significance}/5</div>`;
        if (d.evidence.length > 0) {
          html += `<div class="text-xs text-slate-600">${d.evidence.length} source${d.evidence.length > 1 ? 's' : ''}</div>`;
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.pageX + 12}px`;
        tooltip.style.top = `${event.pageY - 10}px`;
      })
      .on('mouseleave', () => {
        const tooltip = tooltipRef.current;
        if (tooltip) tooltip.style.display = 'none';
      });

    // ── Draw nodes ──
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const node = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // Keep center node pinned, release others
            if (d.id !== centerId) {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Node circles
    node
      .append('circle')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => {
        if (d.id === centerId) return '#f8fafc'; // white for center
        return NODE_COLORS[d.type] || '#64748b';
      })
      .attr('stroke', (d) => {
        if (d.id === centerId) return '#3b82f6';
        return '#1e293b';
      })
      .attr('stroke-width', (d) => (d.id === centerId ? 3 : 1.5));

    // Node labels
    node
      .append('text')
      .text((d) => d.name)
      .attr('dy', (d) => getNodeRadius(d) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', (d) => (d.id === centerId ? '13px' : '11px'))
      .attr('font-weight', (d) => (d.id === centerId ? '600' : '400'))
      .attr('pointer-events', 'none');

    // Type icon (small text inside node)
    node
      .append('text')
      .text((d) => typeIcon(d.type))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', (d) => (d.id === centerId ? '#1e293b' : '#fff'))
      .attr('font-size', (d) => `${Math.max(9, getNodeRadius(d) * 0.7)}px`)
      .attr('pointer-events', 'none');

    // ── Click handlers ──
    node.on('click', (event, d) => {
      event.stopPropagation();
      onNodeClick(d);
    });

    node.on('dblclick', (event, d) => {
      event.stopPropagation();
      onNodeExpand(d.id);
    });

    // Highlight on hover
    node
      .on('mouseenter', function (_, d) {
        // Highlight connected edges
        link
          .attr('stroke-opacity', (l) => {
            const s = (l.source as GraphNode).id;
            const t = (l.target as GraphNode).id;
            return s === d.id || t === d.id ? 1 : 0.08;
          })
          .attr('stroke', (l) => {
            const s = (l.source as GraphNode).id;
            const t = (l.target as GraphNode).id;
            return s === d.id || t === d.id ? '#94a3b8' : '#64748b';
          });

        // Dim non-connected nodes
        const connectedIds = new Set<string>([d.id]);
        edges.forEach((e) => {
          const s = (e.source as GraphNode).id;
          const t = (e.target as GraphNode).id;
          if (s === d.id) connectedIds.add(t);
          if (t === d.id) connectedIds.add(s);
        });

        node.select('circle').attr('opacity', (n) => (connectedIds.has(n.id) ? 1 : 0.15));
        node.select('text').attr('opacity', (n) => (connectedIds.has(n.id) ? 1 : 0.1));
      })
      .on('mouseleave', function () {
        link
          .attr('stroke-opacity', (d) => TIER_OPACITY[d.tier] || 0.5)
          .attr('stroke', '#64748b');
        node.select('circle').attr('opacity', 1);
        node.select('text').attr('opacity', 1);
      });

    // ── Tick ──
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      linkHover
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, centerId, width, height, onNodeClick, onNodeExpand, getNodeRadius]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-slate-950 rounded-lg"
      />
      <div
        ref={tooltipRef}
        className="fixed z-50 hidden max-w-xs px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 shadow-xl text-sm pointer-events-none"
        style={{ display: 'none' }}
      />
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 rounded-lg px-4 py-3 text-xs space-y-2">
        <div className="text-slate-400 font-medium mb-1">Node Types</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-400 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
        <div className="text-slate-400 font-medium mt-2 mb-1">Edge Tiers</div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#94a3b8" strokeWidth="2" /></svg>
            <span className="text-slate-400">Documented</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,3" /></svg>
            <span className="text-slate-400">Interactional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#94a3b8" strokeWidth="2" strokeDasharray="2,3" /></svg>
            <span className="text-slate-400">Analytical</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case 'politician': return 'P';
    case 'party': return '*';
    case 'lobbyist': return '$';
    case 'pac': return 'C';
    case 'corporation': return 'B';
    case 'media_figure': return 'M';
    case 'organization': return 'O';
    default: return '•';
  }
}
