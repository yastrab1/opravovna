import fs from "node:fs/promises";
import assert from "node:assert/strict";
import ts from "typescript";
import { nativeFabric } from "../deploy/runtime/canvas-environment.mjs";
await fs.mkdir(".test-tmp", { recursive: true });
await fs.writeFile(
  ".test-tmp/page-comment.mjs",
  ts.transpileModule(await fs.readFile("lib/editor/page-comment.ts", "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText,
);
const { createPageComment, constrainComment } =
  await import("../.test-tmp/page-comment.mjs");
const f = await nativeFabric();
for (const [left, text] of [
  [
    100,
    "Dlhý komentár má zostať na strane a pokračovať na ďalšom riadku. ".repeat(
      4,
    ),
  ],
  [530, "BezMedzierVelmiDlhyKomentar".repeat(8)],
]) {
  const box = createPageComment(f, { x: left, y: 100 }, 600, {
    fontFamily: "Ubuntu",
    fontSize: 20,
  });
  box.set({ text });
  box.initDimensions();
  constrainComment(box, 600);
  assert.equal(box.text, text, "Wrapping must preserve text");
  assert(box.textLines.length > 1, "Comment wraps");
  const bounds = box.getBoundingRect();
  assert(
    bounds.left + bounds.width <= 585,
    "Comment stays inside right margin",
  );
  box.set({ left: 570, fontSize: 30 });
  box.initDimensions();
  constrainComment(box, 600);
  const moved = box.getBoundingRect();
  assert(
    moved.left + moved.width <= 585,
    "Moving/enlarging keeps wrapping within page",
  );
}
console.log(
  "PASS: comments wrap at right page margin, preserve text and fit after moving/font changes, including long tokens",
);

await fs.writeFile(
  ".test-tmp/annotation-style.mjs",
  ts.transpileModule(
    (await fs.readFile("lib/editor/annotation-style.ts", "utf8")).replace(
      '"./page-comment"',
      '"./page-comment.mjs"',
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText,
);
const { styleAnnotation } = await import("../.test-tmp/annotation-style.mjs");
const rich = new f.Textbox("Imported comment", {
  width: 450,
  fontFamily: "Arial",
  fill: "#000000",
  styles: {
    0: { 0: { fill: "#ff0000", fontFamily: "Georgia", fontWeight: "bold" } },
  },
});
styleAnnotation(rich, "color", "#123456", 600);
styleAnnotation(rich, "fontFamily", "Courier New", 600);
assert.equal(rich.getSelectionStyles(0, 1, true)[0].fill, "#123456");
assert.equal(rich.getSelectionStyles(0, 1, true)[0].fontFamily, "Courier New");
assert.equal(
  rich.getSelectionStyles(0, 1, true)[0].fontWeight,
  "bold",
  "Unrelated formatting stays intact",
);
rich.isEditing = true;
rich.selectionStart = 1;
rich.selectionEnd = 4;
styleAnnotation(rich, "color", "#abcdef", 600);
assert.equal(rich.getSelectionStyles(0, 1, true)[0].fill, "#123456");
assert(
  rich
    .getSelectionStyles(1, 4, true)
    .every((style) => style.fill === "#abcdef"),
);
rich.isEditing = false;
styleAnnotation(rich, "fontSize", 30, 600);
assert(
  rich
    .getSelectionStyles(0, rich.text.length, true)
    .every((style) => style.fontSize === 30),
);
const restored = await f.Textbox.fromObject(rich.toObject());
assert.equal(
  restored.getSelectionStyles(2, 3, true)[0].fill,
  "#abcdef",
  "Formatting survives serialization",
);
const shape = new f.Rect({ fill: "transparent", stroke: "#000000" });
styleAnnotation(shape, "color", "#123456", 600);
assert.equal(shape.stroke, "#123456");
assert.equal(shape.fill, "transparent");
console.log(
  "PASS: imported character overrides, selected-range formatting, unrelated styles and saved formatting",
);

await fs.writeFile(
  ".test-tmp/page-transfer.mjs",
  ts.transpileModule(
    (await fs.readFile("lib/editor/page-transfer.ts", "utf8")).replace(
      '"./page-comment"',
      '"./page-comment.mjs"',
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText,
);
const { textDropPage } = await import("../.test-tmp/page-transfer.mjs");
const bounds = [0, 430].map((top) => ({
  getBoundingClientRect: () => ({
    left: 30,
    top,
    width: 300,
    height: 400,
    right: 330,
    bottom: top + 400,
  }),
}));
const sizes = [
  { width: 600, height: 800 },
  { width: 600, height: 800 },
];
const moving = new f.Textbox("Move me", {
  left: 60,
  top: 940,
  width: 200,
  fontFamily: "Arial",
  fontSize: 20,
  fill: "#123456",
});
assert.equal(textDropPage(moving, 0, bounds, sizes), 1);
assert.equal(moving.left, 60);
assert.equal(moving.top, 80, "Drop position accounts for zoom and page gap");
assert.equal(moving.text, "Move me");
assert.equal(moving.fill, "#123456");
assert.equal(
  textDropPage(moving, 1, bounds, sizes),
  null,
  "Moving within the page keeps its identity",
);
assert.equal(
  textDropPage(shape, 0, bounds, sizes),
  null,
  "Only text boxes transfer",
);
console.log(
  "PASS: text page transfer translates zoomed coordinates and preserves content/styles",
);
