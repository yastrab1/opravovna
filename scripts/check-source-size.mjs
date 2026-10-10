import fs from "node:fs/promises";
import path from "node:path";
const limit = 300;
async function inspect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(tsx?|mjs|cjs)$/.test(file)) {
      const count = (await fs.readFile(file, "utf8"))
        .trimEnd()
        .split("\n").length;
      if (count > limit)
        throw new Error(
          `${file}: ${count} lines (limit ${limit}); extract a focused module.`,
        );
    }
  }
}
for (const directory of [
  "app",
  "components",
  "hooks",
  "lib",
  "db",
  "deploy/runtime",
])
  await inspect(directory);
console.log(`Application source files stay within ${limit} lines.`);
