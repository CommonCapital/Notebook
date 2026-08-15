"use client";

import { useState } from "react";
import type { ChartElement, ChartType } from "@/lib/types";
import styles from "./EditorModals.module.css";

export type ChartConfig = Pick<ChartElement, "chartType" | "title" | "data">;

interface Props {
  initial: ChartConfig;
  onSave: (cfg: ChartConfig) => void;
  onCancel: () => void;
}

const TYPES: { id: ChartType; label: string }[] = [
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "scatter", label: "Scatter" },
  { id: "pie", label: "Pie" },
];

export default function ChartModal({ initial, onSave, onCancel }: Props) {
  const [chartType, setChartType] = useState<ChartType>(initial.chartType);
  const [title, setTitle] = useState(initial.title);
  const [data, setData] = useState(initial.data);

  const setPoint = (i: number, key: "label" | "value", v: string) => {
    setData((prev) =>
      prev.map((d, idx) =>
        idx === i ? { ...d, [key]: key === "value" ? Number(v) || 0 : v } : d,
      ),
    );
  };

  const addPoint = () => setData((prev) => [...prev, { label: `Item ${prev.length + 1}`, value: 0 }]);
  const removePoint = (i: number) => setData((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span>📊 Insert chart</span>
          <button className={styles.close} onClick={onCancel}>×</button>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Type</span>
          <div className={styles.seg}>
            {TYPES.map((t) => (
              <button key={t.id}
                className={`${styles.segBtn} ${chartType === t.id ? styles.active : ""}`}
                onClick={() => setChartType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Title</span>
          <input className={`${styles.text} ${styles.textFull}`} value={title}
            placeholder="Chart title" onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <span className={styles.label}>Data</span>
          <div style={{ marginTop: 6 }}>
            {data.map((d, i) => (
              <div key={i} className={styles.dataRow}>
                <input className={`${styles.text} ${styles.textFull}`} value={d.label}
                  placeholder="Label" onChange={(e) => setPoint(i, "label", e.target.value)} />
                <input className={`${styles.num}`} type="number" value={d.value}
                  onChange={(e) => setPoint(i, "value", e.target.value)} />
                <button className={styles.del} title="Remove" onClick={() => removePoint(i)}>×</button>
              </div>
            ))}
            <button className={styles.addRow} onClick={addPoint}>+ Add data point</button>
          </div>
        </div>

        <div className={styles.foot}>
          <button className={styles.cancel} onClick={onCancel}>Cancel</button>
          <button className={styles.ok}
            onClick={() => onSave({ chartType, title: title.trim(), data })}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
