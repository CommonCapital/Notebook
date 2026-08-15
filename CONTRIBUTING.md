# Contributing to Notebook

**Notebook is an engineer's canvas for STEM.** One canvas where a CS
student diagrams a distributed system, a mechanical engineer draws a blueprint, a
physicist writes a nuclear reaction, a chemist sketches a benzene ring, and a math
student plots a function — all synced, all exportable.

This document is both a **roadmap** and a **how-to for adding features**. If you
are a student, engineer, or researcher: tell us what you actually need for your
work and build the smallest thing that unblocks it. That is the whole point.

---

## Why this codebase is easy to extend

Everything on the canvas is a typed **element** in a JSON `scene`
(`frontend/src/lib/types.ts`). The backend stores that scene as an opaque JSON
blob, so **adding a feature almost never touches the server or the database.**

There are three proven patterns for a new element — pick the closest one:

| Pattern | Use it for | Reference files |
|---|---|---|
| **Konva shape** | Anything drawn with primitives (lines, polygons, handles) | `stroke`, `line`, `arrow`, `rect`, `diamond` in `DrawingCanvas.tsx` |
| **Generated SVG → image** | Data → a picture (charts, tables, plots, diagrams) | `chart`/`table` via `lib/generate.ts` + `SvgImageShape.tsx` |
| **Async render → image** | An external engine produces the visual | `math` via `lib/math.ts` (MathJax) + `MathShape.tsx` |

Because every element renders into the same Konva stage, it automatically works
with select/move/resize, undo/redo, autosave, and **all export formats**
(PNG/JPG/PDF/HTML/PPTX). Keep it that way: if you can't render it into the stage,
it won't export.

---

## What already works (please don't rebuild these)

The **LaTeX math element** (the `∑` tool) already covers a surprising amount of
"STEM notation." It uses MathJax with the `ams` and `mhchem` packages. Copy any
of these into the formula editor:

- **Physics:** `E = mc^2`, `E^2 = (pc)^2 + (mc^2)^2`
- **Nuclear (mhchem):** `\ce{^{6}_{3}Li + ^{1}_{0}n -> ^{3}_{1}H + ^{4}_{2}He} + 4.8\,\text{MeV}`
- **Chemistry (mhchem):** `\ce{2H2 + O2 -> 2H2O}`, `\ce{CH3COOH <=> CH3COO^- + H+}`
- **Matrices:** `\begin{bmatrix} a & b \\ c & d \end{bmatrix}`
- **Sets / functions:** `G : \mathbb{R}^n \to [0,1]`, `\forall x \in \mathbb{R}`
- **Calculus / operators:** `\nabla \times \vec{B} = \mu_0 \vec{J}`

