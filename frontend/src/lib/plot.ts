// A small, dependency-free math-expression evaluator for the function grapher,
// plus an SVG renderer. Supports +,-,*,/,^, parentheses, a variable `x`, the
// constants pi/e, and the usual functions. No eval() — a hand-written recursive
// descent parser compiles an expression to a (x)=>number closure once.

import type { GraphElement } from "./types";

type Fn = (x: number) => number;

const FUNCS: Record<string, (n: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs, sign: Math.sign,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
};

export function compile(src: string): Fn {
  const s = src.replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];

  function parseExpr(): Fn {
    let f = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const g = parseTerm();
      const a = f;
      f = op === "+" ? (x) => a(x) + g(x) : (x) => a(x) - g(x);
    }
    return f;
  }
  function parseTerm(): Fn {
    let f = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const g = parseUnary();
      const a = f;
      f = op === "*" ? (x) => a(x) * g(x) : (x) => a(x) / g(x);
    }
    return f;
  }
  function parseUnary(): Fn {
    if (peek() === "-") { i++; const g = parseUnary(); return (x) => -g(x); }
    if (peek() === "+") { i++; return parseUnary(); }
    return parsePower();
  }
  function parsePower(): Fn {
    const base = parsePrimary();
    if (peek() === "^") { i++; const exp = parseUnary(); return (x) => Math.pow(base(x), exp(x)); }
    return base;
  }
  function parsePrimary(): Fn {
    if (peek() === "(") { i++; const f = parseExpr(); if (peek() === ")") i++; return f; }
    if (/[0-9.]/.test(peek() ?? "")) {
      const j = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      // Scientific notation (e.g. 1e9, 2.5e-8) for conveniently large magnitudes.
      if ((s[i] === "e" || s[i] === "E") && /[0-9+-]/.test(s[i + 1] ?? "")) {
        i++;
        if (s[i] === "+" || s[i] === "-") i++;
        while (i < s.length && /[0-9]/.test(s[i])) i++;
      }
      const n = parseFloat(s.slice(j, i));
      return () => n;
    }
    if (/[a-zA-Z]/.test(peek() ?? "")) {
      const j = i;
      while (i < s.length && /[a-zA-Z0-9]/.test(s[i])) i++;
      const name = s.slice(j, i);
      if (name === "x") return (x) => x;
      if (name === "pi" || name === "PI") return () => Math.PI;
      if (name === "e") return () => Math.E;
      const fn = FUNCS[name];
      if (fn) {
        if (peek() !== "(") throw new Error(`expected '(' after ${name}`);
        i++;
        const arg = parseExpr();
        if (peek() === ")") i++;
        return (x) => fn(arg(x));
      }
      throw new Error(`unknown name '${name}'`);
    }
    throw new Error(`unexpected '${peek() ?? "end"}'`);
  }

  const f = parseExpr();
  if (i < s.length) throw new Error(`unexpected '${s.slice(i)}'`);
  return f;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

// Render the graph to a self-contained SVG (same embed pattern as math/table/chart).
export function graphToSvg(el: GraphElement): string {
  const { width: W, height: H, xMin, xMax, yMin, yMax } = el;
  const pad = 26;
  const plotW = W - pad * 2, plotH = H - pad * 2;
  const sx = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => pad + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);

  // Gridlines + tick labels at "nice" steps.
  const step = (span: number) => {
    const raw = span / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
  };
  const gx = step(xMax - xMin), gy = step(yMax - yMin);
  parts.push(`<g stroke="#e6e9ee" stroke-width="1">`);
  for (let x = Math.ceil(xMin / gx) * gx; x <= xMax; x += gx) parts.push(`<line x1="${sx(x).toFixed(1)}" y1="${pad}" x2="${sx(x).toFixed(1)}" y2="${pad + plotH}"/>`);
  for (let y = Math.ceil(yMin / gy) * gy; y <= yMax; y += gy) parts.push(`<line x1="${pad}" y1="${sy(y).toFixed(1)}" x2="${pad + plotW}" y2="${sy(y).toFixed(1)}"/>`);
  parts.push(`</g>`);

  // Axes (drawn at 0 if visible, else at the border).
  const ax = Math.min(Math.max(sx(0), pad), pad + plotW);
  const ay = Math.min(Math.max(sy(0), pad), pad + plotH);
  parts.push(`<g stroke="#9aa2ad" stroke-width="1.2">`);
  parts.push(`<line x1="${pad}" y1="${ay.toFixed(1)}" x2="${pad + plotW}" y2="${ay.toFixed(1)}"/>`);
  parts.push(`<line x1="${ax.toFixed(1)}" y1="${pad}" x2="${ax.toFixed(1)}" y2="${pad + plotH}"/>`);
  parts.push(`</g>`);
  // A couple of numeric labels for scale.
  parts.push(`<g font-family="${FONT}" font-size="10" fill="#7a828d">`);
  parts.push(`<text x="${pad}" y="${(pad + plotH + 14)}">${(+xMin.toFixed(2))}</text>`);
  parts.push(`<text x="${pad + plotW}" y="${(pad + plotH + 14)}" text-anchor="end">${(+xMax.toFixed(2))}</text>`);
  parts.push(`<text x="${pad - 4}" y="${pad + 4}" text-anchor="end">${(+yMax.toFixed(2))}</text>`);
  parts.push(`<text x="${pad - 4}" y="${pad + plotH}" text-anchor="end">${(+yMin.toFixed(2))}</text>`);
  parts.push(`</g>`);

  // Each function as a polyline, breaking at discontinuities / out-of-range.
  const N = Math.max(80, Math.floor(plotW));
  for (const fdef of el.funcs) {
    let fn: Fn;
    try { fn = compile(fdef.expr); } catch { continue; }
    let d = "";
    let pen = false;
    for (let k = 0; k <= N; k++) {
      const x = xMin + ((xMax - xMin) * k) / N;
      let y: number;
      try { y = fn(x); } catch { pen = false; continue; }
      if (!isFinite(y) || y < yMin - (yMax - yMin) || y > yMax + (yMax - yMin)) { pen = false; continue; }
      const px = sx(x).toFixed(1), py = sy(Math.min(Math.max(y, yMin - 5), yMax + 5)).toFixed(1);
      d += `${pen ? "L" : "M"}${px} ${py} `;
      pen = true;
    }
    if (d) parts.push(`<path d="${d}" fill="none" stroke="${fdef.color}" stroke-width="2"/>`);
  }

  // Legend of expressions.
  parts.push(`<g font-family="${FONT}" font-size="11">`);
  el.funcs.forEach((f, idx) => {
    const yy = pad + 6 + idx * 15;
    parts.push(`<rect x="${pad + 6}" y="${yy - 8}" width="10" height="10" fill="${f.color}"/>`);
    parts.push(`<text x="${pad + 20}" y="${yy + 1}" fill="#333">y = ${esc(f.expr)}</text>`);
  });
  parts.push(`</g>`);

  parts.push(`</svg>`);
  return parts.join("");
}
