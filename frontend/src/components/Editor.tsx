"use client";

import type Konva from "konva";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  exportHtml,
  exportImage,
  exportPdf,
  exportPptx,
  pdfFileToImages,
} from "@/lib/exporters";
import {
  downloadText,
  isScene,
  loadImageSize,
  readFileAsDataUrl,
  readFileAsText,
} from "@/lib/files";
import { newId } from "@/lib/id";
import { renderMath } from "@/lib/math";
import { stencilDataUrl, type Stencil } from "@/lib/stencils";
import type { Template } from "@/lib/templates";
import type {
  BackgroundStyle,
  ChartElement,
  FileDetail,
  GraphElement,
  MathElement,
  Scene,
  SceneElement,
  TableElement,
} from "@/lib/types";
import ChartModal, { type ChartConfig } from "./ChartModal";
import type { Tool } from "./DrawingCanvas";
import GraphModal, { type GraphConfig } from "./GraphModal";
import InsertPicker from "./InsertPicker";
import MathModal from "./MathModal";
import SelectionPanel from "./SelectionPanel";
import TableModal, { type TableConfig } from "./TableModal";
import Toolbar, { type ExportFormat } from "./Toolbar";
import styles from "./Editor.module.css";

const DrawingCanvas = dynamic(() => import("./DrawingCanvas"), { ssr: false });

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  file: FileDetail;
  onSaved: () => void;
}

interface Placement { x: number; y: number; editingId: string | null }

const DEFAULT_TABLE: TableConfig = {
  rows: 3, cols: 3,
  cells: [["Header 1", "Header 2", "Header 3"], ["", "", ""], ["", "", ""]],
  headerRow: true,
};
const DEFAULT_CHART: ChartConfig = {
  chartType: "bar", title: "Chart",
  data: [{ label: "A", value: 4 }, { label: "B", value: 7 }, { label: "C", value: 3 }],
};
const DEFAULT_GRAPH: GraphConfig = {
  funcs: [{ expr: "sin(x)", color: "#3d5a80" }],
  xMin: -10, xMax: 10, yMin: -5, yMax: 5, autoY: true,
};

