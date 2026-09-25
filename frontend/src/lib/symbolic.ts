// A small symbolic-calculus engine for the LaTeX calculator: parse an expression
// to an AST, differentiate or integrate it, simplify, and print back to LaTeX.
// Differentiation is complete; integration covers the common cases (polynomials,
// powers incl. 1/x, sums, constant multiples, and standard functions with a
// linear argument) and returns null otherwise — so it never shows a wrong answer.

import { normalize } from "./plot";

export type Node =
  | { t: "num"; v: number }
  | { t: "var"; n: string }
  | { t: "neg"; a: Node }
  | { t: "add"; a: Node; b: Node }
  | { t: "sub"; a: Node; b: Node }
  | { t: "mul"; a: Node; b: Node }
  | { t: "div"; a: Node; b: Node }
  | { t: "pow"; a: Node; b: Node }
  | { t: "call"; f: string; a: Node };

const num = (v: number): Node => ({ t: "num", v });
const vr = (n: string): Node => ({ t: "var", n });
const neg = (a: Node): Node => ({ t: "neg", a });
const add = (a: Node, b: Node): Node => ({ t: "add", a, b });
const sub = (a: Node, b: Node): Node => ({ t: "sub", a, b });
const mul = (a: Node, b: Node): Node => ({ t: "mul", a, b });
const div = (a: Node, b: Node): Node => ({ t: "div", a, b });
const pow = (a: Node, b: Node): Node => ({ t: "pow", a, b });
const call = (f: string, a: Node): Node => ({ t: "call", f, a });

const CONST_VARS = new Set(["e", "pi", "tau", "phi"]);

function hasVar(n: Node, v: string): boolean {
  switch (n.t) {
    case "num": return false;
    case "var": return n.n === v;
    case "neg": return hasVar(n.a, v);
    case "call": return hasVar(n.a, v);
    case "pow": case "add": case "sub": case "mul": case "div":
      return hasVar(n.a, v) || hasVar(n.b, v);
  }
}

