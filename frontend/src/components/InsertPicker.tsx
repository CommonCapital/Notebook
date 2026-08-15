"use client";

import { useState } from "react";
import { STENCILS, STENCIL_CATEGORIES, stencilDataUrl, type Stencil } from "@/lib/stencils";
import { TEMPLATES, type Template } from "@/lib/templates";
import styles from "./InsertPicker.module.css";

export default function InsertPicker({
  onInsertStencil,
  onInsertTemplate,
  onClose,
}: {
  onInsertStencil: (s: Stencil) => void;
  onInsertTemplate: (t: Template) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"stencils" | "templates">("stencils");

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.tabs}>
            <button className={tab === "stencils" ? styles.tabActive : styles.tab} onClick={() => setTab("stencils")}>Stencils</button>
            <button className={tab === "templates" ? styles.tabActive : styles.tab} onClick={() => setTab("templates")}>Templates</button>
          </div>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        {tab === "stencils" ? (
          <div className={styles.body}>
            {STENCIL_CATEGORIES.map((cat) => (
              <div key={cat}>
                <div className={styles.cat}>{cat}</div>
                <div className={styles.grid}>
                  {STENCILS.filter((s) => s.category === cat).map((s) => (
                    <button key={s.id} className={styles.cell} title={s.label}
                      onClick={() => onInsertStencil(s)}>
                      <img src={stencilDataUrl(s)} alt={s.label} />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.templates}>
              {TEMPLATES.map((t) => (
                <button key={t.id} className={styles.template} onClick={() => onInsertTemplate(t)}>
                  <span className={styles.tName}>{t.label}</span>
                  <span className={styles.tDesc}>{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
