// A starter stencil library: monochrome engineering line-art. Each stencil is an
// SVG that gets inserted as an `image` element (a data URI), so it's movable,
// resizable, and exports like anything else. Grouped by discipline.

export interface Stencil {
  id: string;
  label: string;
  category: string;
  svg: string;
  w: number;
  h: number;
}

// Shared wrapper: 100×100 viewBox, ink stroke, no fill unless specified.
const S = (inner: string, vb = 100) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const label = (t: string) =>
  `<text x="50" y="55" font-family="system-ui, sans-serif" font-size="16" fill="#1f2937" stroke="none" text-anchor="middle">${t}</text>`;

export const STENCILS: Stencil[] = [
  // ---- System architecture ----
  { id: "server", label: "Server", category: "Architecture", w: 90, h: 90,
    svg: S(`<rect x="26" y="14" width="48" height="72" rx="4"/><line x1="26" y1="38" x2="74" y2="38"/><line x1="26" y1="62" x2="74" y2="62"/><circle cx="36" cy="26" r="2.5" fill="#1f2937"/><circle cx="36" cy="50" r="2.5" fill="#1f2937"/><circle cx="36" cy="74" r="2.5" fill="#1f2937"/>`) },
  { id: "database", label: "Database", category: "Architecture", w: 84, h: 90,
    svg: S(`<ellipse cx="50" cy="24" rx="30" ry="12"/><path d="M20 24 V76 a30 12 0 0 0 60 0 V24"/><path d="M20 50 a30 12 0 0 0 60 0"/>`) },
  { id: "cloud", label: "Cloud", category: "Architecture", w: 100, h: 72,
    svg: S(`<path d="M30 74 a20 20 0 0 1 2 -40 a26 26 0 0 1 48 6 a16 16 0 0 1 -4 34 Z"/>`) },
  { id: "client", label: "Client", category: "Architecture", w: 96, h: 84,
    svg: S(`<rect x="18" y="18" width="64" height="44" rx="4"/><line x1="40" y1="74" x2="60" y2="74"/><line x1="50" y1="62" x2="50" y2="74"/>`) },
  { id: "loadbalancer", label: "Load balancer", category: "Architecture", w: 96, h: 90,
    svg: S(`<circle cx="50" cy="50" r="34"/><path d="M50 30 v40 M32 44 l18 -14 l18 14"/>`) },
  { id: "queue", label: "Queue", category: "Architecture", w: 96, h: 72,
    svg: S(`<rect x="16" y="34" width="68" height="32" rx="3"/><line x1="34" y1="34" x2="34" y2="66"/><line x1="50" y1="34" x2="50" y2="66"/><line x1="66" y1="34" x2="66" y2="66"/><path d="M16 24 h74" stroke-dasharray="4 5"/>`) },
  { id: "cache", label: "Cache", category: "Architecture", w: 84, h: 84,
    svg: S(`<rect x="20" y="20" width="60" height="60" rx="6"/><path d="M52 32 L40 54 h12 l-4 16 l16 -24 h-12 z" fill="#1f2937" stroke="none"/>`) },
  { id: "service", label: "Service", category: "Architecture", w: 96, h: 90,
    svg: S(`<path d="M50 16 l30 17 v34 l-30 17 l-30 -17 v-34 z"/>`) },

  // ---- Circuit ----
  { id: "resistor", label: "Resistor", category: "Circuit", w: 120, h: 40,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20 h22 l6 -12 l10 24 l10 -24 l10 24 l6 -12 h20"/></svg>` },
  { id: "capacitor", label: "Capacitor", category: "Circuit", w: 100, h: 48,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 48" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"><path d="M8 24 h34 M58 24 h34 M42 8 v32 M58 8 v32"/></svg>` },
  { id: "battery", label: "Battery", category: "Circuit", w: 100, h: 48,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 48" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"><path d="M8 24 h30 M62 24 h30 M38 10 v28 M50 16 v16 M50 24 h0"/><path d="M50 16 v16 M62 10 v28" /></svg>` },
  { id: "ground", label: "Ground", category: "Circuit", w: 64, h: 64,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"><path d="M32 8 v24 M16 32 h32 M22 42 h20 M27 52 h10"/></svg>` },

  // ---- Blueprint ----
  { id: "door", label: "Door", category: "Blueprint", w: 80, h: 80,
    svg: S(`<path d="M20 78 V20 h6"/><path d="M26 20 a52 52 0 0 1 52 52" stroke-dasharray="3 4"/><line x1="26" y1="20" x2="26" y2="72"/>`) },
  { id: "window", label: "Window", category: "Blueprint", w: 100, h: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 32" fill="none" stroke="#1f2937" stroke-width="3"><rect x="6" y="10" width="88" height="12"/><line x1="50" y1="10" x2="50" y2="22"/></svg>` },
  { id: "column", label: "Column", category: "Blueprint", w: 56, h: 56,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none" stroke="#1f2937" stroke-width="4"><rect x="12" y="12" width="32" height="32"/><line x1="12" y1="12" x2="44" y2="44"/><line x1="44" y1="12" x2="12" y2="44"/></svg>` },
];

export const STENCIL_CATEGORIES = [...new Set(STENCILS.map((s) => s.category))];

export function stencilDataUrl(s: Stencil): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s.svg);
}
