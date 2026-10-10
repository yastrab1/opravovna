import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { PDFDocument, PDFName } from "pdf-lib";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { preparePdfAssets } from "../build/pdfjs-assets.mjs";
import { prepareExportRuntime, renderWithWorker } from "./support/runtime.mjs";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const root = await prepareExportRuntime("decoder-assets");
const { pdfAssetOptions } = await import(
  path.join(root, "dist/export/pdf-assets.mjs")
);
const js = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { version, target } = await preparePdfAssets();
assert.equal(version, js.version);
// A synthetic 32x32 monochrome scan, left half black and right half white.
// The inline Group-4 strip is generated from this pattern, without any user PDF.
// CCITT and JBIG2 share PDF.js 6's jbig2.wasm / JS fallback decoder.
const source = await PDFDocument.create();
const strip = Uint8Array.from(
  Buffer.from("3502ffffffffffffffff80080080", "hex"),
);
const image = source.context.register(
  source.context.stream(strip, {
    Type: "XObject",
    Subtype: "Image",
    Width: 32,
    Height: 32,
    ColorSpace: "DeviceGray",
    BitsPerComponent: 1,
    Filter: "CCITTFaxDecode",
    DecodeParms: { K: -1, Columns: 32, Rows: 32, BlackIs1: true },
  }),
);
const page = source.addPage([100, 100]);
page.node.set(
  PDFName.of("Resources"),
  source.context.obj({ XObject: { Scan: image } }),
);
page.node.addContentStream(
  source.context.register(
    source.context.stream("q 80 0 0 80 10 10 cm /Scan Do Q"),
  ),
);
const bytes = await source.save();
await fs.writeFile(path.join(root, "ccitt.pdf"), bytes);

async function verifyDecode(options, expectedHalf) {
  const task = js.getDocument({ data: bytes.slice(), ...options });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const canvas = createCanvas(100, 100);
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: page.getViewport({ scale: 1 }),
    }).promise;
    const ctx = canvas.getContext("2d");
    assert.equal(
      ctx.getImageData(expectedHalf === "left" ? 25 : 75, 50, 1, 1).data[0],
      0,
    );
    assert.equal(
      ctx.getImageData(expectedHalf === "left" ? 75 : 25, 50, 1, 1).data[0],
      255,
    );
  } finally {
    await task.destroy();
  }
}
const fetched = new Set();
const server = http.createServer(async (req, res) => {
  try {
    const relative = req.url.slice(`/pdfjs/${version}/`.length);
    if (!req.url.startsWith(`/pdfjs/${version}/`) || relative.includes("..")) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(target, relative);
    fetched.add(relative);
    res.setHeader(
      "Content-Type",
      file.endsWith(".wasm")
        ? "application/wasm"
        : file.endsWith(".js")
          ? "text/javascript"
          : "application/octet-stream",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}/pdfjs/${version}/`;
  await verifyDecode(
    { ...pdfAssetOptions(base), useWorkerFetch: true },
    "left",
  );
  assert(
    fetched.has("wasm/jbig2.wasm"),
    "worker fetched its versioned JBIG2/CCITT decoder",
  );
  const fallback = await fetch(`${base}wasm/jbig2_nowasm_fallback.js`);
  assert.equal(fallback.headers.get("content-type"), "text/javascript");
  assert.match(await fallback.text(), /export default/);
  const wasm = await fetch(`${base}wasm/jbig2.wasm`);
  assert.equal(wasm.headers.get("content-type"), "application/wasm");
  assert.deepEqual(
    new Uint8Array(await wasm.arrayBuffer()).slice(0, 4),
    Uint8Array.of(0, 97, 115, 109),
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}

// Native export paths must work without depending on an external asset server.
await verifyDecode(
  { ...pdfAssetOptions(`${packageRoot}/`), useWorkerFetch: false },
  "left",
);
await verifyDecode(
  {
    ...pdfAssetOptions(`${packageRoot}/`),
    useWorkerFetch: false,
    useWasm: false,
  },
  "left",
);

// Browsers with OffscreenCanvas return ImageBitmap objects instead of raw pixels.
const { extractScan } = await import(
  path.join(root, "dist/export/pdf-scan.mjs")
);
const bitmapTask = js.getDocument({
  data: bytes.slice(),
  ...pdfAssetOptions(`${packageRoot}/`),
});
try {
  const bitmapDoc = await bitmapTask.promise;
  const bitmapPage = await bitmapDoc.getPage(1);
  await bitmapPage.getOperatorList();
  const bitmap = createCanvas(32, 32);
  bitmap.getContext("2d").fillRect(0, 0, 32, 32);
  bitmapPage.objs.get = (_id, resolve) =>
    resolve({ width: 32, height: 32, data: null, bitmap });
  const scan = await extractScan(bitmapPage, js, createCanvas);
  assert(scan, "browser ImageBitmap scan is supported");
  assert.equal(
    scan.canvas.getContext("2d").getImageData(10, 10, 1, 1).data[3],
    255,
  );
} finally {
  await bitmapTask.destroy();
}

// Exercise the actual export worker and bit-packed scan extraction, not only PDF.js.
const rotated = await renderWithWorker(root, bytes, {
  changes: [],
  rotations: { 0: 180 },
});
const rotatedTask = js.getDocument({ data: rotated });
try {
  const doc = await rotatedTask.promise;
  const page = await doc.getPage(1);
  const canvas = createCanvas(100, 100);
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport: page.getViewport({ scale: 1 }),
  }).promise;
  assert.equal(canvas.getContext("2d").getImageData(75, 50, 1, 1).data[0], 0);
  assert.equal(canvas.getContext("2d").getImageData(25, 50, 1, 1).data[0], 255);
} finally {
  await rotatedTask.destroy();
}
console.log(
  "PDF.js decoder assets: versioned worker fetch, native WASM, JS fallback and monochrome rotation passed.",
);
