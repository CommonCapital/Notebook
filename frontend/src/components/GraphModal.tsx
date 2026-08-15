"use client";

import { useMemo, useState } from "react";
import { compile, graphToSvg } from "@/lib/plot";
import { svgToDataUrl } from "@/lib/generate";
import type { GraphElement } from "@/lib/types";
import styles from "./EditorModals.module.css";

export type GraphConfig = Pick<GraphElement, "funcs" | "xMin" | "xMax" | "yMin" | "yMax">;

const CURVE_COLORS = ["#3d5a80", "#b5654d", "#6b8f71", "#7d6b8f", "#b98a46"];

export default function GraphModal({
  initial,
  onSave,
  onCancel,
}: {
  initial: GraphConfig;
  onSave: (cfg: GraphConfig) => void;
  onCancel: () => void;
}) {
  const [funcs, setFuncs] = useState(initial.funcs);
  // Ranges are kept as raw strings so you can type a leading "-" and long
  // negatives (e.g. -1000000, or -1e6) without a controlled number input
  // wiping the minus mid-keystroke.
  const [xMinS, setXMinS] = useState(String(initial.xMin));
  const [xMaxS, setXMaxS] = useState(String(initial.xMax));
  const [yMinS, setYMinS] = useState(String(initial.yMin));
  const [yMaxS, setYMaxS] = useState(String(initial.yMax));

  const pv = (s: string, fb: number) => { const n = parseFloat(s); return Number.isFinite(n) ? n : fb; };
  const xMin = pv(xMinS, -10), xMax = pv(xMaxS, 10), yMin = pv(yMinS, -10), yMax = pv(yMaxS, 10);

  const errors = funcs.map((f) => {
    if (!f.expr.trim()) return null;
    try { compile(f.expr); return null; } catch (e) { return (e as Error).message; }
  });

  const preview = useMemo(() => {
    const el = { type: "graph", id: "p", x: 0, y: 0, width: 460, height: 240, funcs, xMin, xMax, yMin, yMax } as GraphElement;
    return svgToDataUrl(graphToSvg(el));
  }, [funcs, xMin, xMax, yMin, yMax]);

  const setExpr = (i: number, expr: string) => setFuncs((p) => p.map((f, idx) => (idx === i ? { ...f, expr } : f)));
  const addFunc = () => setFuncs((p) => [...p, { expr: "", color: CURVE_COLORS[p.length % CURVE_COLORS.length] }]);
  const removeFunc = (i: number) => setFuncs((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const num = (label: string, value: string, set: (v: string) => void) => (
    <label className={styles.label} style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {label}
      <input className={styles.num} type="text" inputMode="text" value={value}
        onChange={(e) => set(e.target.value)} />
    </label>
  );

  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <div className={styles.head}>
          <span>∿ Function grapher</span>
          <button className={styles.close} onClick={onCancel}>×</button>
        </div>

        <div style={{ background: "#fbfaf7", border: "1px solid var(--line-2)", borderRadius: 6, padding: 8, marginBottom: 12, display: "flex", justifyContent: "center" }}>
          <img src={preview} alt="graph preview" style={{ maxWidth: "100%" }} />
        </div>

        {funcs.map((f, i) => (
          <div key={i} className={styles.dataRow}>
            <span style={{ color: f.color, fontSize: 18 }}>■</span>
            <input className={`${styles.text} ${styles.textFull}`} value={f.expr}
              placeholder="e.g.  sin(x) + 0.5*x   ·  use * for multiply, ^ for powers"
              onChange={(e) => setExpr(i, e.target.value)}
              style={errors[i] ? { borderColor: "var(--danger)" } : undefined} />
            <button className={styles.del} title="Remove" onClick={() => removeFunc(i)}>×</button>
          </div>
        ))}
        <button className={styles.addRow} onClick={addFunc}>+ Add function</button>

        <div className={styles.row} style={{ marginTop: 12 }}>
          {num("x min", xMinS, setXMinS)}
          {num("x max", xMaxS, setXMaxS)}
          {num("y min", yMinS, setYMinS)}
          {num("y max", yMaxS, setYMaxS)}
        </div>

        <div className={styles.foot}>
          <button className={styles.cancel} onClick={onCancel}>Cancel</button>
          <button className={styles.ok}
            onClick={() => onSave({ funcs: funcs.filter((f) => f.expr.trim()), xMin, xMax, yMin, yMax })}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
