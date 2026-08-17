// A small, dependency-free math-expression engine for the function grapher, plus
// an SVG renderer. It EVALUATES y = f(x) to plot a curve (it is not a LaTeX
// display — that's the ∑ math tool). It accepts LaTeX-style input (\pi, \sqrt{},
// \frac{}{}, |x|, \cdot, implicit 2x), the usual functions/constants, and numeric
// derivative/integral operators. No eval() — a recursive-descent parser compiles
// an expression to a (x)=>number closure once.

import type { GraphElement } from "./types";

type Fn = (x: number) => number;

const FUNCS: Record<string, (n: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sec: (n) => 1 / Math.cos(n), csc: (n) => 1 / Math.sin(n), cot: (n) => 1 / Math.tan(n),
  exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sign: Math.sign,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  ln: Math.log, log: Math.log10, lg: Math.log10, log10: Math.log10, log2: Math.log2,
};

const CONSTS: Record<string, number> = {
  pi: Math.PI, PI: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2,
};

const DH = 1e-4; // step for the numeric derivative

// Numeric definite integral ∫[a..b] g via Simpson's rule.
function integrate(g: Fn, a: number, b: number): number {
  if (a === b) return 0;
  let n = Math.min(400, Math.max(20, Math.ceil(Math.abs(b - a) * 20)));
  if (n % 2) n++;
  const h = (b - a) / n;
  let sum = g(a) + g(b);
  for (let k = 1; k < n; k++) sum += (k % 2 ? 4 : 2) * g(a + k * h);
  return (sum * h) / 3;
}

// Read a balanced {..} or [..] group starting (after optional spaces) at `pos`.
function readGroup(s: string, pos: number, open: string, close: string): { content: string; end: number } | null {
  while (pos < s.length && /\s/.test(s[pos])) pos++;
  if (s[pos] !== open) return null;
  let depth = 0;
  for (let i = pos; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) { depth--; if (depth === 0) return { content: s.slice(pos + 1, i), end: i + 1 }; }
  }
  return null;
}

function convertCmd(s: string, cmd: string, build: (a: string, b?: string) => string, twoArgs: boolean): string {
  let out = s, guard = 0;
  while (guard++ < 200) {
    const i = out.indexOf("\\" + cmd);
    if (i < 0) break;
    let pos = i + cmd.length + 1;
    const opt = cmd === "sqrt" ? readGroup(out, pos, "[", "]") : null;
    if (opt) pos = opt.end;
    const g1 = readGroup(out, pos, "{", "}");
    if (!g1) break;
    let repl: string;
    if (twoArgs) {
      const g2 = readGroup(out, g1.end, "{", "}");
      if (!g2) break;
      repl = build(g1.content, g2.content);
      out = out.slice(0, i) + repl + out.slice(g2.end);
    } else {
      repl = opt ? `((${g1.content})^(1/(${opt.content})))` : build(g1.content);
      out = out.slice(0, i) + repl + out.slice(g1.end);
    }
  }
  return out;
}

// LaTeX / unicode → plain infix that the parser understands.
export function normalize(src: string): string {
  let s = src;
  s = s.replace(/[−–—]/g, "-").replace(/×/g, "*").replace(/·/g, "*").replace(/÷/g, "/")
    .replace(/√/g, "sqrt").replace(/π/g, "pi").replace(/τ/g, "tau").replace(/φ/g, "phi").replace(/∞/g, "Infinity");
  // derivative shorthands — before \frac handling
  s = s.replace(/\\frac\s*\{\s*d\s*\}\s*\{\s*d[a-zA-Z]?\s*\}/g, "deriv").replace(/\bd\s*\/\s*d[a-zA-Z]/g, "deriv");
  s = s.replace(/\\left/g, "").replace(/\\right/g, "");
  s = convertCmd(s, "frac", (a, b) => `((${a})/(${b}))`, true);
  s = convertCmd(s, "sqrt", (a) => `sqrt(${a})`, false);
  s = s.replace(/\\cdot/g, "*").replace(/\\times/g, "*").replace(/\\div/g, "/").replace(/\\pm/g, "+");
  s = s.replace(/\\operatorname\s*/g, "").replace(/\\([a-zA-Z]+)/g, "$1"); // \sin → sin, \pi → pi
  s = s.replace(/_/g, "").replace(/\{/g, "(").replace(/\}/g, ")");
  // |expr| → abs(expr) (non-nested); handles |x|, 2|x|, |a|+|b|.
  s = s.replace(/\|([^|]+)\|/g, "abs($1)");
  return s;
}

