import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { PDFDocument, rgb } from "pdf-lib";
import {
  createCanvas,
  loadImage,
  DOMMatrix,
  ImageData,
  Path2D,
} from "@napi-rs/canvas";
import { prepareExportRuntime, renderWithWorker } from "./support/runtime.mjs";

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const root = await prepareExportRuntime("pdf-runtime");
const { extractScan, drawRotatedScan, scanLayout } = await import(
  path.join(root, "dist/export/pdf-scan.mjs")
);
const js = await import("pdfjs-dist/legacy/build/pdf.mjs");
const source = await PDFDocument.create(),
  page = source.addPage([600, 800]);
const scanCanvas = createCanvas(200, 300),
  ctx = scanCanvas.getContext("2d");
ctx.fillStyle = "#00b8da";
ctx.fillRect(0, 0, 200, 300);
ctx.fillStyle = "#0000ff";
ctx.fillRect(0, 0, 30, 30);
const scanImage = await source.embedPng(scanCanvas.toBuffer("image/png"));
page.drawImage(scanImage, { x: 100, y: 70, width: 400, height: 600 });
page.drawText("NAME CATEGORY", {
  x: 10,
  y: 780,
  size: 12,
  color: rgb(0, 0, 0),
});
// A surrounding PDF border is not part of the embedded scan.
page.drawRectangle({
  x: 99,
  y: 69,
  width: 402,
  height: 602,
  borderColor: rgb(1, 0, 0),
  borderWidth: 2,
});
const bytes = await source.save();
await fs.writeFile(path.join(root, "source.pdf"), bytes);
const loadingTask = js.getDocument({
  data: bytes.slice(),
  isEvalSupported: false,
});
const parsed = await loadingTask.promise;
try {
  const inputPage = await parsed.getPage(1),
    scan = await extractScan(inputPage, js, createCanvas);
  assert(scan);
  assert.equal(scan.canvas.width, 200);
  assert.equal(scan.canvas.height, 300);
  function colorBounds(canvas, color, pixelRatio = 1) {
    const { data } = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    let left = Infinity,
      top = Infinity,
      right = -1,
      bottom = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (color(data[i], data[i + 1], data[i + 2])) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    assert(right >= left, "Expected visible scan pixels");
    return {
      left: left / pixelRatio,
      top: top / pixelRatio,
      right: right / pixelRatio,
      bottom: bottom / pixelRatio,
    };
  }
  const cyan = (r, g, b) => r < 60 && g > 130 && b > 150;
  for (const turn of [90, 180, 270]) {
    const state = {
      changes: [],
      tags: [],
      scoring: {},
      rotations: { 0: turn },
      extraPages: 1,
    };
    const output = await renderWithWorker(root, bytes.slice(), state);
    const pdf = await PDFDocument.load(output);
    assert.equal(pdf.getPageCount(), 2);
    assert.equal(
      pdf.getPage(0).getRotation().angle,
      0,
      "Page and header stay upright",
    );
    const filename = path.join(root, "rotated-" + turn);
    await fs.writeFile(filename + ".pdf", output);
    assert.match(
      execFileSync("pdftotext", [filename + ".pdf", "-"], { encoding: "utf8" }),
      /NAME CATEGORY/,
    );
    execFileSync("pdftoppm", [
      "-f",
      "1",
      "-singlefile",
      "-scale-to",
      "800",
      "-png",
      filename + ".pdf",
      filename,
    ]);
    const image = await loadImage(filename + ".png"),
      canvas = createCanvas(image.width, image.height);
    canvas.getContext("2d").drawImage(image, 0, 0);
    const actual = colorBounds(canvas, cyan),
      layout = scanLayout(600, 800, scan, turn);
    const expectedWidth = turn % 180 ? layout.height : layout.width,
      expectedHeight = turn % 180 ? layout.width : layout.height;
    assert(
      Math.abs((actual.left + actual.right) / 2 - layout.centerX) < 2,
      "Export is centered horizontally",
    );
    assert(
      Math.abs((actual.top + actual.bottom) / 2 - layout.centerY) < 2,
      "Export is centered below header",
    );
    assert(
      Math.abs(actual.right - actual.left + 1 - expectedWidth) < 3,
      "Only scan dimensions determine fit",
    );
    assert(Math.abs(actual.bottom - actual.top + 1 - expectedHeight) < 3);
    const preview = createCanvas(1200, 1600);
    preview.getContext("2d").fillStyle = "#fff";
    preview.getContext("2d").fillRect(0, 0, 1200, 1600);
    drawRotatedScan(preview.getContext("2d"), scan, 600, 800, turn, 2);
    const previewBounds = colorBounds(preview, cyan, 2);
    for (const key of Object.keys(actual))
      assert(
        Math.abs(actual[key] - previewBounds[key]) < 2,
        "Preview matches export at high DPI",
      );
    // Cyan scan must contain no red PDF border, and clockwise orientation agrees.
    const blue = (r, g, b) => r < 70 && g < 70 && b > 180;
    const blueExport = colorBounds(canvas, blue),
      bluePreview = colorBounds(preview, blue, 2);
    assert(Math.abs(blueExport.left - bluePreview.left) < 2);
    assert(Math.abs(blueExport.top - bluePreview.top) < 2);
  }
  const { legacyToFabric, fabricToLegacy } = await import(
    path.join(root, "dist/export/pdf-annotations.mjs")
  );
  assert.equal(
    legacyToFabric({ type: "Text", data: { text: "4.67B" } }).originX,
    "left",
  );
  for (const invalid of ["", " ", null, 0, -3, "invalid"]) {
    const change = {
      type: "Text",
      data: {
        fontSize: invalid,
        styles: { 0: { 0: { fontSize: invalid, fill: "red" } } },
      },
    };
    const normalized = legacyToFabric(change);
    assert.equal(Object.hasOwn(normalized, "fontSize"), false);
    assert.deepEqual(normalized.styles[0][0], { fill: "red" });
    assert.equal(change.data.fontSize, invalid);
    assert.equal(change.data.styles[0][0].fontSize, invalid);
  }
  assert.equal(
    legacyToFabric({ type: "Text", data: { fontSize: "23.5" } }).fontSize,
    23.5,
  );
  const rich = {
    type: "Text",
    data: { styles: { 0: { 0: { fontSize: "23.5", fill: "blue" } } } },
  };
  assert.deepEqual(legacyToFabric(rich).styles[0][0], {
    fontSize: 23.5,
    fill: "blue",
  });
  assert.equal(rich.data.styles[0][0].fontSize, "23.5");
  assert.equal(
    fabricToLegacy(
      { type: "rect", toObject: () => ({ width: 10, height: 20 }) },
      0,
    ).type,
    "Path",
  );
  const plain = await renderWithWorker(root, bytes.slice(), {
    changes: [],
    tags: [],
    scoring: {},
    rotations: {},
    extraPages: 0,
  });
  assert.equal((await PDFDocument.load(plain)).getPageCount(), 1);
  console.log(
    "PASS: embedded-image bounds, upright header, centered maximum fit, clockwise rotation and preview/export parity at 90/180/270 degrees; annotations and extra page",
  );
} finally {
  await loadingTask.destroy();
}
