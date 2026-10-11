"use client";
import { fonts } from "@/lib/preferences";
import {
  ArrowUpRight,
  Bold,
  Circle,
  Highlighter,
  ImagePlus,
  Italic,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
export default function EditorToolbar({
  readonly,
  tool,
  chooseTool,
  image,
  color,
  setColor,
  canvas,
  font,
  setFont,
  style,
  fontSize,
  setFontSize,
  bold,
  setBold,
  italic,
  setItalic,
  width,
  setWidth,
  undo,
  redo,
  remove,
}: {
  readonly: any;
  tool: any;
  chooseTool: any;
  image: any;
  color: any;
  setColor: any;
  canvas: any;
  font: any;
  setFont: any;
  style: any;
  fontSize: any;
  setFontSize: any;
  bold: any;
  setBold: any;
  italic: any;
  setItalic: any;
  width: any;
  setWidth: any;
  undo: any;
  redo: any;
  remove: any;
}) {
  const tools = [
    ["select", "Vybrať", MousePointer2],
    ["text", "Text", Type],
    ["draw", "Kresliť", Pencil],
    ["highlight", "Zvýrazniť", Highlighter],
    ["arrow", "Šípka", ArrowUpRight],
    ["rect", "Obdĺžnik", Square],
    ["circle", "Elipsa", Circle],
  ] as const;
  return (
    <div className="toolbar" aria-label="Anotačné nástroje">
      <div className="toolgroup">
        {tools.map(([key, label, Icon]) => (
          <button
            key={key}
            disabled={readonly}
            title={label}
            aria-label={label}
            aria-pressed={tool === key}
            className={tool === key ? "active" : ""}
            onClick={() => chooseTool(key)}
          >
            <Icon size={18} />
          </button>
        ))}
        <label
          className={"iconbutton " + (readonly ? "disabled" : "")}
          title="Vložiť obrázok"
        >
          <ImagePlus size={18} />
          <input
            aria-label="Vložiť obrázok"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={readonly}
            hidden
            onChange={(e) => e.target.files?.[0] && image(e.target.files[0])}
          />
        </label>
      </div>
      <div className="toolgroup">
        <input
          aria-label="Farba"
          type="color"
          value={color}
          disabled={readonly}
          onChange={(e) => {
            setColor(e.target.value);
            style("color", e.target.value);
          }}
        />
        <select
          aria-label="Písmo"
          value={font}
          disabled={readonly}
          onChange={(e) => {
            setFont(e.target.value);
            style("fontFamily", e.target.value);
          }}
        >
          {fonts.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          className="number"
          type="number"
          aria-label="Veľkosť písma"
          min="8"
          max="120"
          value={fontSize}
          disabled={readonly}
          onChange={(e) => {
            const n = Math.max(8, Math.min(120, +e.target.value));
            setFontSize(n);
            style("fontSize", n);
          }}
        />
        <button
          title="Tučné"
          aria-label="Tučné"
          disabled={readonly}
          aria-pressed={bold}
          onClick={() => {
            const value =
              canvas.current?.getActiveObject()?.fontWeight === "bold"
                ? false
                : !bold;
            setBold(value);
            style("fontWeight", value ? "bold" : "normal");
          }}
        >
          <Bold size={16} />
        </button>
        <button
          title="Kurzíva"
          aria-label="Kurzíva"
          disabled={readonly}
          aria-pressed={italic}
          onClick={() => {
            const value =
              canvas.current?.getActiveObject()?.fontStyle === "italic"
                ? false
                : !italic;
            setItalic(value);
            style("fontStyle", value ? "italic" : "normal");
          }}
        >
          <Italic size={16} />
        </button>
        <select
          aria-label="Hrúbka čiary"
          value={width}
          disabled={readonly}
          onChange={(e) => setWidth(+e.target.value)}
        >
          {[1, 2, 3, 5, 8].map((x) => (
            <option key={x} value={x}>
              {x} px
            </option>
          ))}
        </select>
      </div>
      <div className="toolgroup">
        <button
          aria-label="Späť"
          title="Späť (Ctrl+Z)"
          disabled={readonly}
          onClick={undo}
        >
          <Undo2 size={17} />
        </button>
        <button
          aria-label="Znova"
          title="Znova"
          disabled={readonly}
          onClick={redo}
        >
          <Redo2 size={17} />
        </button>
        <button
          aria-label="Odstrániť výber"
          title="Odstrániť výber"
          disabled={readonly}
          onClick={remove}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
}
