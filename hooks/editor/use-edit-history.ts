"use client";
import { fabricToLegacy, loadObjects } from "@/lib/pdf-engine";
import { useRef } from "react";
export function useEditHistory({
  canvas,
  blocked,
  loading,
  state,
  callbacks,
  currentPage,
  setRotation,
  pdf,
  setCount,
  setPageSizes,
  size,
  defaults,
}: {
  canvas: any;
  blocked: any;
  loading: any;
  state: any;
  callbacks: any;
  currentPage: any;
  setRotation: any;
  pdf: any;
  setCount: any;
  setPageSizes: React.Dispatch<
    React.SetStateAction<{ width: number; height: number }[]>
  >;
  size: any;
  defaults: any;
}) {
  const history = useRef<any[]>([]),
    future = useRef<any[]>([]);
  function emit(next: any, remember = true) {
    if (blocked.current || loading.current) return;
    if (remember) {
      history.current.push(structuredClone(state.current));
      future.current = [];
    }
    state.current = next;
    callbacks.current.onChange(next);
  }
  function capture() {
    if (!canvas.current || loading.current) return;
    const changes = canvas.current
      .getObjects()
      .map((o: any) => fabricToLegacy(o, currentPage.current));
    emit({
      ...state.current,
      changes: [
        ...state.current.changes.filter(
          (x: any) => x.page !== currentPage.current,
        ),
        ...changes,
      ],
    });
  }
  async function restore(next: any) {
    if (!canvas.current) return;
    loading.current = true;
    canvas.current.clear();
    await loadObjects(canvas.current, next.changes, currentPage.current);
    canvas.current.renderAll();
    loading.current = false;
    state.current = next;
    setRotation(next.rotations?.[currentPage.current] ?? 0);
    callbacks.current.onChange(next);
    const nextCount = (pdf.current?.numPages ?? 1) + (next.extraPages ?? 0);
    setCount(nextCount);
    setPageSizes((old) =>
      Array.from(
        { length: nextCount },
        (_, i) => old[i] ?? { width: 595.28, height: 841.89 },
      ),
    );
  }
  async function undo() {
    const next = history.current.pop();
    if (next) {
      future.current.push(structuredClone(state.current));
      await restore(next);
    }
  }
  async function redo() {
    const next = future.current.pop();
    if (next) {
      history.current.push(structuredClone(state.current));
      await restore(next);
    }
  }
  async function stamp(points: number) {
    if (!canvas.current || blocked.current) return false;
    const f = await import("fabric");
    loading.current = true;
    const prior = state.current.scoring?.annotName;
    canvas.current
      .getObjects()
      .filter((o: any) => o.name === prior || o.name?.startsWith("Score_"))
      .forEach((o: any) => canvas.current.remove(o));
    const name = "Text_" + crypto.randomUUID().slice(0, 9);
    const text = new f.IText(points + "B", {
      left: Math.max(20, size.width - 110),
      top: 35,
      fontFamily: defaults.stamp.font,
      fontSize: defaults.stamp.fontSize,
      fill: defaults.stamp.color,
      fontWeight: defaults.stamp.bold ? "bold" : "normal",
      fontStyle: defaults.stamp.italic ? "italic" : "normal",
    });
    text.set({ left: Math.max(15, size.width - text.width - 25) });
    (text as any).name = name;
    canvas.current.add(text);
    canvas.current.setActiveObject(text);
    canvas.current.renderAll();
    loading.current = false;
    const changes = canvas.current
      .getObjects()
      .map((o: any) => fabricToLegacy(o, currentPage.current));
    emit({
      ...state.current,
      changes: [
        ...state.current.changes.filter(
          (x: any) => x.page !== currentPage.current && x.data?.name !== prior,
        ),
        ...changes,
      ],
      scoring: {
        ...state.current.scoring,
        points,
        final: true,
        annotName: name,
        acceptedCriteria: state.current.scoring?.acceptedCriteria ?? [],
      },
    });
    return true;
  }
  function removeScore() {
    if (blocked.current || loading.current) return;
    const prior = state.current.scoring?.annotName;
    const isStamp = (o: any) =>
      Boolean(prior && o.name === prior) || o.name?.startsWith("Score_");
    loading.current = true;
    canvas.current
      ?.getObjects()
      .filter(isStamp)
      .forEach((o: any) => canvas.current.remove(o));
    canvas.current?.discardActiveObject();
    canvas.current?.renderAll();
    loading.current = false;
    emit({
      ...state.current,
      scoring: {},
      changes: state.current.changes.filter((x: any) => !isStamp(x.data ?? {})),
    });
  }
  return {
    history,
    future,
    emit,
    capture,
    restore,
    undo,
    redo,
    stamp,
    removeScore,
  };
}
