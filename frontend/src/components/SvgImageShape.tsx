"use client";

import type Konva from "konva";
import { useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import { svgToDataUrl } from "@/lib/generate";

// Renders a synchronously-generated SVG string as a Konva image (tables, charts).
export default function SvgImageShape({
  svg,
  x,
  y,
  width,
  height,
  rotation = 0,
  ...rest
}: {
  svg: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
} & Record<string, unknown>) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.src = svgToDataUrl(svg);
  }, [svg]);

  return (
    <KonvaImage
      {...(rest as Konva.ImageConfig)}
      image={img ?? undefined}
      x={x + width / 2}
      y={y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      width={width}
      height={height}
    />
  );
}
