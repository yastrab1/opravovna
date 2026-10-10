import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
await fs.mkdir(".test-tmp/import", { recursive: true });
for (const name of ["archive", "merge", "tags", "import/prepare-scores"]) {
  const source = await fs.readFile(`lib/${name}.ts`, "utf8");
  const output = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/(from\s+['"]\.\.?\/[^'"]+)(['"])/g, "$1.mjs$2");
  await fs.writeFile(`.test-tmp/${name}.mjs`, output);
}
const { parsePoints, prepareScores } =
  await import("../.test-tmp/import/prepare-scores.mjs");
for (const [value, expected] of [
  [0, 0],
  [4.67, 4.67],
  [12.125, 12.125],
  [" 7,25 ", 7.25],
  ["4.67", 4.67],
  [-1, null],
  ["", null],
  ["hello", null],
  [Infinity, null],
  [NaN, null],
  [false, null],
  [{}, null],
])
  assert.equal(parsePoints(value), expected);
const paths = [
  "p4-c8-alice-100.pdf",
  "p4-c8-bob-200.pdf",
  "p4-c8-cara-300.pdf",
];
const legacy = {
  changes: {
    100: {
      scoring: { points: -2, annotName: "grade" },
      changes: [
        { type: "Text", page: 0, data: { name: "grade", text: "-2B" } },
        { type: "Text", page: 0, data: { name: "comment", text: "Keep this" } },
      ],
    },
    200: { scoring: { points: "7,125" } },
    300: { scoring: { points: "not a number" } },
  },
};
let prompts = 0;
const states = await prepareScores(paths, legacy, {}, {}, async (issues) => {
  prompts++;
  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((x) => x.name),
    ["Alice", "Cara"],
  );
  return { [paths[0]]: 6.67, [paths[2]]: 0 };
});
assert.equal(prompts, 1);
assert.equal(states.get(paths[0]).scoring.points, 6.67);
assert.equal(states.get(paths[0]).changes[0].data.text, "6.67B");
assert.equal(states.get(paths[0]).changes[1].data.text, "Keep this");
assert.equal(states.get(paths[1]).scoring.points, 7.125);
assert.equal(states.get(paths[2]).scoring.points, 0);
assert.equal(legacy.changes[100].scoring.points, 6.67);
assert.equal(
  await prepareScores(
    [paths[0]],
    { changes: { 100: { scoring: { points: -1 } } } },
    {},
    {},
    async () => null,
  ),
  null,
  "Cancel stops before upload",
);
assert.equal(
  (
    await prepareScores(
      [paths[0]],
      {},
      {},
      { 100: { points: "14.875" } },
      async () => assert.fail("Valid scores must not prompt"),
    )
  ).get(paths[0]).scoring.points,
  14.875,
);
console.log(
  "PASS: unrestricted non-negative decimal grades, numeric string normalization, grouped correction, linked stamp updates, cancel",
);
