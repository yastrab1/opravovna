"use client";
import { pdfjs } from "@/lib/pdf-engine";
import { drawRotatedScan, extractScan } from "@/lib/pdf-scan";
import { useEffect } from "react";
export function usePdfPages({
  ready,
  pdf,
  doc,
  projectId,
  state,
  setPage,
  setPageSizes,
  setReady,
  initialFit,
  history,
  future,
  setCount,
  callbacks,
  pdfCanvases,
  pageSizes,
  rotationKey,
}: {
  ready: any;
  pdf: any;
  doc: any;
  projectId: any;
  state: any;
  setPage: any;
  setPageSizes: React.Dispatch<
    React.SetStateAction<{ width: number; height: number }[]>
  >;
  setReady: any;
  initialFit: any;
  history: any;
  future: any;
  setCount: any;
  callbacks: any;
  pdfCanvases: React.RefObject<(HTMLCanvasElement | null)[]>;
  pageSizes: { width: number; height: number }[];
  rotationKey: any;
}) {
  useEffect(() => {
    let canceled = false;
    let loadingTask: any;
    setPage(0);
    setPageSizes([]);
    setReady(false);
    initialFit.current = true;
    state.current = doc.state;
    history.current = [];
    future.current = [];
    (async () => {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${doc.id}/file`,
      );
      if (!res.ok) throw new Error("PDF sa nepodarilo načítať.");
      const js = await pdfjs();
      loadingTask = js.getDocument({
        data: new Uint8Array(await res.arrayBuffer()),
      });
      const loaded = await loadingTask.promise;
      if (canceled) {
        await loadingTask.destroy();
        return;
      }
      pdf.current = loaded;
      const sizes = [];
      for (let i = 0; i < loaded.numPages; i++) {
        const p = await loaded.getPage(i + 1);
        sizes.push(p.getViewport({ scale: 1 }));
      }
      for (let i = 0; i < (state.current.extraPages ?? 0); i++)
        sizes.push({ width: 595.28, height: 841.89 });
      setPageSizes(sizes);
      setCount(sizes.length);
      setReady(true);
    })().catch((e) => callbacks.current.onError(e.message));
    return () => {
      canceled = true;
      void loadingTask?.destroy();
      pdf.current = null;
    };
  }, [doc.id, projectId, doc.fileVersion]);
  useEffect(() => {
    if (!ready || !pdf.current) return;
    let canceled = false;
    const tasks: any[] = [];
    (async () => {
      const js = await pdfjs();
      for (
        let i = 0;
        i < Math.min(pdf.current.numPages, pageSizes.length);
        i++
      ) {
        if (canceled) return;
        const page = await pdf.current.getPage(i + 1),
          viewport = page.getViewport({ scale: 1 }),
          bg = pdfCanvases.current[i];
        if (!bg) continue;
        bg.width = Math.round(viewport.width * 2);
        bg.height = Math.round(viewport.height * 2);
        const ctx = bg.getContext("2d")!;
        ctx.fillStyle = "#fefefe";
        ctx.fillRect(0, 0, bg.width, bg.height);
        const task = page.render({
          canvasContext: ctx,
          viewport,
          transform: [2, 0, 0, 2, 0, 0],
        });
        tasks.push(task);
        await task.promise;
        const turn = (((state.current.rotations?.[i] ?? 0) % 360) + 360) % 360;
        if (!turn) continue;
        const scan = await extractScan(page, js, (width, height) => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          return c;
        });
        if (!scan)
          throw new Error(
            "Na tejto strane sa nenašiel samostatný obrázok, ktorý možno otočiť.",
          );
        drawRotatedScan(ctx, scan, viewport.width, viewport.height, turn);
      }
    })().catch((e) => {
      if (!canceled) callbacks.current.onError(e.message);
    });
    return () => {
      canceled = true;
      tasks.forEach((task) => task.cancel());
    };
  }, [ready, pageSizes, doc.id, rotationKey]);
}