Also already shipping: files **and folders**, pen/line/**arrow**/rect/ellipse/
**diamond**/**triangle**, text, images, **tables**, **charts** (bar/line/pie),
undo/redo, PDF/image/scene **import**, and PNG/JPG/PDF/HTML/PPTX **export**.

So the frontier is **new domains**, not re-doing notation.

---

## Roadmap

### Tier 1 — Frontend-only, great first contributions

These need no backend and follow an existing pattern. High impact.

- **Function grapher (Desmos-style)** — a `graph` element: plot `y = f(x)`,
  multiple curves, domain/range, gridlines, zoom. Parse expressions with a small
  evaluator (e.g. `mathjs`) and emit an SVG plot via the `generate.ts` pattern.
  Later: implicit curves, parametric, polar, sliders for parameters.
- **Connectors / smart arrows** — arrows that *attach* to shapes and re-route
  when the shape moves. This is the backbone of good architecture diagrams.
- **Shape stencils / icon library** — drag-in symbols for **system architecture**
  (client, server, database, queue, cache, load balancer, CDN), **blueprints**
  (walls, doors, dimensions), **circuits** (resistor, capacitor, ground).
- **Templates** — start-from blank alternatives: "System architecture",
  "Neural-network diagram", "Blueprint (title block + grid)", "Free-body diagram".
- **More chart types** — scatter, stacked/grouped bar, area, with axis titles.
- **Editing quality-of-life** — grouping, alignment guides, snap-to-grid,
  a layers panel, multi-select, copy/paste, rich text.

### Tier 2 — Bigger frontend, or a domain library

- **2D chemical structures (organic chemistry)** — draw molecules or render from
  SMILES/MOL. Consider a JS cheminformatics/depiction library; store the
  structure string in the element and render to SVG.
- **"Beautiful system figures"** — a diagram mode with **auto-layout** (integrate
  `elk.js` or `dagre`) so a described graph lays out cleanly. Goal: reproduce
  publication-quality figures (e.g. the Transformer architecture from *Attention
  Is All You Need*) from a compact spec, not by hand-nudging boxes.
- **Blueprint mode** — real units, scale, dimension lines, snapping, a title block.
- **Circuit / logic-gate diagrams** with a netlist.
- **Presentation mode & multi-page canvases** — multi-page PDF/PPTX export.

### Tier 3 — Simulations (needs compute; C++ microservices)

The heavy, exciting stuff. These don't run well in a plain browser tab, so the
plan is: **compute in C++ services, render/animate in the frontend.**

Candidate simulations:
- **2D/3D physics:** particle systems, N-body gravity (a black hole absorbing a
  star), springs, pendulums, cloth, rigid bodies, simple fluids.
- **Chemistry:** reaction kinetics, molecular dynamics.
- **Biophysics:** heartbeat / action-potential (Hodgkin–Huxley) models.

Proposed architecture:
- A `simulation` element stores only a **spec** (parameters, initial conditions) —
  small, syncs and saves like any element.
- A **C++ microservice** (e.g. Eigen for linear algebra, optionally CUDA/OpenMP
  for parallelism) computes frames and exposes them over gRPC/REST or a WebSocket
  stream. Heavy jobs are queued; results can be cached by spec hash.
- The frontend plays frames back on a canvas overlay and can **export to GIF/MP4**.
- **Lighter sims can skip the server**: compile the same C++ to **WebAssembly** and
  run in-browser — no infrastructure, still fast.

If you want to start Tier 3, open a design issue first so we agree on the
`SimulationSpec` shape and the service contract before code.

---

## How to add a new element type (the contract)

1. **Type it.** Add the name to `ElementType` and an interface to
   `frontend/src/lib/types.ts`; add it to the `SceneElement` union.
2. **Render it.** In `frontend/src/components/DrawingCanvas.tsx`, add a `case` in
   `renderEl`. Draw with a Konva node, or `SvgImageShape` (sync SVG), or a
   component like `MathShape` (async). Wire drag/resize if it has a box.
3. **Author it.** If it needs a dialog, add a modal (copy `TableModal`/
   `ChartModal`/`MathModal`) and wire `request…`/`edit…`/`save…` in `Editor.tsx`.
4. **Expose it.** Add a toolbar entry in `frontend/src/components/Toolbar.tsx`.
5. **Backend:** usually nothing. The scene is opaque JSON. Only touch
   `backend/` if you add first-class metadata (like folders).

**Rules that keep the app coherent:**
- It must render into the Konva stage (so export keeps working).
- Store the *source of truth* (LaTeX, SMILES, data, spec), not a baked bitmap, so
  elements stay re-editable.
- Keep it self-contained — no external network calls at render time.
- Support light **and** dark canvas backgrounds where it makes sense.

---

## Find real STEM demand

The best features come from a real workflow that's currently painful. Some open
needs by audience — claim one, or bring your own:

- **CS / SWE:** system-architecture stencils, sequence diagrams, ER diagrams,
  state machines, auto-layout for clean figures.
- **EE:** circuit schematics, logic gates, signal/Bode plots.
- **Mechanical / civil:** dimensioned blueprints, free-body diagrams, real units.
- **Physics:** vector fields, function/phase-space plots, the Tier-3 simulations.
- **Chemistry:** 2D structure drawing, reaction arrows, orbital diagrams.
- **Math:** the Desmos-style grapher, number lines, geometry constructions.
- **Bio:** pathway diagrams, annotated microscopy, the heartbeat model.

Open an issue that describes the **workflow** ("as a *role* I need to *do X* so
that *Y*"), not just a feature name. Then ship the smallest element that helps.

---

## Development

Setup and run instructions live in the [README](README.md) (ASP.NET Core + SQLite
backend, Next.js + Konva frontend). Before opening a PR:

```bash
cd frontend && npm run build   # must pass: compiles + typechecks
```

- Keep TypeScript strict — no `any` escape hatches in new element code.
- Match the existing file style; small, focused PRs review fastest.
- If your feature is visual, include a before/after screenshot in the PR.
- New heavy dependencies: prefer dynamic `import()` so they only load on use
  (see how `jspdf`, `pptxgenjs`, and `pdfjs-dist` are loaded in `lib/exporters.ts`).

Thanks for helping build the STEM canvas we all wish existed. 🎨🔬
