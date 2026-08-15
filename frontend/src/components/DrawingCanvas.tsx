"use client";

import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Arrow,
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type { Scene, SceneElement } from "@/lib/types";
import { chartToSvg, tableToSvg } from "@/lib/generate";
import { newId } from "@/lib/id";
import MathShape from "./MathShape";
import SvgImageShape from "./SvgImageShape";

export type Tool =
  | "select" | "pen" | "line" | "arrow"
  | "rect" | "ellipse" | "diamond" | "triangle"
  | "text" | "math" | "table" | "chart";

// Tools whose geometry is point-based (no transformer resize; drag shifts points).
const POINT_TOOLS = new Set(["stroke", "line", "arrow"]);

interface Props {
  scene: Scene;
  backgroundColor: string;
  tool: Tool;
  color: string;
  fill: string;
  strokeWidth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (scene: Scene) => void;
  onRequestMath: (x: number, y: number) => void;
  onEditMath: (id: string) => void;
  onRequestTable: (x: number, y: number) => void;
  onEditTable: (id: string) => void;
  onRequestChart: (x: number, y: number) => void;
  onEditChart: (id: string) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
}

// Loads a data-URI into an HTMLImageElement so Konva can draw it.
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
    <KonvaImage image={img ?? undefined} x={el.x} y={el.y} width={el.width} height={el.height} {...rest} />
  );
}

// Local polygon points for diamond/triangle in a 0..w by 0..h box.
function polyPoints(type: "diamond" | "triangle", w: number, h: number): number[] {
  if (type === "diamond") return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
  return [w / 2, 0, w, h, 0, h]; // triangle
}

