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
