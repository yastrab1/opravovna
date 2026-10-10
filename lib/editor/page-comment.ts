const pageMargin = 16;
export function constrainComment(comment: any, pageWidth: number) {
  if (comment.type?.toLowerCase() !== "textbox") return;
  const left = Math.max(0, Math.min(comment.left, pageWidth - pageMargin - 32));
  const available = Math.max(
    1,
    (pageWidth - left - pageMargin) / Math.abs(comment.scaleX || 1),
  );
  const width = Math.min(comment.width, available);
  comment.set({ left, width });
  comment.initDimensions();
  // Fabric normally wraps words. A single oversized token must also fit the page.
  if (comment.width > available) {
    comment.set({ splitByGrapheme: true, width: available });
    comment.initDimensions();
  }
  comment.setCoords();
}
export function createPageComment(
  fabric: any,
  point: { x: number; y: number },
  pageWidth: number,
  style: any,
) {
  const left = Math.max(0, Math.min(point.x, pageWidth - pageMargin - 32));
  const comment = new fabric.Textbox("Text", {
    ...style,
    left,
    top: point.y,
    width: Math.max(1, pageWidth - left - pageMargin),
    originX: "left",
    originY: "top",
  });
  constrainComment(comment, pageWidth);
  return comment;
}
