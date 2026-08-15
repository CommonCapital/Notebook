"use client";

import { useEffect, useRef, useState } from "react";
import type { Tool } from "./DrawingCanvas";
import styles from "./Toolbar.module.css";

export type ExportFormat = "png" | "jpeg" | "pdf" | "html" | "pptx" | "json";

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "select", label: "Select / move", icon: "↖" },
  { id: "pen", label: "Pen", icon: "✎" },
  { id: "line", label: "Line", icon: "╱" },
  { id: "arrow", label: "Arrow", icon: "↗" },
  { id: "rect", label: "Rectangle", icon: "▭" },
  { id: "ellipse", label: "Ellipse", icon: "◯" },
  { id: "diamond", label: "Diamond", icon: "◇" },
  { id: "triangle", label: "Triangle", icon: "△" },
  { id: "text", label: "Text", icon: "T" },
  { id: "math", label: "Math formula (LaTeX)", icon: "∑" },
  { id: "table", label: "Table", icon: "▦" },
  { id: "chart", label: "Chart", icon: "📊" },
];

const EXPORTS: { fmt: ExportFormat; label: string }[] = [
  { fmt: "png", label: "PNG image" },
  { fmt: "jpeg", label: "JPG image" },
  { fmt: "pdf", label: "PDF document" },
  { fmt: "html", label: "HTML page" },
  { fmt: "pptx", label: "PowerPoint (.pptx)" },
  { fmt: "json", label: "Scene (.drawdesk)" },
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

      <label className={styles.field} title="Stroke / text color">
        Pen
        <input type="color" value={p.color} onChange={(e) => p.onColor(e.target.value)} />
      </label>

      <label className={styles.field} title="Shape fill">
        Fill
        <input type="color" value={p.fill === "transparent" ? "#ffffff" : p.fill}
          onChange={(e) => p.onFill(e.target.value)} />
        <button className={styles.mini}
          onClick={() => p.onFill(p.fill === "transparent" ? "#000000" : "transparent")}>
          {p.fill === "transparent" ? "none" : "solid"}
        </button>
      </label>

      <label className={styles.field} title="Stroke width">
        Size
        <input type="range" min={1} max={40} value={p.strokeWidth}
          onChange={(e) => p.onStrokeWidth(Number(e.target.value))} />
        <span className={styles.num}>{p.strokeWidth}</span>
      </label>

      <label className={styles.field} title="Canvas background">
        BG
        <input type="color" value={p.background} onChange={(e) => p.onBackground(e.target.value)} />
      </label>

      <button className={styles.action} disabled={!p.hasSelection} onClick={p.onDelete}
        title="Delete selected (or press Delete)">🗑 Delete</button>

      <div className={styles.sep} />

      <label className={styles.action} title="Import a PNG/JPG, a PDF, or a .drawdesk scene">
        📥 Import
        <input type="file" accept="image/*,application/pdf,.json,.drawdesk" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onImportFile(f);
            e.target.value = "";
          }} />
      </label>

      <div className={styles.exportWrap} ref={exportRef}>
        <button className={styles.action} onClick={() => setExportOpen((o) => !o)}>⬇ Export ▾</button>
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
        {p.saveState === "saving" ? "Saving…"
          : p.saveState === "saved" ? "✓ Saved"
          : p.saveState === "error" ? "⚠ Save failed"
          : ""}
      </span>
    </div>
  );
}
