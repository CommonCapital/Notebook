// Starter templates — a template is just a set of scene elements laid out for a
// common figure. Inserted into the current canvas at an offset. Fresh ids each time.

import { newId } from "./id";
import { STENCILS, stencilDataUrl } from "./stencils";
import type { SceneElement } from "./types";

const INK = "#1f2937";

function stencilImage(id: string, x: number, y: number, scale = 1): SceneElement | null {
  const s = STENCILS.find((v) => v.id === id);
  if (!s) return null;
  return { id: newId(), type: "image", x, y, width: s.w * scale, height: s.h * scale, src: stencilDataUrl(s) };
}
const text = (x: number, y: number, t: string, fontSize = 16): SceneElement =>
  ({ id: newId(), type: "text", x, y, text: t, fontSize, fill: INK });
const arrow = (x1: number, y1: number, x2: number, y2: number): SceneElement =>
  ({ id: newId(), type: "arrow", points: [x1, y1, x2, y2], color: INK, width: 2 });
const rect = (x: number, y: number, w: number, h: number, strokeWidth = 2): SceneElement =>
  ({ id: newId(), type: "rect", x, y, width: w, height: h, stroke: INK, fill: "transparent", strokeWidth });
const circle = (cx: number, cy: number, r: number, fill = "transparent"): SceneElement =>
  ({ id: newId(), type: "ellipse", x: cx, y: cy, radiusX: r, radiusY: r, stroke: INK, fill, strokeWidth: 2 });
const line = (x1: number, y1: number, x2: number, y2: number): SceneElement =>
  ({ id: newId(), type: "line", points: [x1, y1, x2, y2], color: "#9aa2ad", width: 1 });

function systemArchitecture(): SceneElement[] {
  const els: SceneElement[] = [];
  const push = (e: SceneElement | null) => e && els.push(e);
  push(stencilImage("client", 60, 180));
  push(text(72, 280, "Client"));
  push(stencilImage("loadbalancer", 240, 175));
  push(text(238, 280, "Load balancer"));
  push(stencilImage("service", 440, 100));
  push(text(452, 200, "Service A"));
  push(stencilImage("service", 440, 260));
  push(text(452, 360, "Service B"));
  push(stencilImage("database", 640, 175));
  push(text(648, 280, "Database"));
  push(arrow(160, 215, 235, 215));
  push(arrow(340, 205, 435, 150));
  push(arrow(340, 235, 435, 300));
  push(arrow(540, 150, 635, 205));
  push(arrow(540, 300, 635, 230));
  return els;
}

function neuralNet(): SceneElement[] {
  const els: SceneElement[] = [];
  const layers = [4, 5, 3];
  const colX = [140, 320, 500];
  const r = 18;
  const positions: [number, number][][] = layers.map((count, li) => {
    const gap = 70;
    const top = 200 - ((count - 1) * gap) / 2;
    return Array.from({ length: count }, (_, i) => [colX[li], top + i * gap] as [number, number]);
  });
  // connections first (behind nodes)
  for (let li = 0; li < layers.length - 1; li++)
    for (const [x1, y1] of positions[li])
      for (const [x2, y2] of positions[li + 1]) els.push(line(x1, y1, x2, y2));
  // nodes
  positions.forEach((layer, li) =>
    layer.forEach(([x, y]) => els.push(circle(x, y, r, li === 0 ? "#eef2f7" : "transparent"))));
  els.push(text(105, 90, "Input"));
  els.push(text(292, 90, "Hidden"));
  els.push(text(478, 90, "Output"));
  return els;
}

function blueprint(): SceneElement[] {
  const els: SceneElement[] = [];
  els.push(rect(60, 60, 760, 470, 3)); // outer border
  els.push(rect(76, 76, 728, 438, 1)); // inner border
  // title block bottom-right
  els.push(rect(560, 440, 244, 74, 2));
  els.push(line(560, 465, 804, 465));
  els.push(line(560, 490, 804, 490));
  els.push(line(680, 440, 680, 514));
  els.push(text(568, 458, "PROJECT", 11));
  els.push(text(688, 458, "DRAWING NO.", 11));
  els.push(text(568, 483, "SCALE", 11));
  els.push(text(688, 483, "DATE", 11));
  els.push(text(568, 508, "DRAWN BY", 11));
  els.push(text(688, 508, "SHEET  1/1", 11));
  return els;
}

export interface Template {
  id: string;
  label: string;
  description: string;
  build: () => SceneElement[];
}

export const TEMPLATES: Template[] = [
  { id: "arch", label: "System architecture", description: "Client → LB → services → database", build: systemArchitecture },
  { id: "nn", label: "Neural network", description: "Fully-connected 4·5·3 diagram", build: neuralNet },
  { id: "blueprint", label: "Blueprint sheet", description: "Border + title block", build: blueprint },
];
