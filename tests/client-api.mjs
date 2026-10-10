import assert from "node:assert/strict";
import { api } from "../lib/client-api.ts";
const originalFetch = globalThis.fetch,
  originalTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => originalTimeout(fn, 0);
try {
  let requests = 0;
  globalThis.fetch = async () => {
    if (++requests < 3) throw new TypeError("NetworkError");
    return Response.json({ ok: true });
  };
  assert.deepEqual(await api("projects"), { ok: true });
  assert.equal(requests, 3);
  requests = 0;
  const body = new Blob(["PDF"]);
  globalThis.fetch = async (_, options) => {
    assert.equal(options.body, body);
    if (++requests === 1) return new Response("bad gateway", { status: 502 });
    return Response.json({ ok: true });
  };
  await api("projects/example/uploads/example?part=1", { method: "PUT", body });
  assert.equal(requests, 2);
  requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new TypeError("NetworkError");
  };
  await assert.rejects(
    api("projects", { method: "POST", body: "{}" }),
    /Spojenie/,
  );
  assert.equal(requests, 1, "Non-idempotent writes must not be replayed");
  requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ error: "Denied" }, { status: 403 });
  };
  await assert.rejects(api("projects"), (e) => e.status === 403);
  assert.equal(requests, 1);
  console.log(
    "PASS: bounded network/gateway retries for reads and replayable upload chunks; no retry for non-idempotent writes or permissions",
  );
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalTimeout;
}
const ts = await import("typescript"),
  fs = await import("node:fs/promises");
await fs.mkdir(".test-tmp", { recursive: true });
const uploadSource = (await fs.readFile("lib/import/upload-archive.ts", "utf8"))
  .replace('"../client-api"', '"../lib/client-api.ts"')
  .replace("'../client-api'", "'../lib/client-api.ts'");
await fs.writeFile(
  ".test-tmp/upload-archive.mjs",
  ts.default.transpileModule(uploadSource, {
    compilerOptions: {
      target: ts.default.ScriptTarget.ES2022,
      module: ts.default.ModuleKind.ESNext,
    },
  }).outputText,
);
const { uploadArchive } = await import("../.test-tmp/upload-archive.mjs");
const calls = [];
try {
  globalThis.fetch = async (path, options) => {
    calls.push([path, options.method]);
    if (path.endsWith("/archive"))
      return Response.json({ id: "upload", key: "stored.zip" });
    if (options.method === "PUT") return Response.json({ partNumber: 1 });
    if (path.endsWith("/uploads/upload"))
      throw new TypeError("NetworkError after commit");
    return Response.json({ archive: "stored.zip" });
  };
  await uploadArchive(
    new File(["zip"], "sample.zip"),
    "projects/example",
    () => {},
  );
  assert.equal(
    calls.filter(([, method]) => method === "POST").length,
    2,
    "Completion is never blindly replayed",
  );
  assert.equal(
    calls.at(-1)[1],
    undefined,
    "Lost completion response is confirmed by reading project state",
  );
  console.log(
    "PASS: completed ZIP upload recovers from a lost response without duplicate completion",
  );
} finally {
  globalThis.fetch = originalFetch;
}
