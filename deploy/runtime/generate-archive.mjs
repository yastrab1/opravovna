import fs from "node:fs/promises";
import JSZip from "jszip";
import { gradedDocuments, hasPdfEdits } from "./dist/export/archive-export.mjs";
import { archiveParts } from "./dist/export/archive-parts.mjs";
export async function generateArchive(
  job,
  { initialized, getBucket, threads, pool, isClosing, directory, partBytes },
) {
  const start = performance.now();
  await initialized;
  job.status = "running";
  job.stage = "loading";
  const { snapshot } = job,
    bucket = await getBucket();
  const original = await bucket.get(snapshot.project.archive);
  if (!original) throw new Error("Pôvodný ZIP archív sa nenašiel.");
  // Consume the R2 body stream. Calling arrayBuffer() on Miniflare's proxy
  // serializes the entire file through RPC and blocks other requests.
  const sourceZip = await JSZip.loadAsync(
    await new Response(original.body).arrayBuffer(),
  );
  const entries = [];
  const exportDocuments = gradedDocuments(snapshot.documents);
  let index = 0,
    failure;
  job.stage = "pdf";
  const workers = Array.from(
    { length: Math.min(threads, exportDocuments.length) },
    async () => {
      while (!failure && !isClosing() && index < exportDocuments.length) {
        const document = exportDocuments[index++];
        try {
          const input = await bucket.get(document.original);
          if (!input) throw new Error("Pôvodné PDF sa nenašlo.");
          const bytes = new Uint8Array(
            await new Response(input.body).arrayBuffer(),
          );
          const { state } = document;
          const changed = hasPdfEdits(state);
          const output = changed ? await pool.run(bytes.slice(), state) : bytes;
          entries.push({ document, bytes: output });
          job.completed++;
        } catch (error) {
          if (!failure) {
            failure = error;
            job.failedSolution = {
              id: document.id,
              path: document.path,
              label: document.metadata?.name || document.path.split("/").pop(),
            };
          }
        }
      }
    },
  );
  await Promise.all(workers);
  if (failure) throw failure;
  if (isClosing())
    throw new Error("Server sa reštartuje. Skúste export znova.");
  job.stage = "packing";
  await fs.mkdir(directory, { recursive: true });
  entries.sort((a, b) => a.document.path.localeCompare(b.document.path));
  job.parts = [];
  for await (const part of archiveParts(
    entries,
    sourceZip,
    snapshot.project.legacy,
    partBytes,
  )) {
    const number = job.parts.length + 1;
    const file = job.file.replace(/\.zip$/, `-part-${number}.zip`);
    job.files.push(file);
    await fs.writeFile(file, part.bytes, { mode: 0o600 });
    job.parts.push({
      part: number,
      bytes: part.bytes.byteLength,
      count: part.count,
    });
    job.percent = Math.round(
      (job.parts.reduce((sum, p) => sum + p.count, 0) /
        Math.max(1, job.total)) *
        100,
    );
  }
  job.status = "ready";
  job.stage = "ready";
  job.finished = Date.now();
  job.snapshot = null;
  console.log(
    `Export complete: ${job.total} PDFs, ${threads} render threads, ${Math.round(performance.now() - start)}ms`,
  );
}
