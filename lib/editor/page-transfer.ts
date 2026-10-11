import { constrainComment } from "./page-comment";

// Fabric coordinates belong to one page. Resolve the drop in screen space,
// then translate the object's origin into the destination page's coordinates.
export function textDropPage(
  object: any,
  source: number,
  bounds: (HTMLDivElement | null)[],
  sizes: { width: number; height: number }[],
) {
  if (!object.type.toLowerCase().includes("text")) return null;
  const from = bounds[source]?.getBoundingClientRect();
  if (!from || !from.width) return null;
  const scale = from.width / sizes[source].width;
  const box = object.getBoundingRect();
  const x = from.left + (box.left + box.width / 2) * scale;
  const y = from.top + (box.top + box.height / 2) * scale;
  const page = bounds.findIndex((node, index) => {
    if (!node || index === source) return false;
    const rect = node.getBoundingClientRect();
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  });
  if (page < 0) return null;
  const to = bounds[page]!.getBoundingClientRect();
  const destinationScale = to.width / sizes[page].width;
  object.set({
    left: (from.left + object.left * scale - to.left) / destinationScale,
    top: (from.top + object.top * scale - to.top) / destinationScale,
  });
  constrainComment(object, sizes[page].width);
  object.setCoords();
  return page;
}

export function bindPageDrag(canvas: any, stage: HTMLDivElement | null) {
  let frame = 0,
    delta = 0,
    target: any,
    ghost: HTMLImageElement | undefined;
  const preview = () => {
    if (!target || !ghost) return;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const box = target.getBoundingRect(),
      scale = rect.width / canvas.getWidth();
    Object.assign(ghost.style, {
      left: `${rect.left + box.left * scale}px`,
      top: `${rect.top + box.top * scale}px`,
      width: `${box.width * scale}px`,
      height: `${box.height * scale}px`,
    });
  };
  const scroll = () => {
    if (!delta || !stage) return;
    const before = stage.scrollTop;
    stage.scrollTop += delta;
    const scale =
      canvas.upperCanvasEl.getBoundingClientRect().height / canvas.getHeight();
    target.set({ top: target.top + (stage.scrollTop - before) / scale });
    target.setCoords();
    canvas.requestRenderAll();
    preview();
    frame = requestAnimationFrame(scroll);
  };
  const stop = () => {
    delta = 0;
    cancelAnimationFrame(frame);
    ghost?.remove();
    ghost = undefined;
    target = undefined;
  };
  canvas.on("object:moving", (event: any) => {
    if (!stage || !event.target.type.toLowerCase().includes("text")) return;
    target = event.target;
    if (!ghost) {
      ghost = document.createElement("img");
      ghost.src = target.toDataURL();
      ghost.alt = "";
      Object.assign(ghost.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "100",
        opacity: "0.8",
      });
      document.body.appendChild(ghost);
    }
    preview();
    const y = event.e.clientY ?? event.e.touches?.[0]?.clientY;
    const rect = stage.getBoundingClientRect();
    delta = y < rect.top + 50 ? -18 : y > rect.bottom - 50 ? 18 : 0;
    cancelAnimationFrame(frame);
    if (delta) frame = requestAnimationFrame(scroll);
  });
  canvas.on("mouse:up", stop);
  return stop;
}