// ---------- parser (reuses normalize for LaTeX/unicode) ----------
function parse(src: string): Node | null {
  // Keep single spaces: a space between factors is implicit multiplication
  // (e.g. "k x" = k·x), so we must not merge them into one identifier "kx".
  const s = normalize(src).replace(/\s+/g, " ").trim();
  let i = 0;
  const ws = () => { while (s[i] === " ") i++; };
  const peek = () => { ws(); return s[i]; };
  const startsFactor = (c?: string) => c !== undefined && /[0-9.a-zA-Z(]/.test(c);

  function expr(): Node {
    let n = term();
    while (peek() === "+" || peek() === "-") { const op = s[i++]; const r = term(); n = op === "+" ? add(n, r) : sub(n, r); }
    return n;
  }
  function term(): Node {
    let n = unary();
    for (;;) {
      const c = peek();
      if (c === "*" || c === "/") { i++; const r = unary(); n = c === "*" ? mul(n, r) : div(n, r); }
      else if (startsFactor(c)) n = mul(n, unary());
      else break;
    }
    return n;
  }
  function unary(): Node {
    if (peek() === "-") { i++; return neg(unary()); }
    if (peek() === "+") { i++; return unary(); }
    return power();
  }
  function power(): Node {
    const b = primary();
    if (peek() === "^") { i++; return pow(b, unary()); }
    return b;
  }
  function primary(): Node {
    ws();
    if (peek() === "(") { i++; const n = expr(); if (peek() === ")") i++; return n; }
    if (/[0-9.]/.test(peek() ?? "")) {
      const j = i;
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      if ((s[i] === "e" || s[i] === "E") && /[0-9+-]/.test(s[i + 1] ?? "")) { i++; if (s[i] === "+" || s[i] === "-") i++; while (i < s.length && /[0-9]/.test(s[i])) i++; }
      return num(parseFloat(s.slice(j, i)));
    }
    if (/[a-zA-Z]/.test(peek() ?? "")) {
      const j = i;
      while (i < s.length && /[a-zA-Z0-9]/.test(s[i])) i++;
      const name = s.slice(j, i);
      if (s[i] === "(") { i++; const a = expr(); if (peek() === ")") i++; return call(name, a); } // adjacent paren = call
      return vr(name); // x, e, pi, other letters (treated as constants)
    }
    throw new Error("parse error");
  }

  try { const n = expr(); return i < s.length ? null : n; } catch { return null; }
}

// ---------- differentiation ----------
function dCall(f: string, a: Node): Node {
  switch (f) {
    case "sin": return call("cos", a);
    case "cos": return neg(call("sin", a));
    case "tan": return pow(call("sec", a), num(2));
    case "cot": return neg(pow(call("csc", a), num(2)));
    case "sec": return mul(call("sec", a), call("tan", a));
    case "csc": case "cosec": return neg(mul(call("csc", a), call("cot", a)));
    case "exp": return call("exp", a);
    case "ln": return div(num(1), a);
    case "log": case "log10": case "lg": return div(num(1), mul(a, call("ln", num(10))));
    case "log2": return div(num(1), mul(a, call("ln", num(2))));
    case "sqrt": return div(num(1), mul(num(2), call("sqrt", a)));
    case "cbrt": return div(num(1), mul(num(3), pow(call("cbrt", a), num(2))));
    case "asin": case "arcsin": return div(num(1), call("sqrt", sub(num(1), pow(a, num(2)))));
    case "acos": case "arccos": return neg(div(num(1), call("sqrt", sub(num(1), pow(a, num(2))))));
    case "atan": case "arctan": return div(num(1), add(num(1), pow(a, num(2))));
    case "sinh": return call("cosh", a);
    case "cosh": return call("sinh", a);
    case "tanh": return sub(num(1), pow(call("tanh", a), num(2)));
    case "abs": return div(a, call("abs", a));
    default: throw new Error(`d/dx of ${f} not supported`);
  }
}

// Does `n` change with `v`? True if it literally contains v, or contains any
// symbol the caller declared to be a function of v (`vars`).
function depends(n: Node, v: string, vars: Set<string>): boolean {
  switch (n.t) {
    case "num": return false;
    case "var": return n.n === v || vars.has(n.n);
    case "neg": case "call": return depends(n.a, v, vars);
    default: return depends(n.a, v, vars) || depends(n.b, v, vars);
  }
}

// A dependent symbol's derivative, printed as dy/dx.
const dSym = (name: string, v: string): Node => vr(`d${name}/d${v}`);

function differentiate(n: Node, v: string, vars: Set<string>): Node {
  if (!depends(n, v, vars)) return num(0); // constant in v
  const d = (x: Node) => differentiate(x, v, vars);
  switch (n.t) {
    case "num": return num(0);
    case "var":
      if (n.n === v) return num(1);
      if (vars.has(n.n)) return dSym(n.n, v); // function of v → chain rule
      return num(0);
    case "neg": return neg(d(n.a));
    case "add": return add(d(n.a), d(n.b));
    case "sub": return sub(d(n.a), d(n.b));
    case "mul": return add(mul(d(n.a), n.b), mul(n.a, d(n.b)));
    case "div": return div(sub(mul(d(n.a), n.b), mul(n.a, d(n.b))), pow(n.b, num(2)));
    case "call": return mul(dCall(n.f, n.a), d(n.a)); // chain rule
    case "pow": {
      const a = n.a, b = n.b;
      if (!depends(b, v, vars)) return mul(mul(b, pow(a, sub(b, num(1)))), d(a)); // a^c
      if (!depends(a, v, vars)) {
        if (a.t === "var" && a.n === "e") return mul(n, d(b)); // e^u
        return mul(mul(n, call("ln", a)), d(b)); // c^u
      }
      return mul(n, add(mul(d(b), call("ln", a)), div(mul(b, d(a)), a)));
    }
  }
}

// Free symbols (single letters treated as candidate variables), excluding the
// differentiation variable and named constants (e, pi, tau, phi).
function freeSymbols(n: Node, v: string, out: Set<string>): void {
  switch (n.t) {
    case "num": return;
    case "var": if (n.n !== v && !CONST_VARS.has(n.n)) out.add(n.n); return;
    case "neg": case "call": freeSymbols(n.a, v, out); return;
    default: freeSymbols(n.a, v, out); freeSymbols(n.b, v, out); return;
  }
}

// ---------- integration ----------
// Coefficients of a1*v + a0 if `n` is linear in v (a1, a0 are constant Nodes), else null.
function linear(n: Node, v: string): { a1: Node; a0: Node } | null {
  if (!hasVar(n, v)) return { a1: num(0), a0: n };
  switch (n.t) {
    case "var": return n.n === v ? { a1: num(1), a0: num(0) } : { a1: num(0), a0: n };
    case "neg": { const l = linear(n.a, v); return l ? { a1: neg(l.a1), a0: neg(l.a0) } : null; }
    case "add": { const la = linear(n.a, v), lb = linear(n.b, v); return la && lb ? { a1: add(la.a1, lb.a1), a0: add(la.a0, lb.a0) } : null; }
    case "sub": { const la = linear(n.a, v), lb = linear(n.b, v); return la && lb ? { a1: sub(la.a1, lb.a1), a0: sub(la.a0, lb.a0) } : null; }
    case "mul":
      if (!hasVar(n.a, v)) { const l = linear(n.b, v); return l ? { a1: mul(n.a, l.a1), a0: mul(n.a, l.a0) } : null; }
      if (!hasVar(n.b, v)) { const l = linear(n.a, v); return l ? { a1: mul(n.b, l.a1), a0: mul(n.b, l.a0) } : null; }
      return null;
    case "div":
      if (!hasVar(n.b, v)) { const l = linear(n.a, v); return l ? { a1: div(l.a1, n.b), a0: div(l.a0, n.b) } : null; }
      return null;
    default: return null;
  }
}

function numVal(n: Node): number | null {
  const s = simplify(n);
  return s.t === "num" ? s.v : null;
}

function integrate(n: Node, v: string): Node | null {
  if (!hasVar(n, v)) return mul(n, vr(v)); // ∫ c dx = c·x
  switch (n.t) {
    case "var": return n.n === v ? div(pow(vr(v), num(2)), num(2)) : mul(n, vr(v));
    case "neg": { const r = integrate(n.a, v); return r ? neg(r) : null; }
    case "add": { const a = integrate(n.a, v), b = integrate(n.b, v); return a && b ? add(a, b) : null; }
    case "sub": { const a = integrate(n.a, v), b = integrate(n.b, v); return a && b ? sub(a, b) : null; }
    case "mul":
      if (!hasVar(n.a, v)) { const r = integrate(n.b, v); return r ? mul(n.a, r) : null; }
      if (!hasVar(n.b, v)) { const r = integrate(n.a, v); return r ? mul(n.b, r) : null; }
      return null;
    case "div":
      if (!hasVar(n.b, v)) { const r = integrate(n.a, v); return r ? div(r, n.b) : null; }
      return integrate(mul(n.a, pow(n.b, num(-1))), v); // a/b → a·b^-1
    case "pow": {
      if (!hasVar(n.b, v)) {
        const c = numVal(n.b);
        const lin = linear(n.a, v);
        if (c === null || !lin) return null;
        if (c === -1) return div(call("ln", call("abs", n.a)), lin.a1);       // ∫(ax+b)^-1 = ln|ax+b|/a
        return div(pow(n.a, num(c + 1)), mul(lin.a1, num(c + 1)));            // power rule + linear sub
      }
      if (!hasVar(n.a, v)) {
        const lin = linear(n.b, v);
        if (!lin) return null;
        if (n.a.t === "var" && n.a.n === "e") return div(n, lin.a1);          // ∫ e^(ax+b) = e^(ax+b)/a
        return div(n, mul(lin.a1, call("ln", n.a)));                          // ∫ c^(ax+b)
      }
      return null;
    }
    case "call": {
      const lin = linear(n.a, v);
      if (!lin) return null;
      const u = n.a, a1 = lin.a1;
      switch (n.f) {
        case "sin": return div(neg(call("cos", u)), a1);
        case "cos": return div(call("sin", u), a1);
        case "exp": return div(call("exp", u), a1);
        case "sinh": return div(call("cosh", u), a1);
        case "cosh": return div(call("sinh", u), a1);
        case "tan": return div(neg(call("ln", call("abs", call("cos", u)))), a1);
        default: return null;
      }
    }
    default: return null;
  }
}

// ---------- simplify ----------
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const isZero = (n: Node) => n.t === "num" && n.v === 0;

// Product form: (p/q) · ∏num / ∏den, with integer p,q where possible.
interface Prod { p: number; q: number; num: Node[]; den: Node[] }
function collect(n: Node): Prod {
  if (n.t === "mul") { const a = collect(n.a), b = collect(n.b); return { p: a.p * b.p, q: a.q * b.q, num: [...a.num, ...b.num], den: [...a.den, ...b.den] }; }
  if (n.t === "div") { const a = collect(n.a), b = collect(n.b); return { p: a.p * b.q, q: a.q * b.p, num: [...a.num, ...b.den], den: [...a.den, ...b.num] }; }
  if (n.t === "neg") { const a = collect(n.a); return { p: -a.p, q: a.q, num: a.num, den: a.den }; }
  if (n.t === "num" && Number.isInteger(n.v)) return { p: n.v, q: 1, num: [], den: [] };
  return { p: 1, q: 1, num: [simplify(n)], den: [] };
}
function fromProd(pr: Prod): Node {
  let { p, q } = pr;
  if (q === 0) return num(NaN);
  if (p === 0) return num(0); // a zero numeric factor kills the whole product
  const g = gcd(p, q) || 1; p /= g; q /= g;
  if (q < 0) { p = -p; q = -q; }
  const sign = p < 0; p = Math.abs(p);
  const prod = (fs: Node[]) => fs.length ? fs.reduce((acc, f) => mul(acc, f)) : null;
  let numer = prod(pr.num);
  if (p !== 1 || !numer) numer = numer ? mul(num(p), numer) : num(p);
  const denom = prod(pr.den);
  let res: Node;
  if (q !== 1 || denom) {
    const d = denom ? (q !== 1 ? mul(num(q), denom) : denom) : num(q);
    res = div(numer, d);
  } else res = numer;
  return sign ? neg(res) : res;
}

function simplify(n: Node): Node {
  switch (n.t) {
    case "num": case "var": return n;
    case "neg": { const a = simplify(n.a); if (a.t === "num") return num(-a.v); if (a.t === "neg") return a.a; return neg(a); }
    case "add": { const a = simplify(n.a), b = simplify(n.b); if (a.t === "num" && b.t === "num") return num(a.v + b.v); if (isZero(a)) return b; if (isZero(b)) return a; return add(a, b); }
    case "sub": { const a = simplify(n.a), b = simplify(n.b); if (a.t === "num" && b.t === "num") return num(a.v - b.v); if (isZero(b)) return a; if (isZero(a)) return simplify(neg(b)); return sub(a, b); }
    case "pow": {
      const a = simplify(n.a), b = simplify(n.b);
      if (b.t === "num") { if (b.v === 0) return num(1); if (b.v === 1) return a; }
      if (a.t === "num" && b.t === "num") { const p = Math.pow(a.v, b.v); if (Number.isInteger(p)) return num(p); }
      return pow(a, b);
    }
    case "call": {
      const a = simplify(n.a);
      if (n.f === "ln") { if (a.t === "var" && a.n === "e") return num(1); if (a.t === "num" && a.v === 1) return num(0); }
      if (n.f === "exp" && isZero(a)) return num(1);
      if ((n.f === "sin" || n.f === "tan" || n.f === "sinh") && isZero(a)) return num(0);
      if ((n.f === "cos" || n.f === "cosh") && isZero(a)) return num(1);
      return call(n.f, a);
    }
    case "mul": case "div": return fromProd(collect(n));
  }
}

// ---------- LaTeX printer ----------
const FN_LATEX: Record<string, string> = {
  sin: "\\sin", cos: "\\cos", tan: "\\tan", cot: "\\cot", sec: "\\sec", csc: "\\csc", cosec: "\\csc",
  ln: "\\ln", log: "\\log", log10: "\\log", log2: "\\log_2",
  asin: "\\arcsin", arcsin: "\\arcsin", acos: "\\arccos", arccos: "\\arccos", atan: "\\arctan", arctan: "\\arctan",
  sinh: "\\sinh", cosh: "\\cosh", tanh: "\\tanh",
};
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(6)));
}

