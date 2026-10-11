"use client";
import EditorToolbar from "@/components/editor/editor-toolbar";
import PageControls from "@/components/editor/page-controls";
import PageStack from "@/components/editor/page-stack";
import { useAnnotationCanvas } from "@/hooks/editor/use-annotation-canvas";
import { useEditHistory } from "@/hooks/editor/use-edit-history";
import { usePdfPages } from "@/hooks/editor/use-pdf-pages";
import { fabricToLegacy } from "@/lib/pdf-annotations";
import { textDropPage } from "@/lib/editor/page-transfer";
import { styleAnnotation } from "@/lib/editor/annotation-style";
import { insertImage } from "@/lib/editor/insert-image";

import { type Preferences, type ToolKey } from "@/lib/preferences";
import { useEffect, useRef, useState } from "react";
type Props = {
  defaults: Preferences["tools"];
  doc: any;
  projectId: string;
  readonly: boolean;
  onChange: (state: any) => void;
  onError: (s: string) => void;
  register: (api: any) => void;
};
export default function PdfEditor({
  defaults,
  doc,
  projectId,
  readonly,
  onChange,
  onError,
  register,
}: Props) {
  const stage = useRef<HTMLDivElement>(null),
    annotationHosts = useRef<(HTMLDivElement | null)[]>([]),
    pdfCanvases = useRef<(HTMLCanvasElement | null)[]>([]),
    pageBounds = useRef<(HTMLDivElement | null)[]>([]);
  const blocked = useRef(readonly);
  blocked.current = readonly;
  const canvas = useRef<any>(null),
    pdf = useRef<any>(null),
    state = useRef<any>(doc.state),
    callbacks = useRef({ onChange, onError });
  callbacks.current = { onChange, onError };
  const [page, setPage] = useState(0),
    [count, setCount] = useState(1),
    [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>(
      [],
    ),
    [tool, setTool] = useState("select"),
    [color, setColor] = useState(defaults.text.color),
    [font, setFont] = useState(defaults.text.font),
    [fontSize, setFontSize] = useState(defaults.text.fontSize),
    [width, setWidth] = useState(defaults.text.width),
    [zoom, setZoom] = useState(1),
    [ready, setReady] = useState(false),
    [rotation, setRotation] = useState(0);
  const [bold, setBold] = useState(defaults.text.bold),
    [italic, setItalic] = useState(defaults.text.italic);
  function applyDefaults(key: ToolKey) {
    const value = defaults[key];
    setColor(value.color);
    setFont(value.font);
    setFontSize(value.fontSize);
    setWidth(value.width);
    setBold(value.bold);
    setItalic(value.italic);
  }
  function chooseTool(key: string) {
    setTool(key);
    if (key !== "select") applyDefaults(key as ToolKey);
  }
  useEffect(() => {
    applyDefaults(tool === "select" ? "text" : (tool as ToolKey));
  }, [defaults]);
  const mode = useRef({ tool, color, font, fontSize, width, bold, italic });
  mode.current = { tool, color, font, fontSize, width, bold, italic };
  const size = pageSizes[page] ?? { width: 595.28, height: 841.89 };
  const rotationKey = JSON.stringify(doc.state.rotations ?? {});
  const initialFit = useRef(true);
  const loading = useRef(false),
    currentPage = useRef(0);

  const { history, future, emit, capture, undo, redo, stamp, removeScore } =
    useEditHistory({
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
    });

  usePdfPages({
    ready,
    pdf,
    doc,
    projectId,
    state,
    setPage,
    setPageSizes,
    setReady,
    initialFit,
    history,
    future,
    setCount,
    callbacks,
    pdfCanvases,
    pageSizes,
    rotationKey,
  });
  useAnnotationCanvas({
    ready,
    currentPage,
    page,
    loading,
    pageSizes,
    initialFit,
    stage,
    setZoom,
    setRotation,
    state,
    annotationHosts,
    readonly,
    canvas,
    capture,
    transferText,
    blocked,
    mode,
    setTool,
    callbacks,
    doc,
    tool,
    color,
    width,
  });
  register({ stamp, removeScore, undo, redo });

  useEffect(() => {
    state.current = doc.state;
  }, [doc.state]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest("input,textarea,select") ||
        canvas.current?.getActiveObject()?.isEditing
      )
        return;
      if (readonly) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function remove() {
    const c = canvas.current;
    if (!c) return;
    c.getActiveObjects().forEach((o: any) => c.remove(o));
    c.discardActiveObject();
    c.renderAll();
    capture();
  }
  function style(key: string, value: any) {
    const c = canvas.current;
    if (!c || readonly) return;
    c.getActiveObjects().forEach((o: any) => {
      styleAnnotation(o, key, value, size.width);
    });
    c.renderAll();
    capture();
  }
  function transferText(object: any) {
    const destination = textDropPage(
      object,
      currentPage.current,
      pageBounds.current,
      pageSizes,
    );
    if (destination === null) return false;
    emit({
      ...state.current,
      changes: [
        ...state.current.changes.filter(
          (change: any) => change.data?.name !== object.name,
        ),
        fabricToLegacy(object, destination),
      ],
    });
    setPage(destination);
    return true;
  }
  async function image(file: File) {
    await insertImage(file, { canvas, size, capture, onError });
  }
  function scrollToPage(index: number) {
    pageBounds.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
  function updateCurrentPage() {
    if (!stage.current || canvas.current?.getActiveObject()?.isMoving) return;
    const center =
      stage.current.getBoundingClientRect().top +
      stage.current.clientHeight / 2;
    let best = page,
      dist = Infinity;
    pageBounds.current.forEach((node, index) => {
      if (!node) return;
      const rect = node.getBoundingClientRect(),
        d = Math.abs((rect.top + rect.bottom) / 2 - center);
      if (d < dist) {
        dist = d;
        best = index;
      }
    });
    if (best !== page) {
      setPage(best);
      setRotation(state.current.rotations?.[best] ?? 0);
    }
  }

  return (
    <section className="editor">
      <EditorToolbar
        readonly={readonly}
        tool={tool}
        chooseTool={chooseTool}
        image={image}
        color={color}
        setColor={setColor}
        canvas={canvas}
        font={font}
        setFont={setFont}
        style={style}
        fontSize={fontSize}
        setFontSize={setFontSize}
        bold={bold}
        setBold={setBold}
        italic={italic}
        setItalic={setItalic}
        width={width}
        setWidth={setWidth}
        undo={undo}
        redo={redo}
        remove={remove}
      />
      <PageControls
        pdf={pdf}
        onError={onError}
        page={page}
        count={count}
        scrollToPage={scrollToPage}
        setPage={setPage}
        zoom={zoom}
        setZoom={setZoom}
        readonly={readonly}
        rotation={rotation}
        setRotation={setRotation}
        emit={emit}
        state={state}
        pageSizes={pageSizes}
        setPageSizes={setPageSizes}
        setCount={setCount}
      />
      <PageStack
        changes={doc.state.changes}
        stage={stage}
        updateCurrentPage={updateCurrentPage}
        ready={ready}
        pageSizes={pageSizes}
        zoom={zoom}
        pageBounds={pageBounds}
        pdf={pdf}
        pdfCanvases={pdfCanvases}
        page={page}
        annotationHosts={annotationHosts}
      />
    </section>
  );
}
