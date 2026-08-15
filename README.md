# 🎨 Drawing Desk

**Figma for engineers and STEM students.** A local-first, single-user drawing +
file-management app: sketch system architectures, project blueprints, abstract
concepts — and drop in **beautiful LaTeX math formulas** right alongside your
diagrams. Every file is a canvas; everything is autosaved to a local database as
you work.

## Stack

| Layer     | Tech                                              |
|-----------|---------------------------------------------------|
| Backend   | ASP.NET Core Web API (.NET 10) + EF Core          |
| Database  | **SQLite** — one file (`backend/drawingdesk.db`)  |
| Frontend  | Next.js (App Router, TypeScript)                  |
| Canvas    | **Konva** / react-konva (vector scene graph)      |
| Math      | **MathJax** (LaTeX → SVG), rendered on the canvas |

### Why SQLite + a JSON scene

- The app is single-user and local, so SQLite (zero-setup, one file) beats a
  networked database. Swap the EF Core provider to Postgres later if you ever host it.
- Each canvas is stored as a **vector scene** — a JSON list of elements
  (`stroke`, `line`, `rect`, `ellipse`, `text`, `image`) — in one `SceneJson`
  column. Every element stays re-editable, saves are tiny diffs (not a rasterized
  image), and PNG export just renders the scene to a canvas. Adding a new drawing
  tool never requires a database migration.

## Running it (two terminals)

**Backend** (http://localhost:5199):

```bash
cd backend && ASPNETCORE_URLS="http://localhost:5199" dotnet run
```

**Frontend** (http://localhost:3000):

```bash
cd frontend && npm run dev
```

Then open http://localhost:3000. The API URL is set in `frontend/.env.local`.

## Features

- **Files & folders**: create files and nested folders, rename (double-click),
  delete, and **drag a file onto a folder** to move it. Collapsible tree.
- **Canvas**: pen, straight line, arrow, rectangle, ellipse, diamond, triangle,
  text, image import.
- **Undo / redo**: full scene history (`⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`).
- **Tables**: a grid element with an editor (rows/cols steppers, header row,
  per-cell text) rendered to crisp SVG on the canvas; double-click to edit.
- **Charts**: bar / line / pie from editable data, rendered to SVG; double-click to edit.
- **Math (LaTeX)**: the ∑ tool opens an editor with a live preview and a
  one-click symbol palette (∑ ∫ √ fractions, Greek, relations, …). Formulas are
  rendered to **crisp SVG via MathJax** and placed as real, resizable, re-editable
  canvas objects (double-click to edit). Great for physics/math notes and
  annotated engineering diagrams.
- **Style**: pen color, fill (solid/none), stroke size, any background color.
- **Select tool**: click to select, drag to move, resize via handles, `Delete` to remove.
- **Autosave**: debounced (~600 ms) `PUT` to the API after any change.
- **Import**: PNG/JPG images, **PDF** (each page rendered onto the canvas to
  annotate), and `.drawdesk` scene files — via one Import button.
- **Export**: **PNG, JPG, PDF, HTML, PowerPoint (.pptx)**, and `.drawdesk` scene.
  (Word/Excel are intentionally unsupported — a freeform canvas doesn't map to
  their document models; use PDF/PPTX/image instead.) Everything on the canvas —
  drawings, imported pages, math, tables, charts — exports together.

### How math rendering works

LaTeX → **MathJax SVG** (glyph paths inlined, `fontCache: "none"`) → embedded as a
vector image on the Konva canvas. This keeps formulas sharp at any size, exports
with everything else in PNG, and stays re-editable — the scene stores only the
LaTeX source (`math` element), so the backend never changes. MathJax is loaded
lazily on the client with a curated TeX package set (no runtime autoloader).

## API

| Method | Route                     | Purpose                          |
|--------|---------------------------|----------------------------------|
| GET    | `/api/files`              | List files (metadata only)       |
| GET    | `/api/files/{id}`         | Open a file (includes scene)     |
| POST   | `/api/files`              | Create a file                    |
| PUT    | `/api/files/{id}`         | Autosave (name/background/scene) |
| PATCH  | `/api/files/{id}/move`    | Move to a folder / to root       |
| DELETE | `/api/files/{id}`         | Delete a file                    |
| ...    | `/api/folders`            | Folder CRUD                      |

## Layout

```
backend/    ASP.NET Core API — Models/, Data/, Dtos/, Controllers/
frontend/   Next.js — src/components (Editor, DrawingCanvas, Toolbar, Sidebar),
            src/lib (api, types, files, id)
```
# -Drawing-Desk
