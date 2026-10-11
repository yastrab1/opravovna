import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { prepareExportRuntime } from "./support/runtime.mjs";
const root = await prepareExportRuntime("export-parts-runtime");
const { createExporter } = await import(path.join(root, "exporter.mjs"));
const bytes = new TextEncoder().encode("%PDF-" + "test".repeat(2000));
const source = new JSZip();
const documents = Array.from({ length: 5 }, (_, i) => ({
  id: `solution-${i}`,
  path: `folder/p4-c8-person-${i}-${i + 1}.pdf`,
  original: `pdf-${i}`,
  metadata: { submissionId: String(i + 1) },
  state: {
    changes: [],
    tags: ["uf"],
    scoring: { points: i + 0.25, comments: [`comment-${i}`] },
  },
}));
source.file(
  "/points.json",
  JSON.stringify({ criteria: { x: "criterion" }, scores: {} }),
);
const archive = await source.generateAsync({ type: "uint8array" });
const exporter = createExporter(
  async () => ({
    get: async (key) => ({
      body: new Blob([key === "archive" ? archive : bytes]).stream(),
    }),
  }),
  {
    directory: path.join(root, "artifacts"),
    threads: 1,
    partBytes: 20_000,
  },
);
const headers = { "x-export-owner": "owner", "x-export-project": "project" };
const call = (url, init = {}) =>
  exporter.fetch(
    new Request(`http://internal${url}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    }),
  );
async function create(docs = documents) {
  let job = await (
    await call("/create", {
      method: "POST",
      body: JSON.stringify({
        project: { id: "project", title: "4. Problem", archive: "archive" },
        documents: docs,
      }),
    })
  ).json();
  const deadline = Date.now() + 10_000;
  while (!["ready", "error"].includes(job.status)) {
    assert(Date.now() < deadline);
    await new Promise((r) => setTimeout(r, 20));
    job = await (await call(`/jobs/${job.id}`)).json();
  }
  return job;
}
try {
  const job = await create();
  assert.equal(job.status, "ready", job.error);
  assert.equal(job.parts.length, 3);
  assert.equal((await call(`/jobs/${job.id}/download`)).status, 409);
  const seen = new Set();
  for (const part of job.parts) {
    assert(part.bytes <= 20_000);
    assert.equal(
      part.file,
      undefined,
      "Private file paths must never be exposed",
    );
    const response = await call(`/jobs/${job.id}/download?part=${part.part}`);
    assert.equal(response.status, 200);
    assert.equal(Number(response.headers.get("Content-Length")), part.bytes);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const points = JSON.parse(await zip.file("/points.json").async("string"));
    assert.deepEqual(points.criteria, { x: "criterion" });
    assert.equal(Object.keys(points.scores).length, part.count);
    assert.equal(Object.keys(zip.files).length, part.count + 1);
    for (const [id, score] of Object.entries(points.scores)) {
      assert(!seen.has(id));
      seen.add(id);
      const document = documents.find((d) => d.metadata.submissionId === id);
      assert.equal(score.points, document.state.scoring.points);
      assert.deepEqual(score.comments, document.state.scoring.comments);
      assert.deepEqual(points.opravovna.submissions[id], ["uf"]);
      assert.deepEqual(
        await zip.file(document.path.split("/").pop()).async("uint8array"),
        bytes,
      );
    }
    assert.equal(
      (
        await call(`/jobs/${job.id}/download?part=${part.part}`, {
          headers: { "x-export-owner": "other" },
        })
      ).status,
      404,
    );
  }
  assert.equal(seen.size, documents.length);
  for (const invalid of ["0", "4", "-1", "1.5", "../", ""])
    assert.equal(
      (await call(`/jobs/${job.id}/download?part=${invalid}`)).status,
      404,
    );
  const huge = structuredClone(documents.slice(0, 1));
  huge[0].state.scoring.comments = ["x".repeat(25_000)];
  const failed = await create(huge);
  assert.equal(failed.status, "error");
  assert.equal(failed.failedSolution.id, huge[0].id);
  assert.equal((await call(`/jobs/${failed.id}/download`)).status, 409);
  assert.equal(
    (await fs.readdir(path.join(root, "artifacts"))).filter((p) =>
      p.startsWith(failed.id),
    ).length,
    0,
  );
  console.log(
    "PASS: size-bounded multipart exports, exact-once scores/PDFs/tags, original root filenames, isolated downloads and linked oversized solution",
  );
} finally {
  await exporter.close();
}
