export async function insertImage(
  file: File,
  {
    canvas,
    size,
    capture,
    onError,
  }: {
    canvas: any;
    size: { width: number; height: number };
    capture: () => void;
    onError: (message: string) => void;
  },
) {
  if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    onError("Vyberte obrázok do 5 MB.");
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * ratio);
    c.height = Math.round(bitmap.height * ratio);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    const src = c.toDataURL("image/webp", 0.85);
    if (src.length > 1_000_000)
      throw new Error("Obrázok je príliš zložitý. Zmenšite ho a skúste znova.");
    const f = await import("fabric");
    const img = await f.FabricImage.fromURL(src);
    img.scaleToWidth(Math.min(240, size.width - 40));
    img.set({ left: 30, top: 60 });
    (img as any).name = "Image_" + crypto.randomUUID().slice(0, 9);
    canvas.current.add(img);
    canvas.current.setActiveObject(img);
    capture();
  } catch (e: any) {
    onError(e.message);
  }
}
