"use client";
import { constrainComment } from "@/lib/editor/page-comment";
import { bindDrawingTools, configureTool } from "@/lib/editor/drawing-tools";
import { loadObjects } from "@/lib/pdf-engine";
import { useEffect, useRef } from "react";
export function useAnnotationCanvas({
  ready,
  currentPage,
  page,
  loading,
  pageSizes,
  initialFit,
  stage,
  setZoom,
  setRotation,
  state,
  annotationHosts,
  readonly,
  canvas,
  capture,
  blocked,
  mode,
  setTool,
  callbacks,
  doc,
  tool,
  color,
  width,
}: {
  ready: any;
  currentPage: any;
  page: any;
  loading: any;
  pageSizes: { width: number; height: number }[];
  initialFit: any;
  stage: any;
  setZoom: any;
  setRotation: any;
  state: any;
  annotationHosts: React.RefObject<(HTMLDivElement | null)[]>;
  readonly: any;
  canvas: any;
  capture: any;
  blocked: any;
  mode: any;
  setTool: any;
  callbacks: any;
  doc: any;
  tool: any;
  color: any;
  width: any;
}) {
  const disposal = useRef<Promise<any>>(Promise.resolve());
  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    let own: any;
    let element: HTMLCanvasElement | undefined;
    currentPage.current = page;
    loading.current = true;
    const initialized = (async () => {
      await disposal.current;
      if (canceled) return;
      await document.fonts.ready;
      const f = await import("fabric");
      const viewport = pageSizes[page] ?? { width: 595.28, height: 841.89 };
      if (canceled) return;
      if (initialFit.current && stage.current) {
        setZoom(
          Math.min(
            1.4,
            Math.max(0.4, (stage.current.clientWidth - 56) / viewport.width),
          ),
        );
        initialFit.current = false;
      }
      setRotation(state.current.rotations?.[page] ?? 0);
      const host = annotationHosts.current[page];
      if (!host) return;
      element = document.createElement("canvas");
      host.appendChild(element);
      own = new f.Canvas(element, {
        width: viewport.width,
        height: viewport.height,
        selection: !readonly,
        enableRetinaScaling: true,
      });
      canvas.current = own;
      await loadObjects(own, state.current.changes ?? [], page);
      if (canceled) return;
      own
        .getObjects()
        .forEach((o: any) =>
          o.set({ selectable: !readonly, evented: !readonly }),
        );
      own.renderAll();
      loading.current = false;
      const captureText = ({ target }: any) => {
        if (target) constrainComment(target, viewport.width);
        capture();
      };
      own.on("object:modified", captureText);
      own.on("path:created", ({ path }: any) => {
        path.name = "Path_" + crypto.randomUUID().slice(0, 9);
        capture();
      });
      own.on("text:changed", captureText);
      bindDrawingTools(own, f, { blocked, loading, mode, capture, setTool });
      configureTool(own, f, mode, readonly);
    })().catch((e) => {
      if (!canceled) {
        loading.current = true;
        callbacks.current.onError(e.message);
      }
    });
    return () => {
      canceled = true;
      loading.current = true;
      if (canvas.current === own) canvas.current = null;
      disposal.current = initialized
        .then(async () => {
          await own?.dispose();
          element?.remove();
        })
        .catch(() => {});
    };
  }, [ready, page, pageSizes, doc.id, doc.remoteRevision]);
  useEffect(() => {
    import("fabric").then((f) =>
      configureTool(canvas.current, f, mode, readonly),
    );
  }, [tool, color, width, readonly]);
}
