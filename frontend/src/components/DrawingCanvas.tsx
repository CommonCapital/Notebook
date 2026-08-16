"use client";

import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Arrow,
  Circle,
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type { BackgroundStyle, Scene, SceneElement } from "@/lib/types";
import { chartToSvg, tableToSvg } from "@/lib/generate";
import { graphToSvg } from "@/lib/plot";
import { newId } from "@/lib/id";
import MathShape from "./MathShape";
import SvgImageShape from "./SvgImageShape";
import styles from "./DrawingCanvas.module.css";

export type Tool =
  | "select" | "pan" | "pen" | "eraser" | "line" | "arrow"
  | "rect" | "ellipse" | "diamond" | "triangle"
  | "text" | "math" | "table" | "chart" | "graph";

// Point-based geometry: dragging shifts points; resize bakes scale into points.
const POINT_TYPES = new Set(["stroke", "line", "arrow"]);
const GRID = 26; // world units between grid lines
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;

interface View { scale: number; x: number; y: number }

interface Props {
  scene: Scene;
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
  tool: Tool;
  color: string;
  fill: string;
  strokeWidth: number;
  snap: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (scene: Scene) => void;
  onRequestMath: (x: number, y: number) => void;
  onEditMath: (id: string) => void;
  onRequestTable: (x: number, y: number) => void;
  onEditTable: (id: string) => void;
  onRequestChart: (x: number, y: number) => void;
  onEditChart: (id: string) => void;
  onRequestGraph: (x: number, y: number) => void;
  onEditGraph: (id: string) => void;
  onRequestText: (x: number, y: number) => void;
  onEditText: (id: string) => void;
  onDrawComplete: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

// Average of flat [x0,y0,x1,y1,...] point pairs.
function centroid(pts: number[]): { x: number; y: number } {
  let sx = 0, sy = 0;
  const n = Math.max(1, pts.length / 2);
  for (let i = 0; i < pts.length; i += 2) { sx += pts[i]; sy += pts[i + 1]; }
  return { x: sx / n, y: sy / n };
}

function useHtmlImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new window.Image();
    image.src = src;
    image.onload = () => setImg(image);
  }, [src]);
  return img;
}

function ImageShape({
  el,
  ...rest
}: { el: Extract<SceneElement, { type: "image" }> } & Record<string, unknown>) {
  const img = useHtmlImage(el.src);
  return (
    <KonvaImage {...rest} image={img ?? undefined}
      x={el.x + el.width / 2} y={el.y + el.height / 2}
      offsetX={el.width / 2} offsetY={el.height / 2}
      width={el.width} height={el.height} rotation={el.rotation ?? 0} />
  );
}

function polyPoints(type: "diamond" | "triangle", w: number, h: number): number[] {
  if (type === "diamond") return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
  return [w / 2, 0, w, h, 0, h];
}

// Faint ruling color that reads on either light or dark paper.
function ruleColor(bg: string): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(bg.trim());
  let lum = 1;
  if (m) {
    const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
    lum = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return lum > 0.5 ? "rgba(70,90,120,0.16)" : "rgba(190,205,230,0.14)";
}

