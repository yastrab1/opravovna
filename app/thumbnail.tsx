/* eslint-disable @next/next/no-img-element -- Generated local canvas previews use data URLs directly. */
"use client";
import { pdfjs } from "@/lib/pdf-engine";
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
const cache = new Map<string, string>();
let running = 0;
const waiting: Array<() => void> = [];
async function slot() {
  if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  return () => {
    running--;
    waiting.shift()?.();
  };
}
export default function Thumbnail({
  project,
  id,
  version,
}: {
  project: string;
  id: string;
  version?: string;
}) {
  const cacheKey = `${project}/${id}/${version ?? "original"}`;
  const element = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState(cache.get(cacheKey));
  useEffect(() => {
    if (cache.has(cacheKey)) {
      setSrc(cache.get(cacheKey));
      return;
    }
    setSrc(undefined);
    const abort = new AbortController();
    let task: any;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((x) => x.isIntersecting) || started) return;
        started = true;
        observer.disconnect();
        (async () => {
          const release = await slot();
          try {
            if (abort.signal.aborted) return;
            const res = await fetch(
              `/api/projects/${project}/documents/${id}/file`,
              { signal: abort.signal },
            );
            if (!res.ok) return;
            const js = await pdfjs();
            task = js.getDocument({
              data: new Uint8Array(await res.arrayBuffer()),
            });
            const doc = await task.promise;
            if (abort.signal.aborted) return;
            const page = await doc.getPage(1);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: 120 / base.width });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({
              canvasContext: canvas.getContext("2d")!,
              viewport,
            }).promise;
            const data = canvas.toDataURL("image/webp", 0.75);
            if (!abort.signal.aborted) {
              cache.set(cacheKey, data);
              if (cache.size > 120) cache.delete(cache.keys().next().value!);
              setSrc(data);
            }
          } catch {
            /* The main viewer reports PDF errors. */
          } finally {
            await task?.destroy();
            release();
          }
        })();
      },
      { rootMargin: "100px" },
    );
    if (element.current) observer.observe(element.current);
    return () => {
      abort.abort();
      observer.disconnect();
      task?.destroy();
    };
  }, [id, project, cacheKey]);
  return (
    <span className="thumbnail" ref={element}>
      {src ? <img src={src} alt="" /> : <FileText size={22} strokeWidth={1} />}
    </span>
  );
}
