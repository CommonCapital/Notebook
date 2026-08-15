// Multi-format export + PDF import. Heavy libraries (jsPDF, pptxgenjs, pdf.js)
// are dynamically imported so they only load when actually used.

import type Konva from "konva";
import { downloadDataUrl, downloadText } from "./files";

function stagePng(stage: Konva.Stage, pixelRatio = 2): string {
  return stage.toDataURL({ pixelRatio, mimeType: "image/png" });
}

export function exportImage(stage: Konva.Stage, name: string, format: "png" | "jpeg") {
  const url = stage.toDataURL({
    pixelRatio: 2,
    mimeType: format === "jpeg" ? "image/jpeg" : "image/png",
    quality: 0.92,
  });
  downloadDataUrl(url, `${name}.${format === "jpeg" ? "jpg" : "png"}`);
}

export async function exportPdf(stage: Konva.Stage, name: string) {
  const { jsPDF } = await import("jspdf");
  const w = stage.width();
  const h = stage.height();
  const pdf = new jsPDF({
    orientation: w >= h ? "landscape" : "portrait",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(stagePng(stage), "PNG", 0, 0, w, h);
  pdf.save(`${name}.pdf`);
}

export async function exportPptx(stage: Konva.Stage, name: string) {
  const mod = await import("pptxgenjs");
  const Pptx = (mod.default ?? mod) as unknown as new () => {
    defineLayout: (o: { name: string; width: number; height: number }) => void;
    layout: string;
    addSlide: () => { addImage: (o: Record<string, unknown>) => void };
    writeFile: (o: { fileName: string }) => Promise<string>;
  };
  const pptx = new Pptx();

  // Build a slide whose aspect ratio matches the canvas (inches, 96 dpi).
  const wIn = stage.width() / 96;
  const hIn = stage.height() / 96;
  pptx.defineLayout({ name: "CANVAS", width: wIn, height: hIn });
  pptx.layout = "CANVAS";
  const slide = pptx.addSlide();
  slide.addImage({ data: stagePng(stage), x: 0, y: 0, w: wIn, h: hIn });
  await pptx.writeFile({ fileName: `${name}.pptx` });
}

export function exportHtml(stage: Konva.Stage, name: string) {
  const dataUrl = stagePng(stage);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(name)} — Drawing Desk</title>
<style>
  body { margin: 0; background: #0f1114; display: flex; min-height: 100vh;
    align-items: center; justify-content: center; }
  img { max-width: 100%; height: auto; box-shadow: 0 10px 40px rgba(0,0,0,.4); }
</style>
</head>
<body>
  <img src="${dataUrl}" alt="${escapeHtml(name)}" />
</body>
</html>`;
  downloadText(html, `${name}.html`, "text/html");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface PageImage {
  dataUrl: string;
  width: number;
  height: number;
}

// Render every page of a PDF to a PNG data URL (for annotating on the canvas).
export async function pdfFileToImages(file: File, scale = 1.5): Promise<PageImage[]> {
  const pdfjs = await import("pdfjs-dist");
  // Turbopack resolves this asset URL to the bundled worker file.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    // pdf.js v6 expects the canvas element via `canvas` in render params.
    await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
    pages.push({
      dataUrl: canvas.toDataURL("image/png"),
      width: viewport.width,
      height: viewport.height,
    });
  }
  return pages;
}
