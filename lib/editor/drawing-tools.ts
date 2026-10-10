import { createPageComment } from "./page-comment";
export function bindDrawingTools(
  own: any,
  f: any,
  {
    blocked,
    loading,
    mode,
    capture,
    setTool,
  }: { blocked: any; loading: any; mode: any; capture: any; setTool: any },
) {
  let start: any = null,
    shape: any = null;
  own.on("mouse:down", async (e: any) => {
    if (blocked.current || loading.current) return;
    const m = mode.current;
    if (["select", "draw", "highlight"].includes(m.tool)) return;
    const point = own.getScenePoint(e.e);
    start = point;
    const common = {
      left: point.x,
      top: point.y,
      fill: "transparent",
      stroke: m.color,
      strokeWidth: m.width,
    };
    if (m.tool === "text") {
      const t = createPageComment(f, point, own.getWidth(), {
        fill: m.color,
        fontFamily: m.font,
        fontSize: m.fontSize,
        fontWeight: m.bold ? "bold" : "normal",
        fontStyle: m.italic ? "italic" : "normal",
      });
      (t as any).name = "Text_" + crypto.randomUUID().slice(0, 9);
      own.add(t);
      own.setActiveObject(t);
      t.enterEditing();
      t.selectAll();
      capture();
      setTool("select");
      return;
    }
    if (m.tool === "rect")
      shape = new f.Rect({ ...common, width: 1, height: 1 });
    if (m.tool === "circle") shape = new f.Ellipse({ ...common, rx: 1, ry: 1 });
    if (m.tool === "arrow")
      shape = new f.Line([point.x, point.y, point.x, point.y], {
        stroke: m.color,
        strokeWidth: m.width,
      });
    if (shape) {
      shape.name = crypto.randomUUID();
      own.add(shape);
    }
  });
  own.on("mouse:move", (e: any) => {
    if (!shape || !start) return;
    const p = own.getScenePoint(e.e);
    const m = mode.current;
    if (m.tool === "arrow") shape.set({ x2: p.x, y2: p.y });
    else {
      shape.set({
        left: Math.min(start.x, p.x),
        top: Math.min(start.y, p.y),
      });
      if (m.tool === "circle")
        shape.set({
          rx: Math.abs(p.x - start.x) / 2,
          ry: Math.abs(p.y - start.y) / 2,
        });
      else
        shape.set({
          width: Math.abs(p.x - start.x),
          height: Math.abs(p.y - start.y),
        });
    }
    own.renderAll();
  });
  own.on("mouse:up", () => {
    if (!shape) return;
    if (mode.current.tool === "arrow") {
      const x = shape.x2,
        y = shape.y2;
      const angle =
        (Math.atan2(y - shape.y1, x - shape.x1) * 180) / Math.PI + 90;
      const head = new f.Triangle({
        left: x,
        top: y,
        originX: "center",
        originY: "center",
        width: 12,
        height: 15,
        angle,
        fill: mode.current.color,
      });
      (head as any).name = crypto.randomUUID();
      own.add(head);
    }
    shape.setCoords();
    shape = null;
    start = null;
    capture();
    setTool("select");
  });
}
export function configureTool(c: any, f: any, mode: any, readonly: boolean) {
  if (!c) return;
  const m = mode.current;
  c.isDrawingMode = !readonly && ["draw", "highlight"].includes(m.tool);
  c.selection = !readonly && m.tool === "select";
  c.getObjects().forEach((o: any) =>
    o.set({
      selectable: !readonly && m.tool === "select",
      evented: !readonly && m.tool === "select",
    }),
  );
  c.defaultCursor = m.tool === "select" ? "default" : "crosshair";
  if (c.isDrawingMode) {
    c.freeDrawingBrush = new f.PencilBrush(c);
    c.freeDrawingBrush.color =
      m.tool === "highlight" ? m.color + "55" : m.color;
    c.freeDrawingBrush.width = m.tool === "highlight" ? m.width * 6 : m.width;
  }
}
