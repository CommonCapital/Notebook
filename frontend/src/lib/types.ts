// The vector scene model. Every drawing capability is just another element
// `type`, so adding a feature never touches the backend schema — the API
// stores this whole object as an opaque JSON blob.

export type ElementType =
  | "stroke"   // freehand pen
  | "line"     // straight line
  | "arrow"    // straight line with an arrowhead
  | "rect"
  | "ellipse"
  | "diamond"  // flowchart decision node
  | "triangle"
  | "text"
  | "image"
  | "math"     // LaTeX formula, rendered to SVG
  | "table"    // structured grid, rendered to SVG
  | "chart";   // bar/line/pie, rendered to SVG

export interface BaseElement {
  id: string;
  type: ElementType;
}

export interface StrokeElement extends BaseElement {
  type: "stroke";
  points: number[]; // flat [x0,y0,x1,y1,...]
  color: string;
  width: number;
}

export interface LineElement extends BaseElement {
  type: "line";
  points: [number, number, number, number]; // [x1,y1,x2,y2]
  color: string;
  width: number;
}

export interface RectElement extends BaseElement {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string; // "transparent" for outline-only
  strokeWidth: number;
}

export interface EllipseElement extends BaseElement {
  type: "ellipse";
  x: number; // center
  y: number; // center
  radiusX: number;
  radiusY: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface TextElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
}

export interface ImageElement extends BaseElement {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // data: URI
}

export interface ArrowElement extends BaseElement {
  type: "arrow";
  points: [number, number, number, number]; // [x1,y1,x2,y2]
  color: string;
  width: number;
}

// Diamond and triangle share the rect-style bounding box.
export interface PolyElement extends BaseElement {
  type: "diamond" | "triangle";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface MathElement extends BaseElement {
  type: "math";
  x: number;
  y: number;
  width: number;
  height: number;
  latex: string; // the source; SVG is rendered from this on the client
  color: string;
}

export interface TableElement extends BaseElement {
  type: "table";
  x: number;
  y: number;
  width: number;
  height: number;
  rows: number;
  cols: number;
  cells: string[][]; // [row][col]
  headerRow: boolean;
  textColor: string;
  borderColor: string;
  headerFill: string;
}

export type ChartType = "bar" | "line" | "pie";

export interface ChartElement extends BaseElement {
  type: "chart";
  x: number;
  y: number;
  width: number;
  height: number;
  chartType: ChartType;
  title: string;
  data: { label: string; value: number }[];
}

export type SceneElement =
  | StrokeElement
  | LineElement
  | ArrowElement
  | RectElement
  | EllipseElement
  | PolyElement
  | TextElement
  | ImageElement
  | MathElement
  | TableElement
  | ChartElement;

export interface Scene {
  elements: SceneElement[];
}

// ---- API shapes ----

export interface FileSummary {
  id: number;
  name: string;
  folderId: number | null;
  backgroundColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileDetail extends FileSummary {
  scene: Scene;
}

export interface Folder {
  id: number;
  name: string;
  parentFolderId: number | null;
  createdAt: string;
  updatedAt: string;
}

export const emptyScene = (): Scene => ({ elements: [] });
