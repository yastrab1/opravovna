import assert from "node:assert/strict";
import { build } from "esbuild";
await build({
  entryPoints: ["lib/workspace-url.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".test-tmp/workspace-url.mjs",
});
const { readWorkspaceUrl, workspaceUrl, writeWorkspaceUrl } =
  await import("../.test-tmp/workspace-url.mjs");
const origin = new URL(
  "https://opravovna.tech/?join=private-token&utm=test#page",
);
const target = { project: "project-123", solution: "solution-456" };
const permalink = workspaceUrl(origin, target);
assert.equal(permalink.origin, origin.origin);
assert.equal(
  permalink.searchParams.has("join"),
  false,
  "Solution link must not leak invitation token",
);
assert.equal(permalink.searchParams.get("utm"), "test");
assert.deepEqual(readWorkspaceUrl(permalink), target);
assert.deepEqual(
  readWorkspaceUrl(new URL(permalink.href)),
  target,
  "Copied URL survives a fresh load",
);
assert.deepEqual(
  readWorkspaceUrl(
    workspaceUrl(origin, { project: "p &/=", solution: "s č&/=" }),
  ),
  { project: "p &/=", solution: "s č&/=" },
);
assert.deepEqual(
  readWorkspaceUrl(new URL("https://opravovna.tech/?project=p")),
  { project: "p", solution: null },
);
assert.equal(
  readWorkspaceUrl(new URL("https://opravovna.tech/?solution=s")),
  null,
);
assert.equal(readWorkspaceUrl(workspaceUrl(permalink, null)), null);
const writes = [];
globalThis.window = {
  location: { href: origin.href },
  history: {
    state: { framework: "preserved" },
    pushState(state, unused, url) {
      writes.push({ mode: "push", state, url: url.href });
      window.location.href = url.href;
    },
    replaceState(state, unused, url) {
      writes.push({ mode: "replace", state, url: url.href });
      window.location.href = url.href;
    },
  },
};
writeWorkspaceUrl(target);
assert.equal(writes.length, 1);
assert.deepEqual(writes[0].state, { framework: "preserved" });
writeWorkspaceUrl(target);
assert.equal(
  writes.length,
  1,
  "Repeated state must not add duplicate history entries",
);
writeWorkspaceUrl({ project: "p", solution: "s" }, "none");
assert.equal(writes.length, 1, "Restoring history must not push new entries");
writeWorkspaceUrl(null, "replace");
assert.equal(writes[1].mode, "replace");
delete globalThis.window;
console.log(
  "PASS: persistent project/solution URLs, encoded IDs, invite-token removal, history modes and framework state preservation",
);
