"use client";

import { useEffect, useRef, useState } from "react";
import type { BackgroundStyle } from "@/lib/types";
import type { Tool } from "./DrawingCanvas";
import styles from "./Toolbar.module.css";

export type ExportFormat = "png" | "jpeg" | "pdf" | "html" | "pptx" | "json";

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select / move (V)", icon: "⌖" },
  { id: "pan", label: "Pan — or hold Space", icon: "✥" },
  { id: "pen", label: "Pen", icon: "✎" },
  { id: "eraser", label: "Eraser — removes objects", icon: "⌫" },
  { id: "line", label: "Line", icon: "╱" },
  { id: "arrow", label: "Arrow", icon: "↗" },
  { id: "rect", label: "Rectangle", icon: "▭" },
  { id: "ellipse", label: "Ellipse", icon: "◯" },
  { id: "diamond", label: "Diamond", icon: "◇" },
  { id: "triangle", label: "Triangle", icon: "△" },
  { id: "text", label: "Text", icon: "T" },
  { id: "math", label: "Math / physics / chemistry (LaTeX)", icon: "∑" },
  { id: "table", label: "Table", icon: "▦" },
  { id: "chart", label: "Chart", icon: "◫" },
  { id: "graph", label: "Function graph (Desmos-style)", icon: "∿" },
];

const BG_STYLES: { id: BackgroundStyle; label: string; icon: string }[] = [
  { id: "blank", label: "Blank", icon: "▢" },
  { id: "grid", label: "Grid", icon: "⊞" },
  { id: "lines", label: "Ruled lines", icon: "≡" },
  { id: "dots", label: "Dots", icon: "⁙" },
];

const EXPORTS: { fmt: ExportFormat; label: string }[] = [
  { fmt: "png", label: "PNG image" },
  { fmt: "jpeg", label: "JPG image" },
  { fmt: "pdf", label: "PDF document" },
  { fmt: "html", label: "HTML page" },
  { fmt: "pptx", label: "PowerPoint (.pptx)" },
  { fmt: "json", label: "Scene (.notebook)" },
];

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: string;
  onColor: (c: string) => void;
  fill: string;
  onFill: (c: string) => void;
  strokeWidth: number;
  onStrokeWidth: (w: number) => void;
  background: string;
  onBackground: (c: string) => void;
  backgroundStyle: BackgroundStyle;
  onBackgroundStyle: (s: BackgroundStyle) => void;
  snap: boolean;
  onSnap: (v: boolean) => void;
  onOpenInsert: () => void;
  hasSelection: boolean;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImportFile: (file: File) => void;
  onExport: (fmt: ExportFormat) => void;
  saveState: "idle" | "saving" | "saved" | "error";
}

export default function Toolbar(p: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        {TOOLS.map((t) => (
          <button key={t.id} title={t.label}
            className={`${styles.tool} ${p.tool === t.id ? styles.active : ""}`}
            onClick={() => p.onTool(t.id)}>
            {t.icon}
          </button>
        ))}
      </div>

      <div className={styles.sep} />

      <button className={styles.tool} title="Undo (⌘/Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo}>↶</button>
      <button className={styles.tool} title="Redo (⌘/Ctrl+Shift+Z)" disabled={!p.canRedo} onClick={p.onRedo}>↷</button>

      <div className={styles.sep} />

      <label className={styles.field} title="Stroke / text colour">
        <span>Ink</span>
        <input type="color" value={p.color} onChange={(e) => p.onColor(e.target.value)} />
      </label>

      <label className={styles.field} title="Shape fill">
        <span>Fill</span>
        <input type="color" value={p.fill === "transparent" ? "#ffffff" : p.fill}
          onChange={(e) => p.onFill(e.target.value)} />
        <button className={styles.mini}
          onClick={() => p.onFill(p.fill === "transparent" ? "#000000" : "transparent")}>
          {p.fill === "transparent" ? "none" : "solid"}
        </button>
      </label>

      <label className={styles.field} title="Stroke width">
        <span>Weight</span>
        <input type="range" min={1} max={40} value={p.strokeWidth}
          onChange={(e) => p.onStrokeWidth(Number(e.target.value))} />
        <span className={styles.num}>{p.strokeWidth}</span>
      </label>

      <div className={styles.sep} />

      <label className={styles.field} title="Paper colour">
        <span>Paper</span>
        <input type="color" value={p.background} onChange={(e) => p.onBackground(e.target.value)} />
      </label>

      <div className={styles.seg} title="Paper style">
        {BG_STYLES.map((s) => (
          <button key={s.id} title={s.label}
            className={`${styles.segBtn} ${p.backgroundStyle === s.id ? styles.active : ""}`}
            onClick={() => p.onBackgroundStyle(s.id)}>
            {s.icon}
          </button>
        ))}
      </div>

      <button className={`${styles.tool} ${p.snap ? styles.active : ""}`} title="Snap to grid"
        onClick={() => p.onSnap(!p.snap)}>⊹</button>

      <div className={styles.sep} />

      <button className={styles.action} title="Insert a stencil or a template" onClick={p.onOpenInsert}>Insert…</button>

      <button className={styles.action} disabled={!p.hasSelection} onClick={p.onDelete}
        title="Delete selected (Del)">Delete</button>

      <label className={styles.action} title="Import a PNG/JPG, a PDF (annotate it), or a .notebook scene">
        Import
        <input type="file" accept="image/*,application/pdf,.json,.notebook,.drawdesk" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImportFile(f); e.target.value = ""; }} />
      </label>

      <div className={styles.exportWrap} ref={exportRef}>
        <button className={styles.action} onClick={() => setExportOpen((o) => !o)}>Export ▾</button>
        {exportOpen && (
          <div className={styles.menu}>
            {EXPORTS.map((x) => (
              <button key={x.fmt} className={styles.menuItem}
                onClick={() => { setExportOpen(false); p.onExport(x.fmt); }}>
                {x.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.spacer} />
      <span className={`${styles.save} ${styles[p.saveState]}`}>
        {p.saveState === "saving" ? "saving…"
          : p.saveState === "saved" ? "saved"
          : p.saveState === "error" ? "save failed"
          : ""}
      </span>
    </div>
  );
}