function tex(n: Node, parent = 0): string {
  const wrap = (s: string, p: number) => (p < parent ? `\\left(${s}\\right)` : s);
  switch (n.t) {
    case "num": return fmtNum(n.v);
    case "var": {
      const dm = n.n.match(/^d([A-Za-z])\/d([A-Za-z])$/); // dependent-symbol derivative
      if (dm) return `\\frac{d${dm[1]}}{d${dm[2]}}`;
      return CONST_VARS.has(n.n) ? (n.n === "e" ? "e" : `\\${n.n}`) : n.n;
    }
    case "neg": return wrap(`-${tex(n.a, 2)}`, 2);
    case "add": return wrap(`${tex(n.a, 1)} + ${tex(n.b, 1)}`, 1);
    case "sub": return wrap(`${tex(n.a, 1)} - ${tex(n.b, 2)}`, 1);
    case "mul": {
      const l = tex(n.a, 2), r = tex(n.b, 2);
      // juxtapose (2x), but use a dot between two bare numbers
      const sep = n.a.t === "num" && n.b.t === "num" ? " \\cdot " : " ";
      return wrap(`${l}${sep}${r}`, 2);
    }
    case "div": return `\\frac{${tex(n.a, 0)}}{${tex(n.b, 0)}}`;
    case "pow": return wrap(`${tex(n.a, 4)}^{${tex(n.b, 0)}}`, 3);
    case "call": {
      if (n.f === "sqrt") return `\\sqrt{${tex(n.a, 0)}}`;
      if (n.f === "cbrt") return `\\sqrt[3]{${tex(n.a, 0)}}`;
      if (n.f === "abs") return `\\left|${tex(n.a, 0)}\\right|`;
      if (n.f === "exp") return wrap(`e^{${tex(n.a, 0)}}`, 3);
      const name = FN_LATEX[n.f] ?? `\\operatorname{${n.f}}`;
      return `${name}\\left(${tex(n.a, 0)}\\right)`;
    }
  }
}