export default function Editor({ file, onSaved }: Props) {
  const [scene, setScene] = useState<Scene>({ elements: file.scene.elements });
  const [background, setBackground] = useState(file.backgroundColor);
  // Paper style is independent state (NOT part of the scene/undo flow), so
  // deleting or editing elements can never reset it.
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>(file.scene.backgroundStyle ?? "blank");
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#111111");
  const [fill, setFill] = useState<string>("transparent");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState<string | null>(null);

  const [snap, setSnap] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [mathEditor, setMathEditor] = useState<(Placement & { latex: string; color: string }) | null>(null);
  const [tableEditor, setTableEditor] = useState<(Placement & { initial: TableConfig }) | null>(null);
  const [chartEditor, setChartEditor] = useState<(Placement & { initial: ChartConfig }) | null>(null);
  const [graphEditor, setGraphEditor] = useState<(Placement & { initial: GraphConfig }) | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ scene, background, backgroundStyle });
  latest.current = { scene, background, backgroundStyle };

  // Undo/redo history of scenes.
  const history = useRef<Scene[]>([file.scene]);
  const histIndex = useRef(0);

  useEffect(() => {
    const initial = { elements: file.scene.elements };
    setScene(initial);
    setBackground(file.backgroundColor);
    setBackgroundStyle(file.scene.backgroundStyle ?? "blank");
    setSelectedId(null);
    setSaveState("idle");
    setMathEditor(null);
    setTableEditor(null);
    setChartEditor(null);
    history.current = [initial];
    histIndex.current = 0;
  }, [file.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const queueSave = useCallback(() => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateFile(file.id, {
          scene: { elements: latest.current.scene.elements, backgroundStyle: latest.current.backgroundStyle },
          backgroundColor: latest.current.background,
        });
        setSaveState("saved");
        onSaved();
      } catch (e) {
        console.error("autosave failed", e);
        setSaveState("error");
      }
    }, 600);
  }, [file.id, onSaved]);

  // Apply a scene change and (by default) record it for undo.
  const applyScene = useCallback((next: Scene, record = true) => {
    setScene(next);
    queueSave();
    if (record) {
      history.current = history.current.slice(0, histIndex.current + 1);
      history.current.push(next);
      histIndex.current = history.current.length - 1;
    }
  }, [queueSave]);

  const undo = useCallback(() => {
    if (histIndex.current <= 0) return;
    histIndex.current -= 1;
    setSelectedId(null);
    applyScene(history.current[histIndex.current], false);
  }, [applyScene]);

  const redo = useCallback(() => {
    if (histIndex.current >= history.current.length - 1) return;
    histIndex.current += 1;
    setSelectedId(null);
    applyScene(history.current[histIndex.current], false);
  }, [applyScene]);

  const changeBackground = (c: string) => {
    setBackground(c);
    queueSave();
  };

  const changeBackgroundStyle = (s: BackgroundStyle) => {
    setBackgroundStyle(s);
    queueSave();
  };

  // Update the currently-selected element in place (used by the size panel).
  const updateSelected = useCallback((patch: Partial<SceneElement>) => {
    if (!selectedId) return;
    applyScene({ elements: scene.elements.map((e) => (e.id === selectedId ? ({ ...e, ...patch } as SceneElement) : e)) });
  }, [selectedId, scene, applyScene]);

  const selectedElement = selectedId ? scene.elements.find((e) => e.id === selectedId) ?? null : null;

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    applyScene({ elements: scene.elements.filter((e) => e.id !== selectedId) });
    setSelectedId(null);
  }, [selectedId, scene, applyScene]);

  const addElement = (el: SceneElement) => {
    applyScene({ elements: [...scene.elements, el] });
    setTool("select");
    setSelectedId(el.id);
  };

  // --- Math (LaTeX) ---
  const requestMath = (x: number, y: number) => setMathEditor({ latex: "", color, x, y, editingId: null });
  const editMath = (id: string) => {
    const el = scene.elements.find((e) => e.id === id);
    if (el?.type === "math") setMathEditor({ latex: el.latex, color: el.color, x: el.x, y: el.y, editingId: id });
  };
  const saveMath = async (latex: string) => {
    const ed = mathEditor;
    if (!ed) return;
    setMathEditor(null);
    let size = { width: 120, height: 40 };
    try { const r = await renderMath(latex, ed.color); size = { width: r.width, height: r.height }; }
    catch { /* dashed placeholder for bad LaTeX */ }
    if (ed.editingId) {
      applyScene({ elements: scene.elements.map((e) =>
        e.id === ed.editingId ? { ...(e as MathElement), latex, ...size } : e) });
      setSelectedId(ed.editingId);
    } else {
      addElement({ id: newId(), type: "math", x: ed.x, y: ed.y, latex, color: ed.color, ...size });
    }
  };

  // --- Table ---
  const requestTable = (x: number, y: number) => setTableEditor({ x, y, editingId: null, initial: DEFAULT_TABLE });
  const editTable = (id: string) => {
    const el = scene.elements.find((e) => e.id === id);
    if (el?.type === "table") setTableEditor({ x: el.x, y: el.y, editingId: id, initial: el });
  };
  const saveTable = (cfg: TableConfig) => {
    const ed = tableEditor;
    if (!ed) return;
    setTableEditor(null);
    const width = cfg.cols * 120;
    const height = cfg.rows * 38;
    if (ed.editingId) {
      applyScene({ elements: scene.elements.map((e) =>
        e.id === ed.editingId ? { ...(e as TableElement), ...cfg, width, height } : e) });
      setSelectedId(ed.editingId);
    } else {
      addElement({
        id: newId(), type: "table", x: ed.x, y: ed.y, width, height,
        ...cfg, textColor: "#111827", borderColor: "#cbd5e1", headerFill: "#eef2f7",
      });
    }
  };

  // --- Chart ---
  const requestChart = (x: number, y: number) => setChartEditor({ x, y, editingId: null, initial: DEFAULT_CHART });
  const editChart = (id: string) => {
    const el = scene.elements.find((e) => e.id === id);
    if (el?.type === "chart")
      setChartEditor({ x: el.x, y: el.y, editingId: id, initial: { chartType: el.chartType, title: el.title, data: el.data } });
  };
  const saveChart = (cfg: ChartConfig) => {
    const ed = chartEditor;
    if (!ed) return;
    setChartEditor(null);
    if (ed.editingId) {
      applyScene({ elements: scene.elements.map((e) =>
        e.id === ed.editingId ? { ...(e as ChartElement), ...cfg } : e) });
      setSelectedId(ed.editingId);
    } else {
      addElement({ id: newId(), type: "chart", x: ed.x, y: ed.y, width: 380, height: 260, ...cfg });
    }
  };

  // --- Graph (function plot) ---
  const requestGraph = (x: number, y: number) => setGraphEditor({ x, y, editingId: null, initial: DEFAULT_GRAPH });
  const editGraph = (id: string) => {
    const el = scene.elements.find((e) => e.id === id);
    if (el?.type === "graph")
      setGraphEditor({ x: el.x, y: el.y, editingId: id, initial: { funcs: el.funcs, xMin: el.xMin, xMax: el.xMax, yMin: el.yMin, yMax: el.yMax, autoY: el.autoY ?? true } });
  };
  const saveGraph = (cfg: GraphConfig) => {
    const ed = graphEditor;
    if (!ed) return;
    setGraphEditor(null);
    if (ed.editingId) {
      applyScene({ elements: scene.elements.map((e) =>
        e.id === ed.editingId ? { ...(e as GraphElement), ...cfg } : e) });
      setSelectedId(ed.editingId);
    } else {
      addElement({ id: newId(), type: "graph", x: ed.x, y: ed.y, width: 460, height: 300, ...cfg });
    }
  };

  // --- Text ---
  const requestText = (x: number, y: number) => {
    const text = window.prompt("Text:");
    if (text) addElement({ id: newId(), type: "text", x, y, text, fontSize: 24, fill: color });
    // addElement switches to the select tool, so the next click won't re-prompt.
  };
  const editText = (id: string) => {
    const el = scene.elements.find((e) => e.id === id);
    if (el?.type !== "text") return;
    const text = window.prompt("Edit text:", el.text);
    if (text !== null) applyScene({ elements: scene.elements.map((e) => (e.id === id ? { ...el, text } : e)) });
  };

  // --- Insert stencils / templates ---
  const insertStencil = (s: Stencil) => {
    setInsertOpen(false);
    addElement({ id: newId(), type: "image", x: 120, y: 120, width: s.w, height: s.h, src: stencilDataUrl(s) });
  };
  const insertTemplate = (t: Template) => {
    setInsertOpen(false);
    applyScene({ elements: [...scene.elements, ...t.build()] });
    setTool("select");
    setSelectedId(null);
  };

  // Keyboard: delete + undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteSelected, undo, redo]);

  // --- Import ---
  const importImage = async (f: File) => {
    const src = await readFileAsDataUrl(f);
    const { width, height } = await loadImageSize(src);
    const scale = Math.min(1, 420 / Math.max(width, height));
    addElement({ id: newId(), type: "image", x: 80, y: 80, width: width * scale, height: height * scale, src });
  };

  const importPdf = async (f: File) => {
    setBusy("Importing PDF…");
    try {
      const pages = await pdfFileToImages(f);
      const maxW = 640;
      let y = 40;
      const additions: SceneElement[] = pages.map((pg) => {
        const scale = Math.min(1, maxW / pg.width);
        const el: SceneElement = {
          id: newId(), type: "image", x: 40, y,
          width: pg.width * scale, height: pg.height * scale, src: pg.dataUrl,
        };
        y += pg.height * scale + 20;
        return el;
      });
      applyScene({ elements: [...scene.elements, ...additions] });
      setTool("select");
    } catch (e) {
      alert(`Could not import PDF: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const importScene = async (f: File) => {
    try {
      const parsed = JSON.parse(await readFileAsText(f));
      if (!isScene(parsed)) throw new Error("Not a valid scene file.");
      applyScene(parsed);
      setSelectedId(null);
    } catch (e) {
      alert(`Could not import: ${(e as Error).message}`);
    }
  };

  // Route an imported file by type.
  const importFile = (f: File) => {
    const name = f.name.toLowerCase();
    if (f.type === "application/pdf" || name.endsWith(".pdf")) return importPdf(f);
    if (f.type.startsWith("image/")) return importImage(f);
    if (name.endsWith(".json") || name.endsWith(".notebook") || name.endsWith(".drawdesk")) return importScene(f);
    alert("Unsupported file. Import a PNG/JPG, a PDF, or a .notebook/.json scene.");
  };

  // --- Export ---
  const runExport = async (fmt: ExportFormat) => {
    if (fmt === "json") {
      downloadText(JSON.stringify(scene, null, 2), `${file.name}.notebook`);
      return;
    }
    setSelectedId(null); // hide transformer handles
    await new Promise((r) => requestAnimationFrame(r));
    const stage = stageRef.current;
    if (!stage) return;
    setBusy(`Exporting ${fmt.toUpperCase()}…`);
    try {
      if (fmt === "png" || fmt === "jpeg") exportImage(stage, file.name, fmt);
      else if (fmt === "pdf") await exportPdf(stage, file.name);
      else if (fmt === "pptx") await exportPptx(stage, file.name);
      else if (fmt === "html") exportHtml(stage, file.name);
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.editor}>
      <Toolbar
        tool={tool} onTool={setTool}
        color={color} onColor={setColor}
        fill={fill} onFill={setFill}
        strokeWidth={strokeWidth} onStrokeWidth={setStrokeWidth}
        background={background} onBackground={changeBackground}
        backgroundStyle={backgroundStyle} onBackgroundStyle={changeBackgroundStyle}
        snap={snap} onSnap={setSnap}
        onOpenInsert={() => setInsertOpen(true)}
        hasSelection={!!selectedId} onDelete={deleteSelected}
        canUndo={histIndex.current > 0}
        canRedo={histIndex.current < history.current.length - 1}
        onUndo={undo} onRedo={redo}
        onImportFile={importFile}
        onExport={runExport}
        saveState={saveState}
      />
      <div className={styles.canvasWrap}>
        <DrawingCanvas
          scene={scene}
          backgroundColor={background}
          backgroundStyle={backgroundStyle}
          tool={tool}
          color={color}
          fill={fill}
          strokeWidth={strokeWidth}
          snap={snap}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={applyScene}
          onRequestMath={requestMath} onEditMath={editMath}
          onRequestTable={requestTable} onEditTable={editTable}
          onRequestChart={requestChart} onEditChart={editChart}
          onRequestGraph={requestGraph} onEditGraph={editGraph}
          onRequestText={requestText} onEditText={editText}
          onDrawComplete={() => setTool("select")}
          stageRef={stageRef}
        />
        {busy && <div className={styles.busy}>{busy}</div>}
        {selectedElement && <SelectionPanel el={selectedElement} onUpdate={updateSelected} />}
      </div>

      {mathEditor && (
        <MathModal initialLatex={mathEditor.latex} color={mathEditor.color}
          onSave={saveMath} onCancel={() => setMathEditor(null)} />
      )}
      {tableEditor && (
        <TableModal initial={tableEditor.initial}
          onSave={saveTable} onCancel={() => setTableEditor(null)} />
      )}
      {chartEditor && (
        <ChartModal initial={chartEditor.initial}
          onSave={saveChart} onCancel={() => setChartEditor(null)} />
      )}
      {graphEditor && (
        <GraphModal initial={graphEditor.initial}
          onSave={saveGraph} onCancel={() => setGraphEditor(null)} />
      )}
      {insertOpen && (
        <InsertPicker onInsertStencil={insertStencil} onInsertTemplate={insertTemplate}
          onClose={() => setInsertOpen(false)} />
      )}
    </div>
  );
}
