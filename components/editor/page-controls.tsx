"use client";
import { pdfjs } from "@/lib/pdf-engine";
import { extractScan } from "@/lib/pdf-scan";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useState } from "react";
export default function PageControls({
  pdf,
  onError,
  page,
  count,
  scrollToPage,
  setPage,
  zoom,
  setZoom,
  readonly,
  rotation,
  setRotation,
  emit,
  state,
  pageSizes,
  setPageSizes,
  setCount,
}: {
  pdf: any;
  onError: (message: string) => void;
  page: any;
  count: any;
  scrollToPage: any;
  setPage: (page: number) => void;
  zoom: any;
  setZoom: any;
  readonly: any;
  rotation: any;
  setRotation: any;
  emit: any;
  state: any;
  pageSizes: { width: number; height: number }[];
  setPageSizes: React.Dispatch<
    React.SetStateAction<{ width: number; height: number }[]>
  >;
  setCount: any;
}) {
  const [rotating, setRotating] = useState(false);
  async function rotate() {
    if (!pdf.current || page >= pdf.current.numPages) return;
    setRotating(true);
    try {
      const source = await pdf.current.getPage(page + 1);
      const js = await pdfjs();
      const scan = await extractScan(source, js, (width, height) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        return c;
      });
      if (!scan || source.rotate !== 0)
        throw new Error(
          "Na tejto strane sa nenašiel samostatný obrázok, ktorý možno otočiť.",
        );
      const r = (rotation + 90) % 360;
      setRotation(r);
      emit({
        ...state.current,
        rotations: { ...state.current.rotations, [page]: r },
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setRotating(false);
    }
  }
  return (
    <div className="pagebar">
      <div>
        <button
          aria-label="Predošlá strana"
          disabled={page === 0}
          onClick={() => scrollToPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Strana {page + 1} / {count}
        </span>
        <button
          aria-label="Ďalšia strana"
          disabled={page + 1 >= count}
          onClick={() => scrollToPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div>
        <button
          aria-label="Zmenšiť"
          onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}
        >
          <ZoomOut size={16} />
        </button>
        <span>{Math.round(zoom * 100)} %</span>
        <button
          aria-label="Zväčšiť"
          onClick={() => setZoom(Math.min(2, zoom + 0.1))}
        >
          <ZoomIn size={16} />
        </button>
        <button
          disabled={
            readonly || rotating || page >= (pdf.current?.numPages ?? 0)
          }
          title="Otočiť obrázok"
          onClick={rotate}
        >
          <RotateCw size={16} /> Otočiť
        </button>
        <button
          disabled={readonly || (state.current.extraPages ?? 0) >= 100}
          onClick={() => {
            const extra = (state.current.extraPages ?? 0) + 1;
            emit({ ...state.current, extraPages: extra });
            const sizes = [...pageSizes, { width: 595.28, height: 841.89 }];
            setPageSizes(sizes);
            setCount(sizes.length);
            setPage(sizes.length - 1);
            setTimeout(() => scrollToPage(sizes.length - 1), 0);
          }}
        >
          <FilePlus size={16} /> Pridať stranu
        </button>
      </div>
    </div>
  );
}
