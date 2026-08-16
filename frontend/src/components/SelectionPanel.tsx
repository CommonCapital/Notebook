"use client";

import type { SceneElement } from "@/lib/types";
import styles from "./SelectionPanel.module.css";

// Floating controls for the selected element — resize/restyle after placement,
// complementing the drag handles on the canvas.
export default function SelectionPanel({
  el,
  onUpdate,
}: {
  el: SceneElement;
  onUpdate: (patch: Partial<SceneElement>) => void;
}) {
  const upd = (patch: Record<string, unknown>) => onUpdate(patch as Partial<SceneElement>);

  const numBox = (label: string, value: number, apply: (v: number) => void, min = 1) => (
    <label className={styles.field} key={label}>
      <span>{label}</span>
      <input type="number" min={min} value={Math.round(value)}
        onChange={(e) => apply(Math.max(min, Number(e.target.value)))} />
    </label>
  );
  const colorBox = (label: string, value: string, key: string) => (
    <label className={styles.field} key={label}>
      <span>{label}</span>
      <input type="color" value={value === "transparent" ? "#ffffff" : value}
        onChange={(e) => upd({ [key]: e.target.value })} />
    </label>
  );

  const controls: React.ReactNode[] = [];
  switch (el.type) {
    case "text":
      controls.push(numBox("Font", el.fontSize, (v) => upd({ fontSize: v }), 6), colorBox("Colour", el.fill, "fill"));
      break;
    case "ellipse":
      controls.push(
        numBox("W", el.radiusX * 2, (v) => upd({ radiusX: v / 2 }), 4),
        numBox("H", el.radiusY * 2, (v) => upd({ radiusY: v / 2 }), 4),
        numBox("Weight", el.strokeWidth, (v) => upd({ strokeWidth: v })),
        colorBox("Stroke", el.stroke, "stroke"), colorBox("Fill", el.fill, "fill"),
      );
      break;
    case "stroke":
    case "line":
    case "arrow":
      controls.push(numBox("Weight", el.width, (v) => upd({ width: v })), colorBox("Colour", el.color, "color"));
      break;
    case "rect":
    case "diamond":
    case "triangle":
      controls.push(
        numBox("W", el.width, (v) => upd({ width: v }), 5),
        numBox("H", el.height, (v) => upd({ height: v }), 5),
        numBox("Weight", el.strokeWidth, (v) => upd({ strokeWidth: v })),
        colorBox("Stroke", el.stroke, "stroke"), colorBox("Fill", el.fill, "fill"),
      );
      break;
    default: // image, math, table, chart, graph
      controls.push(
        numBox("W", el.width, (v) => upd({ width: v }), 5),
        numBox("H", el.height, (v) => upd({ height: v }), 5),
      );
  }

  return (
    <div className={styles.panel}>
      <span className={styles.type}>{el.type}</span>
      {controls}
      <label className={styles.field} key="rotation">
        <span>Angle°</span>
        <input type="number" value={Math.round(el.rotation ?? 0)}
          onChange={(e) => upd({ rotation: Number(e.target.value) })} />
      </label>
    </div>
  );
}