// ---------- public entry ----------
export interface SymbolicResult {
  op: "derivative" | "integral";
  result: string;
  variable: string;       // the differentiation / integration variable
  symbols: string[];      // other free symbols the user may mark as variables
}

/**
 * Symbolic derivative or indefinite integral of a LaTeX expression, as LaTeX.
 * Recognises \frac{d}{dx}(...) / d/dx ... and \int ... dx (no bounds).
 * `vars` lists symbols (besides the diff variable) to treat as functions of it,
 * so implicit differentiation emits dy/dx terms. Everything else is a constant.
 * Returns null when it isn't such an expression or can't be done in closed form.
 */
export function symbolicCalc(src: string, vars: Set<string> = new Set()): SymbolicResult | null {
  const t = src.replace(/\\[,;:! ]/g, " ").trim();
  if (!t) return null;

  // derivative: \frac{d}{dx}(...)  |  d/dx ...
  const dm = t.match(/^(?:\\frac\s*\{\s*d\s*\}\s*\{\s*d([a-zA-Z])\s*\}|d\s*\/\s*d([a-zA-Z]))\s*([\s\S]+)$/);
  if (dm) {
    const v = dm[1] || dm[2];
    const ast = parse(dm[3]);
    if (!ast) return null;
    const symbols = new Set<string>();
    freeSymbols(ast, v, symbols);
    try {
      const r = simplify(simplify(differentiate(ast, v, vars)));
      return { op: "derivative", result: tex(r), variable: v, symbols: [...symbols].sort() };
    } catch { return null; }
  }

  // indefinite integral: \int EXPR dx   (bounds → handled numerically elsewhere)
  if (/\\int\s*[_^]/.test(t)) return null;
  const im = t.match(/^\\int\s+([\s\S]+?)\s+d([a-zA-Z])\s*$/);
  if (im) {
    const ast = parse(im[1]);
    if (!ast) return null;
    try {
      const r = integrate(ast, im[2]);
      if (!r) return null;
      return { op: "integral", result: `${tex(simplify(simplify(r)))} + C`, variable: im[2], symbols: [] };
    } catch { return null; }
  }
  return null;
}
