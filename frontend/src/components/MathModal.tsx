"use client";

import { useEffect, useRef, useState } from "react";
import { MATH_EXAMPLES, MATH_PALETTE, renderMath } from "@/lib/math";
import styles from "./MathModal.module.css";

interface Props {
  initialLatex: string;
  color: string;
  onSave: (latex: string) => void;
  onCancel: () => void;
}

export default function MathModal({ initialLatex, color, onSave, onCancel }: Props) {
  const [latex, setLatex] = useState(initialLatex);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Live preview, debounced. Same renderer that lands on the canvas.
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!latex.trim()) {
        setPreview(null);
        setError(null);
        return;
      }
      try {
        const { dataUrl } = await renderMath(latex, color);
        setPreview(dataUrl);
        setError(null);
      } catch (e) {
        setError((e as Error).message || "Invalid LaTeX");
      }
    }, 200);
    return () => clearTimeout(t);
  }, [latex, color]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Insert a snippet at the cursor; `${}` marks where the caret should land.
  const insert = (snippet: string) => {
    const ta = taRef.current;
    const caret = snippet.indexOf("${}");
    const clean = snippet.replace("${}", "");
    if (!ta) {
      setLatex((l) => l + clean);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = latex.slice(0, start) + clean + latex.slice(end);
    setLatex(next);
    const pos = caret >= 0 ? start + caret : start + clean.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const save = () => {
    if (latex.trim()) onSave(latex.trim());
    else onCancel();
  };

  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span>∑ Insert math formula (LaTeX)</span>
          <button className={styles.close} onClick={onCancel}>×</button>
        </div>

        <div className={styles.previewBox}>
          {preview ? (
            <img src={preview} alt="formula preview" className={styles.previewImg} />
          ) : error ? (
            <span className={styles.err}>⚠ {error}</span>
          ) : (
            <span className={styles.hint}>Your formula preview appears here</span>
          )}
        </div>

        <textarea
          ref={taRef}
          className={styles.input}
          value={latex}
          spellCheck={false}
          placeholder="e.g.  \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") onCancel();
          }}
        />

        <div className={styles.palette}>
          {MATH_PALETTE.map((grp) => (
            <div key={grp.group} className={styles.group}>
              <span className={styles.groupLabel}>{grp.group}</span>
              <div className={styles.keys}>
                {grp.items.map((it) => (
                  <button key={it.label} className={styles.key} title={it.title}
                    onClick={() => insert(it.insert)}>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.examples}>
          <span className={styles.groupLabel}>Examples</span>
          {MATH_EXAMPLES.map((ex) => (
            <button key={ex.label} className={styles.example}
              onClick={() => setLatex(ex.latex)}>
              {ex.label}
            </button>
          ))}
        </div>

        <div className={styles.foot}>
          <span className={styles.tip}>Tip: ⌘/Ctrl + Enter to insert</span>
          <div className={styles.footBtns}>
            <button className={styles.cancel} onClick={onCancel}>Cancel</button>
            <button className={styles.ok} onClick={save}>Insert</button>
          </div>
        </div>
      </div>
    </div>
  );
}
