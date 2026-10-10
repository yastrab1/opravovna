import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import JSZip from "jszip";
import {
  gradedDocuments,
  hasPdfEdits,
  writePoints,
  addGradedPdf,
} from "./dist/export/archive-export.mjs";
export async function generateArchive(
  job,
  { initialized, getBucket, threads, pool, isClosing, directory },
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
  const zip = new JSZip();
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
          addGradedPdf(zip, document, output);
          job.completed++;
        } catch (error) {
          failure = error;
        }
      }
    },
  );
  await Promise.all(workers);
  if (failure) throw failure;
  if (isClosing())
    throw new Error("Server sa reštartuje. Skúste export znova.");
  await writePoints(
    zip,
    sourceZip,
    snapshot.documents,
    snapshot.project.legacy,
  );
  job.stage = "packing";
  await fs.mkdir(directory, { recursive: true });
  await pipeline(
    zip.generateNodeStream(
      { type: "nodebuffer", streamFiles: true, compression: "STORE" },
      (update) => {
        job.percent = Math.round(update.percent);
      },
    ),
    createWriteStream(job.file, { mode: 0o600 }),
  );
  job.status = "ready";
  job.stage = "ready";
  job.finished = Date.now();
  job.snapshot = null;
  console.log(
    `Export complete: ${job.total} PDFs, ${threads} render threads, ${Math.round(performance.now() - start)}ms`,
  );
}
