"use client";

import { useState } from "react";
import type { TableElement } from "@/lib/types";
import styles from "./EditorModals.module.css";

export type TableConfig = Pick<TableElement, "rows" | "cols" | "cells" | "headerRow">;

interface Props {
  initial: TableConfig;
  onSave: (cfg: TableConfig) => void;
  onCancel: () => void;
}

function resize(cells: string[][], rows: number, cols: number): string[][] {
  const next: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(cells[r]?.[c] ?? "");
    next.push(row);
  }
  return next;
}

export default function TableModal({ initial, onSave, onCancel }: Props) {
  const [rows, setRows] = useState(initial.rows);
  const [cols, setCols] = useState(initial.cols);
  const [headerRow, setHeaderRow] = useState(initial.headerRow);
  const [cells, setCells] = useState<string[][]>(resize(initial.cells, initial.rows, initial.cols));

  const setDim = (nextRows: number, nextCols: number) => {
    const r = Math.max(1, Math.min(20, nextRows));
    const c = Math.max(1, Math.min(12, nextCols));
    setRows(r);
    setCols(c);
    setCells((prev) => resize(prev, r, c));
  };

  const setCell = (r: number, c: number, v: string) => {
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = v;
      return next;
    });
  };

  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()} style={{ width: 640 }}>
        <div className={styles.head}>
          <span>▦ Insert table</span>
          <button className={styles.close} onClick={onCancel}>×</button>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Rows</span>
          <div className={styles.stepper}>
            <button className={styles.step} onClick={() => setDim(rows - 1, cols)}>−</button>
            <span>{rows}</span>
            <button className={styles.step} onClick={() => setDim(rows + 1, cols)}>+</button>
          </div>
          <span className={styles.label}>Columns</span>
          <div className={styles.stepper}>
            <button className={styles.step} onClick={() => setDim(rows, cols - 1)}>−</button>
            <span>{cols}</span>
            <button className={styles.step} onClick={() => setDim(rows, cols + 1)}>+</button>
          </div>
          <label className={styles.label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} />
            Header row
          </label>
        </div>

        <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cols}, minmax(84px, 1fr))` }}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((__, c) => (
              <input
                key={`${r}-${c}`}
                className={`${styles.cell} ${headerRow && r === 0 ? styles.cellHead : ""}`}
                value={cells[r]?.[c] ?? ""}
                placeholder={headerRow && r === 0 ? `Header ${c + 1}` : ""}
                onChange={(e) => setCell(r, c, e.target.value)}
              />
            )),
          )}
        </div>

        <div className={styles.foot}>
          <button className={styles.cancel} onClick={onCancel}>Cancel</button>
          <button className={styles.ok} onClick={() => onSave({ rows, cols, cells, headerRow })}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
