// Sync SVG generators for "structured" elements (tables, charts). Same idea as
// math: render to a self-contained SVG, embed as a canvas image — crisp, and it
// exports with everything else. The scene only stores the structured data.

import type { ChartElement, TableElement } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

// Muted, print-friendly categorical palette (engineering/figure tones, not the
// usual saturated dashboard colours).
const PALETTE = [
  "#3d5a80", "#b5654d", "#6b8f71", "#b98a46", "#7d6b8f",
  "#5a8a8c", "#a8574a", "#8a7d5a", "#4f7a6a", "#9a6b6b",
];

export function tableToSvg(el: TableElement): string {
  const { width, height, rows, cols, cells, headerRow } = el;
  const cw = width / cols;
  const rh = height / rows;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  if (headerRow) {
    parts.push(`<rect x="0" y="0" width="${width}" height="${rh}" fill="${el.headerFill}"/>`);
  }

  // Grid lines
  for (let c = 0; c <= cols; c++) {
    const x = c * cw;
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${el.borderColor}" stroke-width="1"/>`,
    );
  }
  for (let r = 0; r <= rows; r++) {
    const y = r * rh;
    parts.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${el.borderColor}" stroke-width="1"/>`,
    );
  }

  // Cell text
  const fs = Math.min(16, rh * 0.5);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const txt = cells[r]?.[c] ?? "";
      if (!txt) continue;
      const cx = c * cw + 8;
      const cy = r * rh + rh / 2 + fs / 3;
      const bold = headerRow && r === 0 ? ' font-weight="600"' : "";
      parts.push(
        `<text x="${cx}" y="${cy}" font-family="${FONT}" font-size="${fs}"${bold} fill="${el.textColor}">${esc(txt)}</text>`,
      );
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

export function chartToSvg(el: ChartElement): string {
  const { width, height, chartType, title, data } = el;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  const padTop = title ? 34 : 16;
  if (title) {
    parts.push(
      `<text x="${width / 2}" y="22" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="600" fill="#111">${esc(title)}</text>`,
    );
  }

  if (chartType === "pie") {
    const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
    const cx = width / 2;
    const cy = padTop + (height - padTop) / 2;
    const r = Math.min(width, height - padTop) / 2 - 24;
    let angle = -Math.PI / 2;
    data.forEach((d, i) => {
      const frac = Math.max(0, d.value) / total;
      const next = angle + frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(next);
      const y2 = cy + r * Math.sin(next);
      const large = frac > 0.5 ? 1 : 0;
      const color = PALETTE[i % PALETTE.length];
      parts.push(
        `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}"/>`,
      );
      // Label
      const mid = (angle + next) / 2;
      const lx = cx + (r + 14) * Math.cos(mid);
      const ly = cy + (r + 14) * Math.sin(mid);
      parts.push(
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#333">${esc(d.label)}</text>`,
      );
      angle = next;
    });
    parts.push("</svg>");
    return parts.join("");
  }

  // Bar / line share an axis frame.
  const padLeft = 40;
  const padBottom = 34;
  const padRight = 16;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x0 = padLeft;
  const y0 = padTop + plotH;

  // Axes
  parts.push(`<line x1="${x0}" y1="${padTop}" x2="${x0}" y2="${y0}" stroke="#999" stroke-width="1"/>`);
  parts.push(`<line x1="${x0}" y1="${y0}" x2="${x0 + plotW}" y2="${y0}" stroke="#999" stroke-width="1"/>`);
  // Y gridlines (0, mid, max)
  [0, 0.5, 1].forEach((f) => {
    const y = y0 - f * plotH;
    parts.push(`<line x1="${x0}" y1="${y}" x2="${x0 + plotW}" y2="${y}" stroke="#eee" stroke-width="1"/>`);
    parts.push(
      `<text x="${x0 - 6}" y="${y + 4}" text-anchor="end" font-family="${FONT}" font-size="10" fill="#888">${Math.round(f * max)}</text>`,
    );
  });

  const n = data.length || 1;
  const slot = plotW / n;

  if (chartType === "bar") {
    data.forEach((d, i) => {
      const bh = (Math.max(0, d.value) / max) * plotH;
      const bw = slot * 0.6;
      const bx = x0 + i * slot + (slot - bw) / 2;
      const by = y0 - bh;
      parts.push(
        `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${PALETTE[i % PALETTE.length]}"/>`,
      );
      parts.push(
        `<text x="${(bx + bw / 2).toFixed(1)}" y="${y0 + 14}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#555">${esc(d.label)}</text>`,
      );
    });
  } else {
    // line / area / scatter — all plot value against index
    const pts = data.map((d, i) => {
      const px = x0 + i * slot + slot / 2;
      const py = y0 - (Math.max(0, d.value) / max) * plotH;
      return [px, py] as const;
    });
    const poly = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    if (chartType === "area") {
      const first = pts[0], last = pts[pts.length - 1];
      parts.push(`<path d="M${first[0].toFixed(1)},${y0} L${poly.split(" ").join(" L")} L${last[0].toFixed(1)},${y0} Z" fill="${PALETTE[0]}" fill-opacity="0.25"/>`);
    }
    if (chartType === "line" || chartType === "area") {
      parts.push(`<polyline points="${poly}" fill="none" stroke="${PALETTE[0]}" stroke-width="2"/>`);
    }
    pts.forEach(([px, py], i) => {
      const r = chartType === "scatter" ? 4 : 3;
      parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${PALETTE[chartType === "scatter" ? i % PALETTE.length : 0]}"/>`);
      parts.push(
        `<text x="${px.toFixed(1)}" y="${y0 + 14}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#555">${esc(data[i].label)}</text>`,
      );
    });
  }

  parts.push("</svg>");
  return parts.join("");
}
