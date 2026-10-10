import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import JSZip from "jszip";
await fs.mkdir(".test-tmp/tag-roundtrip", { recursive: true });
for (const name of ["tags", "archive-tags", "archive-export"]) {
  const source = await fs.readFile(`lib/${name}.ts`, "utf8");
  const js = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/(from\s+['"]\.\/[^'"]+)(['"])/g, "$1.mjs$2");
  await fs.writeFile(`.test-tmp/tag-roundtrip/${name}.mjs`, js);
}
const { writePoints } =
  await import("../.test-tmp/tag-roundtrip/archive-export.mjs");
const { importTagMetadata } =
  await import("../.test-tmp/tag-roundtrip/archive-tags.mjs");
const tag = { id: "arnold-tag-id", meno: "uf", color: "blue" };
const doc = (id, tags, points = 4.67) => ({
  metadata: { submissionId: id },
  state: { tags, changes: [], scoring: { points } },
});
const documents = [
  doc("1", [tag.id]),
  doc("2", []),
  doc("3", ["kontrola"], null),
];
const zip = new JSZip();
await writePoints(zip, new JSZip(), documents, { tags: [tag, tag.id] });
assert.deepEqual(Object.keys(zip.files), ["/points.json"]);
const points = JSON.parse(await zip.file("/points.json").async("string"));
assert.equal(points.scores["1"].points, 4.67);
assert.deepEqual(points.scores["1"].comments, ["4.67B"]);
assert.equal(points.scores["3"], undefined);
assert.equal(points.opravovna.submissions["1"][0].name, "uf");
assert.deepEqual(points.opravovna.submissions["2"], []);
assert.equal(points.opravovna.submissions["3"], undefined);
assert(
  points.opravovna.tags.includes("kontrola"),
  "Project vocabulary includes unassigned/export-omitted tags",
);
assert(
  !points.opravovna.tags.includes(tag.id),
  "Mapped tag IDs are not exported as separate names",
);
const legacy = {
  changes: {
    1: { scoring: { points: 1 }, opened: true },
    2: { tags: ["old"] },
  },
};
importTagMetadata(points, legacy);
assert.equal(legacy.changes["1"].tags[0].name, "uf");
assert.equal(legacy.changes["1"].tags[0].color, "blue");
assert.equal(legacy.changes["1"].opened, true);
assert.deepEqual(legacy.changes["2"].tags, []);
assert.throws(() =>
  importTagMetadata(
    { opravovna: { version: 1, tags: [], submissions: { 1: "bad" } } },
    {},
  ),
);
const original = { changes: { 1: { tags: ["existing"] } } };
importTagMetadata({ criteria: {}, scores: {} }, original);
assert.deepEqual(
  original.changes["1"].tags,
  ["existing"],
  "Original Arnold points.json remains supported",
);
console.log(
  "PASS: root-only Arnold scores plus tag ID/name/color/empty-assignment round trip and global vocabulary",
);
