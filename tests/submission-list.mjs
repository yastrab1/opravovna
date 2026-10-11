import assert from "node:assert/strict";
import { build } from "esbuild";
await build({
  entryPoints: ["lib/submission-list.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".test-tmp/submission-list.mjs",
});
const { navigationDocuments } =
  await import("../.test-tmp/submission-list.mjs");
const docs = [
  ["Zora", "k", null, []],
  ["Anna", "5", 4.67, ["uf"]],
  ["Boris", "t", 0, [{ name: "__any__" }]],
  ["Cyril", "5", null, []],
  ["Dana", "p", 8, []],
].map(([name, rocnik, points, tags], i) => ({
  id: String(i),
  metadata: { name, rocnik, submissionId: i },
  state: { scoring: points == null ? {} : { points }, tags },
}));
const defaults = {
  query: "",
  categories: [],
  tagFilter: "",
  taggedOnly: false,
  gradedFirst: false,
  sort: "name",
};
const names = (patch) =>
  navigationDocuments({ documents: docs }, { ...defaults, ...patch }).map(
    (d) => d.metadata.name,
  );
assert.deepEqual(names({}), ["Anna", "Boris", "Cyril", "Dana", "Zora"]);
assert.deepEqual(names({ sort: "category" }), [
  "Anna",
  "Cyril",
  "Dana",
  "Boris",
  "Zora",
]);
assert.deepEqual(names({ sort: "points" }), [
  "Boris",
  "Anna",
  "Dana",
  "Cyril",
  "Zora",
]);
assert.deepEqual(names({ sort: "category", gradedFirst: true }), [
  "Anna",
  "Dana",
  "Boris",
  "Cyril",
  "Zora",
]);
assert.deepEqual(names({ taggedOnly: true }), ["Anna", "Boris"]);
assert.deepEqual(
  names({ tagFilter: "__any__" }),
  ["Boris"],
  "Literal tag names must not collide with Any tag",
);
assert.deepEqual(
  names({ categories: ["5"], points: { comparison: "gt", value: "4,5" } }),
  ["Anna"],
);
console.log(
  "PASS: independent graded-first checkbox, Slovak category and decimal point sorting, missing grades last and any-tag filtering",
);
