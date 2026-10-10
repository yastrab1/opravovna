import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Worker } from "node:worker_threads";

export async function prepareExportRuntime(name) {
  const root = path.resolve(".test-tmp", name);
  execFileSync(process.execPath, [
    "scripts/build-export.mjs",
    path.join(root, "dist/export"),
  ]);
  for (const file of [
    "exporter.mjs",
    "pdf-worker.mjs",
    "canvas-environment.mjs",
    "render-pool.mjs",
    "generate-archive.mjs",
  ]) {
    try {
      await fs.copyFile("deploy/runtime/" + file, path.join(root, file));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return root;
}
export async function renderWithWorker(root, bytes, state) {
  const worker = new Worker(path.join(root, "pdf-worker.mjs"));
  try {
    return await new Promise((resolve, reject) => {
      worker.once("error", reject);
      worker.once("exit", (code) =>
        reject(new Error("Render worker exited: " + code)),
      );
      worker.once("message", (result) =>
        result.error ? reject(new Error(result.error)) : resolve(result.bytes),
      );
      worker.postMessage({ id: "test", bytes, state });
    });
  } finally {
    await worker.terminate();
  }
}
