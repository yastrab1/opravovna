import type { PDFDocument, PDFPage } from "pdf-lib";
import {
  extractScan,
  pdfImagePlacement,
  scanLayout,
  type CanvasFactory,
} from "./pdf-scan";

export async function rotateScan(
  output: PDFDocument,
  page: PDFPage,
  source: any,
  pdfjs: any,
  turn: number,
  makeCanvas: CanvasFactory,
) {
  const { degrees, rgb } = await import("pdf-lib");
  const scan =
    source && page.getRotation().angle === 0
      ? await extractScan(source, pdfjs, makeCanvas)
      : null;
  if (!scan)
    throw new Error(
      "Na tejto strane sa nenašiel samostatný obrázok, ktorý možno otočiť.",
    );
  const image = await output.embedJpg(
    scan.canvas.toDataURL("image/jpeg", 0.94),
  );
  const layout = scanLayout(page.getWidth(), page.getHeight(), scan, turn);
  page.drawRectangle({
    x: scan.bounds.left,
    y: page.getHeight() - scan.bounds.top - scan.bounds.height,
    width: scan.bounds.width,
    height: scan.bounds.height,
    color: rgb(1, 1, 1),
  });
  page.drawImage(image, {
    ...pdfImagePlacement(page.getHeight(), layout, turn),
    rotate: degrees(-turn),
  });
}
