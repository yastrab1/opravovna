import assert from "node:assert/strict";
import { build } from "esbuild";
await build({
  entryPoints: ["lib/export/server-export.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".test-tmp/export-errors.mjs",
});
const { exportZip } = await import("../.test-tmp/export-errors.mjs");
const failedSolution = {
  id: "solution-4",
  path: "original.pdf",
  label: "Solution 4",
};
let reported,
  saves = 0,
  requests = 0,
  busy;
const oldFetch = globalThis.fetch;
globalThis.fetch = async () => {
  requests++;
  return Response.json({
    id: "job",
    status: "error",
    error: "PDF failed",
    failedSolution,
  });
};
try {
  const options = {
    project: { id: "project-4" },
    save: async () => {
      saves++;
      return true;
    },
    setError: () => {},
    setBusy: (value) => {
      busy = value;
    },
    report: (error) => {
      reported = error;
    },
    publishDownloads: () => assert.fail("Failed exports have no downloads"),
    exportZipBrowser: () => assert.fail("No browser fallback for a PDF error"),
  };
  await exportZip(options);
  assert.equal(saves, 1);
  assert.equal(reported.message, "PDF failed");
  assert.deepEqual(reported.failedSolution, {
    ...failedSolution,
    project: "project-4",
  });
  assert.equal(busy, "");
  await exportZip({ ...options, save: async () => false });
  assert.equal(
    requests,
    1,
    "A save conflict must stop export before any request",
  );
  let downloads;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({
      id: "parts-job",
      status: "ready",
      filename: "original_opravene.zip",
      parts: [
        { part: 1, bytes: 70_000_000, count: 12 },
        { part: 2, bytes: 20_000_000, count: 4 },
      ],
    });
  };
  await exportZip({
    ...options,
    publishDownloads: (value) => {
      downloads = value;
    },
  });
  assert.equal(
    requests,
    2,
    "Multipart export must not trigger automatic bulk downloads",
  );
  assert.equal(downloads.project, "project-4");
  assert.equal(downloads.filename, "original_opravene.zip");
  assert.equal(
    downloads.parts[1].url,
    "/api/projects/project-4/export/parts-job/download?part=2",
  );
  console.log(
    "PASS: export errors retain failing solution permalink identity; save conflicts block export",
  );
} finally {
  globalThis.fetch = oldFetch;
}
