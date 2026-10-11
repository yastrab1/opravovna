import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdir, rm } from "node:fs/promises";
const directory = new URL("../.test-tmp/preferences/", import.meta.url);
await mkdir(directory, { recursive: true });
try {
  await build({
    entryPoints: ["lib/preferences.ts", "lib/preference-cache.ts"],
    outdir: directory.pathname,
    bundle: true,
    platform: "node",
    format: "esm",
    outExtension: { ".js": ".mjs" },
  });
  const { readPreferences, defaultProjectPreferences } = await import(
    pathToFileURL(`${directory.pathname}preferences.mjs`)
  );
  const {
    mergePreferencePatch,
    readPendingPreferences,
    cachePendingPreferences,
  } = await import(pathToFileURL(`${directory.pathname}preference-cache.mjs`));
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const filters = {
    categories: ["c5", "k"],
    sort: "category",
    gradedFirst: true,
    taggedOnly: false,
    points: { comparison: "gt", value: "4,67" },
    query: "Novák",
    filter: "ungraded",
    tagFilter: "kontrola",
  };
  const remote = readPreferences({
    projects: {
      other: { ...defaultProjectPreferences(), query: "other project" },
    },
  });
  cachePendingPreferences(storage, "account-a", {
    projects: { current: filters },
  });
  assert.deepEqual(readPendingPreferences(storage, "account-b"), {});
  const afterReload = readPreferences(
    mergePreferencePatch(remote, readPendingPreferences(storage, "account-a")),
  );
  assert.deepEqual(afterReload.projects.current, filters);
  assert.equal(afterReload.projects.other.query, "other project");
  // The server representation restores all filters without any browser cache.
  const onAnotherDevice = readPreferences(
    JSON.parse(JSON.stringify(afterReload)),
  );
  assert.deepEqual(onAnotherDevice, afterReload);
  assert.deepEqual(onAnotherDevice.tools, remote.tools);
  cachePendingPreferences(storage, "account-a", {});
  assert.deepEqual(readPendingPreferences(storage, "account-a"), {});
  assert.equal(values.size, 0);
  assert.deepEqual(
    readPreferences({
      projects: { legacy: { categories: ["c8"], sort: "name" } },
    }).projects.legacy,
    {
      ...defaultProjectPreferences(),
      categories: ["c8"],
      points: { comparison: "all", value: "" },
    },
  );
  const invalid = readPreferences({
    projects: { bad: { query: 123, tagFilter: null, filter: "unknown" } },
  }).projects.bad;
  assert.equal(invalid.query, "");
  assert.equal(invalid.tagFilter, "");
  assert.equal(invalid.filter, "all");
  const migrated = readPreferences({ projects: { old: { sort: "graded" } } })
    .projects.old;
  assert.equal(migrated.sort, "name");
  assert.equal(migrated.gradedFirst, true);
  const blockedStorage = {
    getItem() {
      throw new Error("disabled");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("disabled");
    },
  };
  assert.deepEqual(readPendingPreferences(blockedStorage, "account-a"), {});
  assert.doesNotThrow(() =>
    cachePendingPreferences(blockedStorage, "account-a", { projects: {} }),
  );
  console.log(
    "PASS: all filters restore across reloads/devices, account/project isolation, legacy defaults and unavailable storage",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
