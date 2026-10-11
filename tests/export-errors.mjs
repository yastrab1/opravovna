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
  console.log(
    "PASS: export errors retain failing solution permalink identity; save conflicts block export",
  );
} finally {
  globalThis.fetch = oldFetch;
}
