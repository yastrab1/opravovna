// Annotations are portable embedded assets. Reject external image references
// before hydration in either runtime, including images nested in groups/patterns.
export function validateAnnotationImages(value: unknown) {
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current)) {
      if (
        (key === "src" || key === "source") &&
        typeof child === "string" &&
        !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(child)
      )
        throw new Error("Obrázky v anotáciách musia byť vložené do dokumentu.");
      if (child && typeof child === "object") pending.push(child);
    }
  }
}