export function compile(src: string): Fn {
  const s = normalize(src).replace(/\s+/g, "");
  let i = 0;
  const peek = () => s[i];
  const startsFactor = (c: string | undefined) => c !== undefined && /[0-9.a-zA-Z(]/.test(c);

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
    for (;;) {
      const c = peek();
      if (c === "*" || c === "/") {
        i++;
        const g = parseUnary();
        const a = f;
        f = c === "*" ? (x) => a(x) * g(x) : (x) => a(x) / g(x);
      } else if (startsFactor(c)) {
        // implicit multiplication: 2x, 2pi, 3sin(x), x(x+1), 2|x|
        const g = parseUnary();
        const a = f;
        f = (x) => a(x) * g(x);
      } else break;
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
    if (peek() === "|") { // |expr| absolute value
      i++;
      const inner = parseExpr();
      if (peek() === "|") i++; else throw new Error("missing closing '|'");
      return (x) => Math.abs(inner(x));
    }
    if (/[0-9.]/.test(peek() ?? "")) {
      const j = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
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
      if (name === "Infinity") return () => Infinity;
      if (name in CONSTS && peek() !== "(") { const c = CONSTS[name]; return () => c; }
      if (peek() === "(") {
        i++;
        const args = [parseExpr()];
        while (peek() === ",") { i++; args.push(parseExpr()); }
        if (peek() === ")") i++; else throw new Error("missing ')'");
        if (name === "deriv" || name === "derivative") { const g = args[0]; return (x) => (g(x + DH) - g(x - DH)) / (2 * DH); }
        if (name === "int" || name === "integral") { const g = args[0], lo = args[1]; return (x) => integrate(g, lo ? lo(x) : 0, x); }
        const fn = FUNCS[name];
        if (fn) { const g = args[0]; return (x) => fn(g(x)); }
        throw new Error(`unknown function '${name}'`);
      }
      throw new Error(`unknown name '${name}'`);
    }
    throw new Error(`unexpected '${peek() ?? "end"}'`);
  }

  const f = parseExpr();
  if (i < s.length) throw new Error(`unexpected '${s.slice(i)}'`);
  return f;
}

// Auto-fit a y-range to the functions over [xMin,xMax], using robust percentiles
// so asymptotes don't blow up the scale. This is what makes big domains (e.g.
// -100..100) render at a sensible, "medium-looking" scale.
export function autoRange(funcs: { expr: string }[], xMin: number, xMax: number): [number, number] {
  const ys: number[] = [];
  for (const fdef of funcs) {
    let fn: Fn;
    try { fn = compile(fdef.expr); } catch { continue; }
    const N = 240;
    for (let k = 0; k <= N; k++) {
      const y = fn(xMin + ((xMax - xMin) * k) / N);
      if (Number.isFinite(y)) ys.push(y);
    }
  }
  if (ys.length === 0) return [-10, 10];
  ys.sort((a, b) => a - b);
  const q = (p: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))];
  let lo = q(0.02), hi = q(0.98);
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const FONT = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

// Render the graph to a self-contained SVG (same embed pattern as math/table/chart).
export function graphToSvg(el: GraphElement): string {
  const { width: W, height: H, xMin, xMax } = el;
  // Adaptive y-scale by default, so any x-domain renders at a readable scale.
  const [yMin, yMax] = (el.autoY ?? true) ? autoRange(el.funcs, xMin, xMax) : [el.yMin, el.yMax];
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
