"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PomodoroTimer.module.css";

type Mode = "focus" | "short" | "long";
const DEFAULTS = { focus: 25, short: 5, long: 15 };
const LABEL: Record<Mode, string> = { focus: "Focus", short: "Short break", long: "Long break" };

const pad = (n: number) => String(n).padStart(2, "0");

// A short, gentle chime via the Web Audio API — no asset needed.
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1174].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t); o.stop(t + 0.36);
    });
    setTimeout(() => ctx.close(), 900);
  } catch { /* audio may be blocked; ignore */ }
}

export default function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [durations, setDurations] = useState(DEFAULTS);
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.focus * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const endAt = useRef<number | null>(null);
  const loaded = useRef(false);

  // Persist settings (durations) across sessions.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("notebook.pomodoro");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.durations) { setDurations(s.durations); setSecondsLeft((s.durations.focus ?? 25) * 60); }
      }
    } catch { /* private mode etc. */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem("notebook.pomodoro", JSON.stringify({ durations })); } catch { /* ignore */ }
  }, [durations]);

  const total = durations[mode] * 60;

  const goto = useCallback((m: Mode, autostart: boolean) => {
    const secs = durations[m] * 60;
    setMode(m);
    setSecondsLeft(secs);
    if (autostart) { endAt.current = Date.now() + secs * 1000; setRunning(true); }
    else { endAt.current = null; setRunning(false); }
  }, [durations]);

  const complete = useCallback(() => {
    chime();
    if (mode === "focus") {
      const c = completed + 1;
      setCompleted(c);
      goto(c % 4 === 0 ? "long" : "short", true); // long break every 4 focuses
    } else {
      goto("focus", true);
    }
  }, [mode, completed, goto]);

  // Tick from a target timestamp (drift-free, survives tab throttling).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (endAt.current == null) return;
      const rem = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0) complete();
    }, 250);
    return () => clearInterval(id);
  }, [running, complete]);

  // Show the countdown in the browser tab while running.
  useEffect(() => {
    if (running) document.title = `${pad(Math.floor(secondsLeft / 60))}:${pad(secondsLeft % 60)} · ${LABEL[mode]}`;
    else document.title = "Notebook";
    return () => { document.title = "Notebook"; };
  }, [running, secondsLeft, mode]);

  const toggle = () => {
    if (running) { setRunning(false); endAt.current = null; }
    else { endAt.current = Date.now() + secondsLeft * 1000; setRunning(true); }
  };
  const reset = () => { setRunning(false); endAt.current = null; setSecondsLeft(total); };
  const skip = () => {
    if (mode === "focus") { const c = completed + 1; setCompleted(c); goto(c % 4 === 0 ? "long" : "short", false); }
    else goto("focus", false);
  };
  const setDur = (m: Mode, v: number) => {
    const val = Math.max(1, Math.min(180, Math.round(v) || 1));
    setDurations((d) => ({ ...d, [m]: val }));
    if (!running && mode === m) setSecondsLeft(val * 60);
  };

  const mmss = `${pad(Math.floor(secondsLeft / 60))}:${pad(secondsLeft % 60)}`;
  const pct = total > 0 ? Math.min(100, (1 - secondsLeft / total) * 100) : 0;

  if (!open) {
    return (
      <button className={`${styles.pill} ${styles[mode]} ${running ? styles.live : ""}`}
        onClick={() => setOpen(true)} title="Pomodoro study timer">
        <span className={styles.dot} />
        <span className={styles.pillTime}>{mmss}</span>
      </button>
    );
  }

  return (
    <div className={`${styles.card} ${styles[mode]}`}>
      <div className={styles.head}>
        <div className={styles.tabs}>
          {(["focus", "short", "long"] as Mode[]).map((m) => (
            <button key={m} className={m === mode ? styles.tabOn : styles.tab} onClick={() => goto(m, false)}>
              {m === "focus" ? "Focus" : m === "short" ? "Short" : "Long"}
            </button>
          ))}
        </div>
        <button className={styles.min} onClick={() => setOpen(false)} title="Minimise">–</button>
      </div>

      <div className={styles.time}>{mmss}</div>

      <div className={styles.controls}>
        <button className={styles.primary} onClick={toggle}>{running ? "Pause" : "Start"}</button>
        <button className={styles.sec} onClick={reset} title="Reset">↺</button>
        <button className={styles.sec} onClick={skip} title="Skip to next">⏭</button>
      </div>

      <div className={styles.progress}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>

      <div className={styles.foot}>
        <span className={styles.count}>🍅 {completed} focus done</span>
        <div className={styles.durs} title="Minutes">
          <label>F<input type="number" min={1} value={durations.focus} onChange={(e) => setDur("focus", +e.target.value)} /></label>
          <label>S<input type="number" min={1} value={durations.short} onChange={(e) => setDur("short", +e.target.value)} /></label>
          <label>L<input type="number" min={1} value={durations.long} onChange={(e) => setDur("long", +e.target.value)} /></label>
        </div>
      </div>
    </div>
  );
}
