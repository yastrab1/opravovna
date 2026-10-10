import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

/** Prepare assets before Vite copies public/ into the browser build. */
export async function preparePdfAssets(root = process.cwd()) {
  const require = createRequire(import.meta.url);
  const packageFile = require.resolve("pdfjs-dist/package.json");
  const source = path.dirname(packageFile);
  const { version } = JSON.parse(await fs.readFile(packageFile, "utf8"));
  const target = path.join(root, "public/pdfjs", version);
  await fs.mkdir(target, { recursive: true });
  await Promise.all(
    ["wasm", "cmaps", "standard_fonts", "LICENSE"].map((entry) =>
      fs.cp(path.join(source, entry), path.join(target, entry), { recursive: true }),
    ),
  );
  return { version, target };
}
