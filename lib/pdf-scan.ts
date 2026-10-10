import { largestImageBounds } from "./pdf-image";

export type CanvasFactory = (width: number, height: number) => any;
export type Scan = {
  canvas: any;
  bounds: NonNullable<Awaited<ReturnType<typeof largestImageBounds>>>;
  headerBottom: number;
};

// Decode the image object itself. Cropping a rendered PDF would also capture
// text, rules and page decorations that happen to overlap the image rectangle.
export async function extractScan(
  page: any,
  pdfjs: any,
  makeCanvas: CanvasFactory,
): Promise<Scan | null> {
  const bounds = await largestImageBounds(page, pdfjs);
  if (!bounds?.axisAligned || !bounds.imageId) return null;
  const image: any = await new Promise((resolve) =>
    page.objs.get(bounds.imageId, resolve),
  );
  const canvas = scanImageCanvas(image, pdfjs, makeCanvas);
  if (!canvas) return null;
  const viewport = page.getViewport({ scale: 1 }),
    text = await page.getTextContent();
  let headerBottom = 0;
  for (const item of text.items) {
    if (!item.str?.trim() || !item.transform) continue;
    const transform = pdfjs.Util.transform(viewport.transform, item.transform);
    const baseline = transform[5];
    if (baseline <= bounds.top)
      headerBottom = Math.max(headerBottom, baseline + 4);
  }
  return { canvas, bounds, headerBottom };
}

function scanImageCanvas(image: any, pdfjs: any, makeCanvas: CanvasFactory) {
  if (!image?.width || !image.height) return null;
  const canvas = makeCanvas(image.width, image.height),
    context = canvas.getContext("2d");
  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0);
    return canvas;
  }
  if (!image.data) return null;
  const channels =
    image.kind === pdfjs.ImageKind.RGB_24BPP
      ? 3
      : image.kind === pdfjs.ImageKind.RGBA_32BPP
        ? 4
        : 0;
  const monochrome = image.kind === pdfjs.ImageKind.GRAYSCALE_1BPP;
  if (!channels && !monochrome) return null;
  const pixels = context.createImageData(image.width, image.height);
  if (monochrome) {
    const rowBytes = Math.ceil(image.width / 8);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const sample = image.data[y * rowBytes + (x >> 3)] & (128 >> (x & 7));
        const dest = (y * image.width + x) * 4;
        pixels.data[dest] =
          pixels.data[dest + 1] =
          pixels.data[dest + 2] =
            sample ? 255 : 0;
        pixels.data[dest + 3] = 255;
      }
    }
  }
  for (
    let src = 0, dest = 0;
    !monochrome && dest < pixels.data.length;
    src += channels, dest += 4
  ) {
    pixels.data[dest] = image.data[src];
    pixels.data[dest + 1] = image.data[src + 1];
    pixels.data[dest + 2] = image.data[src + 2];
    pixels.data[dest + 3] = channels === 4 ? image.data[src + 3] : 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function scanLayout(
  pageWidth: number,
  pageHeight: number,
  scan: Pick<Scan, "bounds" | "headerBottom">,
  turn: number,
) {
  const { width, height } = scan.bounds,
    top = scan.headerBottom ? scan.headerBottom + 8 : 0;
  const scale = Math.min(
    pageWidth / (turn % 180 ? height : width),
    (pageHeight - top) / (turn % 180 ? width : height),
  );
  return {
    width: width * scale,
    height: height * scale,
    centerX: pageWidth / 2,
    centerY: top + (pageHeight - top) / 2,
  };
}

export function pdfImagePlacement(
  pageHeight: number,
  layout: ReturnType<typeof scanLayout>,
  turn: number,
) {
  const radians = (-turn * Math.PI) / 180,
    cos = Math.cos(radians),
    sin = Math.sin(radians);
  return {
    x: layout.centerX - (layout.width * cos - layout.height * sin) / 2,
    y:
      pageHeight -
      layout.centerY -
      (layout.width * sin + layout.height * cos) / 2,
    width: layout.width,
    height: layout.height,
  };
}

export function drawRotatedScan(
  context: any,
  scan: Scan,
  pageWidth: number,
  pageHeight: number,
  turn: number,
  pixelRatio = 2,
) {
  const layout = scanLayout(pageWidth, pageHeight, scan, turn);
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#fff";
  context.fillRect(
    scan.bounds.left,
    scan.bounds.top,
    scan.bounds.width,
    scan.bounds.height,
  );
  context.translate(layout.centerX, layout.centerY);
  context.rotate((turn * Math.PI) / 180);
  context.drawImage(
    scan.canvas,
    -layout.width / 2,
    -layout.height / 2,
    layout.width,
    layout.height,
  );
  context.restore();
}
