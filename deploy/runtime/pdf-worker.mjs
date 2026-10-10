import { nativeFabric } from "./canvas-environment.mjs";
import { parentPort } from "node:worker_threads";
import { createRequire } from "node:module";
import path from "node:path";
import * as napi from "@napi-rs/canvas";
import { flattenPdfWith } from "./dist/export/pdf-render.mjs";
import { loadObjectsWith } from "./dist/export/pdf-annotations.mjs";
import { pdfAssetOptions } from "./dist/export/pdf-assets.mjs";

// Fabric's DOM wrappers use the native Skia canvas. Each CPU thread owns its
// renderer and font registry; no shared canvas or browser main thread is used.
const require = createRequire(import.meta.url);
const fabric = await nativeFabric();
const js = await import("pdfjs-dist/legacy/build/pdf.mjs");
js.GlobalWorkerOptions.workerSrc =
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const documentOptions = {
  ...pdfAssetOptions(
    `${path.dirname(require.resolve("pdfjs-dist/package.json"))}/`,
  ),
  // Node's data factory reads decoder files directly from the installed package.
  useWorkerFetch: false,
};
const configuredPdfjs = {
  ...js,
  getDocument: (options) => js.getDocument({ ...documentOptions, ...options }),
};
const loadObjects = (canvas, changes, page) =>
  loadObjectsWith(canvas, changes, page, fabric);
parentPort.on("message", async ({ id, bytes, state }) => {
  try {
    const output = await flattenPdfWith(bytes, state, {
      fabric,
      pdfjs: async () => configuredPdfjs,
      loadObjects,
      createCanvas: (width, height) => napi.createCanvas(width, height),
    });
    parentPort.postMessage({ id, bytes: output }, [output.buffer]);
  } catch (error) {
    console.error("PDF export failed:", error.message);
    parentPort.postMessage({
      id,
      error: "PDF sa nepodarilo exportovať. Skontrolujte anotácie riešenia.",
    });
  }
});
