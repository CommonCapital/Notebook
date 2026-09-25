"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MATH_EXAMPLES, MATH_PALETTE, renderMath } from "@/lib/math";
import { evaluateConst } from "@/lib/plot";
import { symbolicCalc } from "@/lib/symbolic";
import styles from "./MathModal.module.css";

// Trim floating-point dust to a clean calculator-style number.
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(7)));
}

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

  // Auto-calculator. Symbolic calculus (d/dx …, ∫ … dx without bounds) takes
  // precedence and yields a formula; otherwise a constant expression is
  // evaluated to a number. Angle mode drives radians vs. degrees for trig.
  const [deg, setDeg] = useState(false);
  // Symbols the user flipped to "variable" (a function of the diff variable).
  const [varFlags, setVarFlags] = useState<Record<string, boolean>>({});
  const varSet = useMemo(
    () => new Set(Object.entries(varFlags).filter(([, on]) => on).map(([k]) => k)),
    [varFlags],
  );
  const sym = symbolicCalc(latex, varSet);
  const result = sym ? null : evaluateConst(latex, deg);
  const hasTrig = /(sin|cos|tan|cot|sec|csc|cosec)/i.test(latex);
  const appendResult = () =>
    setLatex((l) => l.trimEnd() + " = " + (sym ? sym.result : fmtNum(result!)));

  // Render the symbolic result with the same engine used on the canvas.
  const [symImg, setSymImg] = useState<string | null>(null);
  useEffect(() => {
    if (!sym) return;
    let cancelled = false;
    renderMath(sym.result, color)
      .then(({ dataUrl }) => { if (!cancelled) setSymImg(dataUrl); })
      .catch(() => { if (!cancelled) setSymImg(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym?.result, color]);

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

        {(sym || result !== null || hasTrig) && (
          <div className={sym ? `${styles.calc} ${styles.calcCol}` : styles.calc}>
            {sym ? (
              <>
                <div className={styles.calcMain}>
                  <span className={styles.calcLabel}>{sym.op === "derivative" ? `d/d${sym.variable}` : `∫ … d${sym.variable}`}</span>
                  {symImg ? (
                    <>
                      <span className={styles.calcResult}>=</span>
                      <img src={symImg} alt="result" className={styles.calcImg} />
                    </>
                  ) : (
                    <span className={styles.calcResult}>= {sym.result}</span>
                  )}
                  <button className={styles.calcInsert} onClick={appendResult}>append result</button>
                </div>
                {sym.op === "derivative" && sym.symbols.length > 0 && (
                  <div className={styles.symRow}>
                    <span className={styles.symHint}>function of {sym.variable}:</span>
                    {sym.symbols.map((s) => (
                      <button
                        key={s}
                        className={varFlags[s] ? styles.symOn : styles.symChip}
                        title={varFlags[s] ? `${s} varies with ${sym.variable} (chain rule)` : `${s} is constant`}
                        onClick={() => setVarFlags((f) => ({ ...f, [s]: !f[s] }))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.angleToggle} title="Angle unit for sin, cos, tan…">
                  <button className={!deg ? styles.angleOn : ""} onClick={() => setDeg(false)}>RAD</button>
                  <button className={deg ? styles.angleOn : ""} onClick={() => setDeg(true)}>DEG</button>
                </div>
                {result !== null && (
                  <>
                    <span className={styles.calcResult}>= {fmtNum(result)}</span>
                    <button className={styles.calcInsert} onClick={appendResult}>append “= {fmtNum(result)}”</button>
                  </>
                )}
              </>
            )}
          </div>
        )}

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
