/**
 * Node type images — clean white theme.
 *
 * Each type gets a light-background SVG with a subtle icon.
 * When the actor has a real imageUrl (portrait/logo), that takes precedence.
 */

function svg(iconColor: string, icon: string): string {
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="49" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
    ${icon}
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(raw)}`;
}

const POLITICIAN = svg('#3b82f6', `
  <g transform="translate(50,46)" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round">
    <circle cx="0" cy="-12" r="10" fill="#e2e8f0"/>
    <path d="M-16,18 Q-16,2 0,2 Q16,2 16,18" fill="#e2e8f0"/>
  </g>
`);

const PARTY = svg('#8b5cf6', `
  <polygon points="50,20 58,38 78,38 62,50 68,68 50,56 32,68 38,50 22,38 42,38"
    fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
`);

const LOBBYIST = svg('#f59e0b', `
  <g transform="translate(50,48)">
    <text x="0" y="6" text-anchor="middle" font-size="32" font-weight="bold" fill="#cbd5e1" font-family="serif">$</text>
  </g>
`);

const PAC = svg('#10b981', `
  <g transform="translate(50,50)">
    <circle cx="0" cy="-2" r="18" fill="none" stroke="#cbd5e1" stroke-width="2"/>
    <text x="0" y="5" text-anchor="middle" font-size="14" font-weight="600" fill="#94a3b8" font-family="sans-serif">PAC</text>
  </g>
`);

const CORPORATION = svg('#ef4444', `
  <g transform="translate(50,50)">
    <rect x="-14" y="-20" width="28" height="36" rx="2" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
    <rect x="-8" y="-14" width="5" height="5" rx="0.5" fill="#cbd5e1"/>
    <rect x="3" y="-14" width="5" height="5" rx="0.5" fill="#cbd5e1"/>
    <rect x="-8" y="-4" width="5" height="5" rx="0.5" fill="#cbd5e1"/>
    <rect x="3" y="-4" width="5" height="5" rx="0.5" fill="#cbd5e1"/>
    <rect x="-4" y="6" width="8" height="10" rx="1" fill="#cbd5e1"/>
  </g>
`);

const MEDIA_FIGURE = svg('#ec4899', `
  <g transform="translate(50,46)">
    <rect x="-16" y="-14" width="32" height="22" rx="3" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
    <circle cx="0" cy="-3" r="6" fill="#cbd5e1"/>
    <line x1="-6" y1="14" x2="6" y2="14" stroke="#cbd5e1" stroke-width="2"/>
    <line x1="0" y1="8" x2="0" y2="14" stroke="#cbd5e1" stroke-width="1.5"/>
  </g>
`);

const ORGANIZATION = svg('#06b6d4', `
  <g transform="translate(50,50)" fill="#cbd5e1" stroke="#cbd5e1" stroke-width="1.5">
    <circle cx="0" cy="-14" r="5"/>
    <circle cx="-14" cy="8" r="5"/>
    <circle cx="14" cy="8" r="5"/>
    <line x1="0" y1="-14" x2="-14" y2="8" opacity="0.5"/>
    <line x1="0" y1="-14" x2="14" y2="8" opacity="0.5"/>
    <line x1="-14" y1="8" x2="14" y2="8" opacity="0.5"/>
  </g>
`);

const COURT_CASE = svg('#64748b', `
  <g transform="translate(50,48)" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" fill="none">
    <rect x="-6" y="-18" width="12" height="16" rx="2" fill="#e2e8f0"/>
    <line x1="-14" y1="4" x2="14" y2="4"/>
    <line x1="-10" y1="10" x2="10" y2="10"/>
  </g>
`);

const LEGISLATION = svg('#0f766e', `
  <g transform="translate(50,50)" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-16,-18 h22 a6,6 0 0 1 6,6 v24 a6,6 0 0 1 -6,6 h-22 z" fill="#e2e8f0"/>
    <line x1="-10" y1="-8" x2="6" y2="-8"/>
    <line x1="-10" y1="-1" x2="8" y2="-1"/>
    <line x1="-10" y1="6" x2="4" y2="6"/>
    <path d="M-16,-18 q-4,2 -4,6 v24 q0,4 4,6" />
  </g>
`);

const EVENT = svg('#ea580c', `
  <g transform="translate(50,50)" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="-18" y="-16" width="36" height="32" rx="4" fill="#e2e8f0"/>
    <line x1="-18" y1="-8" x2="18" y2="-8"/>
    <line x1="-8" y1="-22" x2="-8" y2="-12"/>
    <line x1="8" y1="-22" x2="8" y2="-12"/>
    <circle cx="-6" cy="2" r="2" fill="#cbd5e1"/>
    <circle cx="2" cy="2" r="2" fill="#cbd5e1"/>
    <circle cx="10" cy="2" r="2" fill="#cbd5e1"/>
  </g>
`);

export function getNodeImage(type: string, imageUrl?: string | null): string {
  if (imageUrl) {
    if (/^https?:\/\//i.test(imageUrl)) {
      return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    return imageUrl;
  }
  switch (type) {
    case 'politician': return POLITICIAN;
    case 'party': return PARTY;
    case 'lobbyist': return LOBBYIST;
    case 'pac': return PAC;
    case 'corporation': return CORPORATION;
    case 'media_figure': return MEDIA_FIGURE;
    case 'organization': return ORGANIZATION;
    case 'legislation': return LEGISLATION;
    case 'event': return EVENT;
    default: return COURT_CASE;
  }
}

/** Border color by actor type — used for the ring around the node */
export const NODE_BORDER_COLORS: Record<string, string> = {
  politician: '#3b82f6',
  party: '#8b5cf6',
  lobbyist: '#f59e0b',
  pac: '#10b981',
  corporation: '#ef4444',
  media_figure: '#ec4899',
  organization: '#06b6d4',
  legislation: '#0f766e',
  event: '#ea580c',
};

export function getNodeBorderColor(type: string): string {
  return NODE_BORDER_COLORS[type] || '#94a3b8';
}
