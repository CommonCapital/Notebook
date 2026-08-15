"use client";

import type Konva from "konva";
import { useEffect, useState } from "react";
import { Image as KonvaImage, Rect } from "react-konva";
import { renderMath } from "@/lib/math";
import type { MathElement } from "@/lib/types";

// Renders a LaTeX formula as a crisp SVG image on the canvas. The SVG is drawn
// into the element's width/height box, so resizing stays vector-sharp.
export default function MathShape({
  el,
  ...rest
}: { el: MathElement } & Record<string, unknown>) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    renderMath(el.latex, el.color)
      .then(({ dataUrl }) => {
        const image = new window.Image();
        image.onload = () => alive && setImg(image);
        image.src = dataUrl;
      })
      .catch(() => alive && setImg(null));
    return () => {
      alive = false;
    };
  }, [el.latex, el.color]);

  if (!img) {
    // Placeholder box while the formula renders (or if it failed to parse).
    return (
      <Rect
        {...(rest as Konva.RectConfig)}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        stroke="#3b82f6"
        dash={[4, 4]}
      />
    );
  }

  return (
    <KonvaImage
      {...(rest as Konva.ImageConfig)}
      image={img}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
    />
  );
}
