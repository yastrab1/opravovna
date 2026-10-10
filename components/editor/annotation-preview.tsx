/* eslint-disable @next/next/no-img-element -- Generated local canvas previews use data URLs directly. */
"use client";
import { loadObjects } from "@/lib/pdf-engine";
import { useEffect, useState } from "react";

// Inactive pages retain their annotations while Fabric owns only the editor's
// active canvas. React never removes a canvas while Fabric is wrapping it.
export default function AnnotationPreview({
  page,
  width,
  height,
  changes,
  active,
}: {
  page: number;
  width: number;
  height: number;
  changes: any[];
  active: boolean;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (active) return;
    let canceled = false;
    const render = async () => {
      const { StaticCanvas } = await import("fabric");
      const canvas = new StaticCanvas(undefined, {
        width,
        height,
        enableRetinaScaling: false,
      });
      try {
        await loadObjects(canvas, changes, page);
        canvas.renderAll();
        if (!canceled)
          setSrc(canvas.toDataURL({ format: "png", multiplier: 1 }));
      } finally {
        await canvas.dispose();
      }
    };
    render().catch(() => {
      if (!canceled) setSrc("");
    });
    return () => {
      canceled = true;
    };
  }, [active, changes, page, width, height]);
  return !active && src ? (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        pointerEvents: "none",
      }}
    />
  ) : null;
}