export default function DrawingCanvas({
  scene,
  backgroundColor,
  tool,
  color,
  fill,
  strokeWidth,
  selectedId,
  onSelect,
  onChange,
  onRequestMath,
  onEditMath,
  onRequestTable,
  onEditTable,
  onRequestChart,
  onEditChart,
  stageRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const [draft, setDraft] = useState<SceneElement | null>(null);
  const drawing = useRef(false);

  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wire the transformer to the currently selected (resizable) node.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    const el = scene.elements.find((e) => e.id === selectedId);
    const resizable = el && !POINT_TOOLS.has(el.type);
    tr.nodes(node && resizable ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, scene.elements]);

  const commit = (elements: SceneElement[]) => onChange({ elements });

  const updateElement = (id: string, patch: Partial<SceneElement>) => {
    commit(scene.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as SceneElement) : e)));
  };

  const pointer = (): { x: number; y: number } => {
    const p = stageRef.current?.getPointerPosition();
    return { x: p?.x ?? 0, y: p?.y ?? 0 };
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedEmpty = e.target === e.target.getStage();
    if (tool === "select") {
      if (clickedEmpty) onSelect(null);
      return;
    }

    const { x, y } = pointer();

    // Modal-created elements.
    if (tool === "math") return onRequestMath(x, y);
    if (tool === "table") return onRequestTable(x, y);
    if (tool === "chart") return onRequestChart(x, y);

    if (tool === "text") {
      const text = window.prompt("Text:");
      if (text) {
        const el: SceneElement = { id: newId(), type: "text", x, y, text, fontSize: 24, fill: color };
        commit([...scene.elements, el]);
        onSelect(el.id);
      }
      return;
    }

    drawing.current = true;
    if (tool === "pen") {
      setDraft({ id: newId(), type: "stroke", points: [x, y], color, width: strokeWidth });
    } else if (tool === "line") {
      setDraft({ id: newId(), type: "line", points: [x, y, x, y], color, width: strokeWidth });
    } else if (tool === "arrow") {
      setDraft({ id: newId(), type: "arrow", points: [x, y, x, y], color, width: strokeWidth });
    } else if (tool === "rect") {
      setDraft({ id: newId(), type: "rect", x, y, width: 0, height: 0, stroke: color, fill, strokeWidth });
    } else if (tool === "ellipse") {
      setDraft({ id: newId(), type: "ellipse", x, y, radiusX: 0, radiusY: 0, stroke: color, fill, strokeWidth });
    } else if (tool === "diamond" || tool === "triangle") {
      setDraft({ id: newId(), type: tool, x, y, width: 0, height: 0, stroke: color, fill, strokeWidth });
    }
  };

  const handleMouseMove = () => {
    if (!drawing.current || !draft) return;
    const { x, y } = pointer();

    if (draft.type === "stroke") {
      setDraft({ ...draft, points: [...draft.points, x, y] });
    } else if (draft.type === "line" || draft.type === "arrow") {
      setDraft({ ...draft, points: [draft.points[0], draft.points[1], x, y] });
    } else if (draft.type === "rect" || draft.type === "diamond" || draft.type === "triangle") {
      setDraft({ ...draft, width: x - draft.x, height: y - draft.y });
    } else if (draft.type === "ellipse") {
      setDraft({ ...draft, radiusX: Math.abs(x - draft.x), radiusY: Math.abs(y - draft.y) });
    }
  };

  const handleMouseUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (draft) {
      const box = draft as { width?: number; height?: number };
      const tiny =
        ((draft.type === "rect" || draft.type === "diamond" || draft.type === "triangle") &&
          box.width === 0 && box.height === 0) ||
        (draft.type === "ellipse" && draft.radiusX === 0 && draft.radiusY === 0) ||
        (draft.type === "stroke" && draft.points.length <= 2) ||
        ((draft.type === "line" || draft.type === "arrow") &&
          draft.points[0] === draft.points[2] && draft.points[1] === draft.points[3]);

      if (!tiny) {
        let el = draft;
        // Normalize negative-size boxes so x/y is always top-left.
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
        if (tool !== "pen") onSelect(el.id);
      }
      setDraft(null);
    }
  };

  const handleDragEnd = (el: SceneElement, node: Konva.Node) => {
    if (el.type === "stroke" || el.type === "line" || el.type === "arrow") {
      const dx = node.x();
      const dy = node.y();
      const shifted = el.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
      node.position({ x: 0, y: 0 });
      updateElement(el.id, { points: shifted } as Partial<SceneElement>);
    } else {
      updateElement(el.id, { x: node.x(), y: node.y() } as Partial<SceneElement>);
    }
  };

  const handleTransformEnd = (el: SceneElement, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    if (el.type === "ellipse") {
      updateElement(el.id, {
        x: node.x(), y: node.y(),
        radiusX: Math.max(3, el.radiusX * scaleX),
        radiusY: Math.max(3, el.radiusY * scaleY),
      } as Partial<SceneElement>);
    } else if (el.type === "text") {
      updateElement(el.id, {
        x: node.x(), y: node.y(),
        fontSize: Math.max(6, el.fontSize * scaleY),
      } as Partial<SceneElement>);
    } else if ("width" in el && "height" in el) {
      // rect, diamond, triangle, image, math, table, chart
      updateElement(el.id, {
        x: node.x(), y: node.y(),
        width: Math.max(5, el.width * scaleX),
        height: Math.max(5, el.height * scaleY),
      } as Partial<SceneElement>);
    }
  };

  const renderEl = (el: SceneElement) => {
    const selectable = tool === "select";
    const editById =
      el.type === "math" ? onEditMath
      : el.type === "table" ? onEditTable
      : el.type === "chart" ? onEditChart
      : null;
    const common = {
      ref: (n: Konva.Node | null) => {
        if (n) nodeRefs.current.set(el.id, n);
        else nodeRefs.current.delete(el.id);
      },
      draggable: selectable,
      onClick: () => selectable && onSelect(el.id),
      onTap: () => selectable && onSelect(el.id),
      onDblClick: () => editById?.(el.id),
      onDblTap: () => editById?.(el.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el, e.target),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el, e.target),
    };

    switch (el.type) {
      case "stroke":
        return <Line key={el.id} {...common} points={el.points} stroke={el.color}
          strokeWidth={el.width} lineCap="round" lineJoin="round" tension={0.4} />;
      case "line":
        return <Line key={el.id} {...common} points={el.points} stroke={el.color}
          strokeWidth={el.width} lineCap="round" />;
      case "arrow":
        return <Arrow key={el.id} {...common} points={el.points} stroke={el.color}
          fill={el.color} strokeWidth={el.width} pointerLength={10 + el.width} pointerWidth={8 + el.width} />;
      case "rect":
        return <Rect key={el.id} {...common} x={el.x} y={el.y} width={el.width} height={el.height}
          stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} />;
      case "ellipse":
        return <Ellipse key={el.id} {...common} x={el.x} y={el.y} radiusX={el.radiusX} radiusY={el.radiusY}
          stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} />;
      case "diamond":
      case "triangle":
        return <Line key={el.id} {...common} x={el.x} y={el.y}
          points={polyPoints(el.type, el.width, el.height)} closed
          stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} />;
      case "text":
        return <Text key={el.id} {...common} x={el.x} y={el.y} text={el.text}
          fontSize={el.fontSize} fill={el.fill} />;
      case "image":
        return <ImageShape key={el.id} el={el} {...common} />;
      case "math":
        return <MathShape key={el.id} el={el} {...common} />;
      case "table":
        return <SvgImageShape key={el.id} svg={tableToSvg(el)} x={el.x} y={el.y}
          width={el.width} height={el.height} {...common} />;
      case "chart":
        return <SvgImageShape key={el.id} svg={chartToSvg(el)} x={el.x} y={el.y}
          width={el.width} height={el.height} {...common} />;
    }
  };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
      >
        <Layer>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={backgroundColor} listening={false} />
        </Layer>
        <Layer>
          {scene.elements.map(renderEl)}
          {draft && renderEl(draft)}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            ignoreStroke
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
