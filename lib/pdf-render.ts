import { rotateScan } from "./pdf-rotation";

export async function flattenPdfWith(
  bytes: Uint8Array,
  state: any,
  {
    fabric: f,
    pdfjs,
    loadObjects,
    createCanvas,
  }: {
    fabric: any;
    pdfjs: () => Promise<any>;
    loadObjects: (canvas: any, changes: any[], page: number) => Promise<void>;
    createCanvas?: (width: number, height: number) => any;
  },
) {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const output = await PDFDocument.load(bytes);
  let input: any, js: any, task: any;
  try {
    if (
      state.changes?.length ||
      Object.values(state.rotations ?? {}).some((value: any) => value !== 0)
    ) {
      js = await pdfjs();
      task = js.getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
      });
      input = await task.promise;
    }
    for (let n = 0; n < (state.extraPages ?? 0); n++)
      output.addPage([595.28, 841.89]);
    for (let n = 0; n < output.getPageCount(); n++) {
      const page = output.getPage(n);
      const turn = (((state.rotations?.[n] ?? 0) % 360) + 360) % 360;
      if (turn) {
        const source = n < input.numPages ? await input.getPage(n + 1) : null;
        const makeCanvas =
          createCanvas ??
          ((width: number, height: number) => {
            const element = f.getEnv().document.createElement("canvas");
            element.width = width;
            element.height = height;
            return element;
          });
        await rotateScan(output, page, source, js, turn, makeCanvas);
      }
      if ((state.changes ?? []).some((change: any) => change.page === n)) {
        const view =
          n < input.numPages
            ? (await input.getPage(n + 1)).getViewport({ scale: 1 })
            : { width: 595.28, height: 841.89, rotation: 0 };
        const canvas = new f.StaticCanvas(undefined, {
          width: view.width,
          height: view.height,
          enableRetinaScaling: false,
        });
        try {
          await loadObjects(canvas, state.changes ?? [], n);
          canvas.renderAll();
          if (canvas.getObjects().length) {
            const png = await output.embedPng(
              canvas.toDataURL({ format: "png", multiplier: 2 }),
            );
            const angle = ((page.getRotation().angle % 360) + 360) % 360,
              w = page.getWidth(),
              h = page.getHeight();
            // Map the rendered page coordinates back into the unrotated PDF space.
            const placements: any = {
              0: { x: 0, y: 0, width: w, height: h },
              90: { x: w, y: 0, width: h, height: w, rotate: degrees(90) },
              180: { x: w, y: h, width: w, height: h, rotate: degrees(180) },
              270: { x: 0, y: h, width: h, height: w, rotate: degrees(270) },
            };
            page.drawImage(png, placements[angle] ?? placements[0]);
          }
        } finally {
          await canvas.dispose();
        }
      }
    }
    return await output.save();
  } finally {
    await task?.destroy();
  }
}
