import fs from "node:fs/promises";
import ts from "typescript";
const directory = process.argv[2] ?? "dist/export";
await fs.mkdir(directory, { recursive: true });
for (const file of [
  "annotation-images",
  "pdf-assets",
  "pdf-annotations",
  "pdf-image",
  "pdf-scan",
  "pdf-rotation",
  "pdf-render",
  "archive",
  "archive-export",
]) {
  const source = await fs.readFile(`lib/${file}.ts`, "utf8");
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(
      /(from\s+['"]\.\/[^'"]+)(['"])/g,
      (match, path, quote) =>
        `${path}${path.endsWith(".mjs") ? "" : ".mjs"}${quote}`,
    );
  await fs.writeFile(`${directory}/${file}.mjs`, output);
}