export default function DrawingCanvas(props: Props) {
  const {
    scene, backgroundColor, backgroundStyle, tool, color, fill, strokeWidth, snap,
    selectedId, onSelect, onChange, onRequestMath, onEditMath,
    onRequestTable, onEditTable, onRequestChart, onEditChart,
    onRequestGraph, onEditGraph, onRequestText, onEditText, onDrawComplete, stageRef,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [spacePan, setSpacePan] = useState(false);

  const [draft, setDraft] = useState<SceneElement | null>(null);
  const drawing = useRef(false);

  // Eraser: ids hidden during the current stroke, committed on release.
  const [erased, setErased] = useState<Set<string>>(new Set());
  const erasing = useRef(false);

  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Space = temporary pan (like every design tool).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === "Space" && t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSpacePan(true);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpacePan(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const panning = tool === "pan" || spacePan;

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, scene.elements, tool]);

  const commit = (elements: SceneElement[]) => onChange({ ...scene, elements });
  const updateElement = (id: string, patch: Partial<SceneElement>) => {
    commit(scene.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as SceneElement) : e)));
  };

  const snapV = (v: number) => (snap ? Math.round(v / GRID) * GRID : v);

  // World coordinates (accounts for pan + zoom).
  const worldPointer = (): { x: number; y: number } => {
    const p = stageRef.current?.getRelativePointerPosition();
    return { x: p?.x ?? 0, y: p?.y ?? 0 };
  };

  // --- Zoom ---
  const zoomAt = useCallback((factor: number, sx: number, sy: number) => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const wx = (sx - v.x) / v.scale;
      const wy = (sy - v.y) / v.scale;
      return { scale, x: sx - wx * scale, y: sy - wy * scale };
    });
  }, []);

  const zoomButton = (factor: number) => zoomAt(factor, size.width / 2, size.height / 2);
  const resetView = () => setView({ scale: 1, x: 0, y: 0 });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return;
    // Trackpad pinch arrives as ctrl+wheel; plain wheel/scroll pans.
    if (e.evt.ctrlKey || e.evt.metaKey) {
      zoomAt(e.evt.deltaY > 0 ? 0.94 : 1.06, p.x, p.y);
    } else {
      setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }));
    }
  };

  // --- Eraser ---
  const eraseAtPointer = () => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const node = stage!.getIntersection(pos);
    const id = node?.name();
    if (id && !erased.has(id)) setErased((prev) => new Set(prev).add(id));
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (panning) return; // stage handles the drag
    const clickedEmpty = e.target === e.target.getStage();

    if (tool === "select") {
      if (clickedEmpty) onSelect(null);
      return;
    }
    if (tool === "eraser") {
      erasing.current = true;
      setErased(new Set());
      eraseAtPointer();
      return;
    }

    const raw = worldPointer();
    const x = tool === "pen" ? raw.x : snapV(raw.x);
    const y = tool === "pen" ? raw.y : snapV(raw.y);
    if (tool === "math") return onRequestMath(x, y);
    if (tool === "table") return onRequestTable(x, y);
    if (tool === "chart") return onRequestChart(x, y);
    if (tool === "graph") return onRequestGraph(x, y);
    if (tool === "text") return onRequestText(x, y);

    drawing.current = true;
    if (tool === "pen") setDraft({ id: newId(), type: "stroke", points: [x, y], color, width: strokeWidth });
    else if (tool === "line") setDraft({ id: newId(), type: "line", points: [x, y, x, y], color, width: strokeWidth });
    else if (tool === "arrow") setDraft({ id: newId(), type: "arrow", points: [x, y, x, y], color, width: strokeWidth });
    else if (tool === "rect") setDraft({ id: newId(), type: "rect", x, y, width: 0, height: 0, stroke: color, fill, strokeWidth });
    else if (tool === "ellipse") setDraft({ id: newId(), type: "ellipse", x, y, radiusX: 0, radiusY: 0, stroke: color, fill, strokeWidth });
    else if (tool === "diamond" || tool === "triangle") setDraft({ id: newId(), type: tool, x, y, width: 0, height: 0, stroke: color, fill, strokeWidth });
  };

  const handleMouseMove = () => {
    if (erasing.current) { eraseAtPointer(); return; }
    if (!drawing.current || !draft) return;
    const raw = worldPointer();
    if (draft.type === "stroke") { setDraft({ ...draft, points: [...draft.points, raw.x, raw.y] }); return; }
    const x = snapV(raw.x), y = snapV(raw.y);
    if (draft.type === "line" || draft.type === "arrow") setDraft({ ...draft, points: [draft.points[0], draft.points[1], x, y] });
    else if (draft.type === "rect" || draft.type === "diamond" || draft.type === "triangle") setDraft({ ...draft, width: x - draft.x, height: y - draft.y });
    else if (draft.type === "ellipse") setDraft({ ...draft, radiusX: Math.abs(x - draft.x), radiusY: Math.abs(y - draft.y) });
  };

  const handleMouseUp = () => {
    if (erasing.current) {
      erasing.current = false;
      if (erased.size > 0) commit(scene.elements.filter((e) => !erased.has(e.id)));
      setErased(new Set());
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    if (draft) {
      const box = draft as { width?: number; height?: number };
      const tiny =
        ((draft.type === "rect" || draft.type === "diamond" || draft.type === "triangle") && box.width === 0 && box.height === 0) ||
        (draft.type === "ellipse" && draft.radiusX === 0 && draft.radiusY === 0) ||
        (draft.type === "stroke" && draft.points.length <= 2) ||
        ((draft.type === "line" || draft.type === "arrow") && draft.points[0] === draft.points[2] && draft.points[1] === draft.points[3]);
      if (!tiny) {
        let el = draft;
        if (el.type === "rect" || el.type === "diamond" || el.type === "triangle") {
          el = {
            ...el,
            x: el.width < 0 ? el.x + el.width : el.x,
            y: el.height < 0 ? el.y + el.height : el.y,
            width: Math.abs(el.width),
            height: Math.abs(el.height),
          };
        }
        commit([...scene.elements, el]);
        if (tool !== "pen") { onSelect(el.id); onDrawComplete(); }
      }
      setDraft(null);
    }
  };

  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      const st = e.target as Konva.Stage;
      setView((v) => ({ ...v, x: st.x(), y: st.y() }));
    }
  };

  const handleDragEnd = (el: SceneElement, node: Konva.Node) => {
    if (POINT_TYPES.has(el.type)) {
      const src = (el as { points: number[] }).points;
      const c = centroid(src);
      const dx = snapV(node.x() - c.x), dy = snapV(node.y() - c.y);
      const pts = src.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
      updateElement(el.id, { points: pts } as Partial<SceneElement>);
    } else if ("width" in el && "height" in el) {
      // rendered with a centre offset, so node position is the centre
      updateElement(el.id, { x: snapV(node.x() - el.width / 2), y: snapV(node.y() - el.height / 2) } as Partial<SceneElement>);
    } else {
      updateElement(el.id, { x: snapV(node.x()), y: snapV(node.y()) } as Partial<SceneElement>);
    }
  };

  const handleTransformEnd = (el: SceneElement, node: Konva.Node) => {
    const sx = node.scaleX(), sy = node.scaleY();
    const r = node.rotation();
    if (POINT_TYPES.has(el.type)) {
      // Bake the full transform (rotation + scale + translate) into the points.
      const t = node.getTransform();
      const src = (el as { points: number[] }).points;
      const pts: number[] = [];
      for (let i = 0; i < src.length; i += 2) { const p = t.point({ x: src[i], y: src[i + 1] }); pts.push(p.x, p.y); }
      node.rotation(0); node.scaleX(1); node.scaleY(1); node.offsetX(0); node.offsetY(0); node.position({ x: 0, y: 0 });
      updateElement(el.id, { points: pts, rotation: 0 } as Partial<SceneElement>);
      return;
    }
    node.scaleX(1); node.scaleY(1);
    if (el.type === "ellipse") {
      updateElement(el.id, { x: node.x(), y: node.y(), rotation: r, radiusX: Math.max(3, el.radiusX * sx), radiusY: Math.max(3, el.radiusY * sy) } as Partial<SceneElement>);
    } else if (el.type === "text") {
      updateElement(el.id, { x: node.x(), y: node.y(), rotation: r, fontSize: Math.max(6, el.fontSize * ((sx + sy) / 2)) } as Partial<SceneElement>);
    } else if ("width" in el && "height" in el) {
      const w = Math.max(5, el.width * sx), h = Math.max(5, el.height * sy);
      // node position is the centre (offset = half-size); convert back to top-left.
      updateElement(el.id, { x: node.x() - w / 2, y: node.y() - h / 2, width: w, height: h, rotation: r } as Partial<SceneElement>);
    }
  };

  const renderEl = (el: SceneElement) => {
    const selectable = tool === "select";
    const editById =
      el.type === "math" ? onEditMath : el.type === "table" ? onEditTable
      : el.type === "chart" ? onEditChart : el.type === "graph" ? onEditGraph
      : el.type === "text" ? onEditText : null;
    const rot = el.rotation ?? 0;
    const common = {
      name: el.id, // used by the eraser hit-test
      ref: (n: Konva.Node | null) => { if (n) nodeRefs.current.set(el.id, n); else nodeRefs.current.delete(el.id); },
      draggable: selectable,
      onClick: () => selectable && onSelect(el.id),
      onTap: () => selectable && onSelect(el.id),
      onDblClick: () => editById?.(el.id),
      onDblTap: () => editById?.(el.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el, e.target),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el, e.target),
    };
    // Box elements rotate around their centre (offset = half-size); point-based
    // rotate around the points' centroid.
    const box = "width" in el && "height" in el
      ? { x: el.x + el.width / 2, y: el.y + el.height / 2, offsetX: el.width / 2, offsetY: el.height / 2, rotation: rot }
      : null;

    switch (el.type) {
      case "stroke": {
        const c = centroid(el.points);
        return <Line key={el.id} {...common} points={el.points} x={c.x} y={c.y} offsetX={c.x} offsetY={c.y} rotation={rot}
          stroke={el.color} strokeWidth={el.width} hitStrokeWidth={Math.max(14, el.width)} lineCap="round" lineJoin="round" tension={0.4} />;
      }
      case "line": {
        const c = centroid(el.points);
        return <Line key={el.id} {...common} points={el.points} x={c.x} y={c.y} offsetX={c.x} offsetY={c.y} rotation={rot}
          stroke={el.color} strokeWidth={el.width} hitStrokeWidth={Math.max(14, el.width)} lineCap="round" />;
      }
      case "arrow": {
        const c = centroid(el.points);
        return <Arrow key={el.id} {...common} points={el.points} x={c.x} y={c.y} offsetX={c.x} offsetY={c.y} rotation={rot}
          stroke={el.color} fill={el.color} strokeWidth={el.width} hitStrokeWidth={Math.max(14, el.width)} pointerLength={10 + el.width} pointerWidth={8 + el.width} />;
      }
      case "rect":
        return <Rect key={el.id} {...common} {...box!} width={el.width} height={el.height} stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} />;
      case "ellipse":
        return <Ellipse key={el.id} {...common} x={el.x} y={el.y} rotation={rot} radiusX={el.radiusX} radiusY={el.radiusY} stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} />;
      case "diamond":
      case "triangle":
        return <Line key={el.id} {...common} {...box!} points={polyPoints(el.type, el.width, el.height)} closed stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} />;
      case "text":
        return <Text key={el.id} {...common} x={el.x} y={el.y} rotation={rot} text={el.text} fontSize={el.fontSize} fill={el.fill} />;
      case "image":
        return <ImageShape key={el.id} el={el} {...common} />;
      case "math":
        return <MathShape key={el.id} el={el} {...common} />;
      case "table":
        return <SvgImageShape key={el.id} svg={tableToSvg(el)} x={el.x} y={el.y} width={el.width} height={el.height} rotation={rot} {...common} />;
      case "chart":
        return <SvgImageShape key={el.id} svg={chartToSvg(el)} x={el.x} y={el.y} width={el.width} height={el.height} rotation={rot} {...common} />;
      case "graph":
        return <SvgImageShape key={el.id} svg={graphToSvg(el)} x={el.x} y={el.y} width={el.width} height={el.height} rotation={rot} {...common} />;
    }
  };

  // Paper + notebook ruling, in world space so it pans/zooms with content.
  // Adaptive spacing keeps on-screen line density readable at any zoom.
  const wl = -view.x / view.scale, wt = -view.y / view.scale;
  const ww = size.width / view.scale, wh = size.height / view.scale;
  const minPx = backgroundStyle === "dots" ? 20 : 15;
  let gs = GRID;
  while (gs * view.scale < minPx) gs *= 2;
  const lw = 1 / view.scale;
  const rc = ruleColor(backgroundColor);
  const xs: number[] = [], ys: number[] = [];
  if (backgroundStyle !== "blank") {
    for (let x = Math.floor(wl / gs) * gs; x < wl + ww; x += gs) xs.push(x);
    for (let y = Math.floor(wt / gs) * gs; y < wt + wh; y += gs) ys.push(y);
  }

  const cursor = panning ? "grab" : tool === "select" ? "default" : tool === "eraser" ? "cell" : "crosshair";
  const visible = erased.size ? scene.elements.filter((e) => !erased.has(e.id)) : scene.elements;

  return (
    <div ref={containerRef} className={styles.wrap} style={{ background: backgroundColor }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={view.scale}
        scaleY={view.scale}
        x={view.x}
        y={view.y}
        draggable={panning}
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        style={{ cursor }}
      >
        {/* One layer: paper + ruling + content, all in world space so pan/zoom
            move together. (Kept on a single layer for reliable compositing.) */}
        <Layer>
          <Rect x={wl} y={wt} width={ww} height={wh} fill={backgroundColor} listening={false} />
          {backgroundStyle === "grid" &&
            xs.map((x) => <Line key={`v${x}`} points={[x, wt, x, wt + wh]} stroke={rc} strokeWidth={lw} listening={false} />)}
          {(backgroundStyle === "grid" || backgroundStyle === "lines") &&
            ys.map((y) => <Line key={`h${y}`} points={[wl, y, wl + ww, y]} stroke={rc} strokeWidth={lw} listening={false} />)}
          {backgroundStyle === "dots" &&
            xs.flatMap((x) => ys.map((y) => <Circle key={`${x}_${y}`} x={x} y={y} radius={lw * 1.4} fill={rc} listening={false} />))}
          {visible.map(renderEl)}
          {draft && renderEl(draft)}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={6}
            ignoreStroke
            anchorSize={7}
            borderStroke="#b98a46"
            anchorStroke="#b98a46"
            anchorFill="#1a1c1f"
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>

      <div className={styles.zoom}>
        <button title="Zoom out" onClick={() => zoomButton(0.85)}>−</button>
        <button title="Reset to 100%" onClick={resetView} className={styles.zoomPct}>{Math.round(view.scale * 100)}%</button>
        <button title="Zoom in" onClick={() => zoomButton(1.15)}>+</button>
      </div>
    </div>
  );
}
