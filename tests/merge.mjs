import assert from "node:assert/strict";
import { mergeDecision, mergeLegacy, normalizedState } from "../lib/merge.ts";
const empty = normalizedState(),
  edited = (n) =>
    normalizedState({
      changes: [
        {
          page: 0,
          type: "Text",
          data: { text: "Komentár " + n, name: "Text_" + n },
        },
      ],
      scoring: { points: 4.67, annotName: "Text_" + n },
    });
assert.equal(mergeDecision(empty, edited(1)), "replace");
assert.equal(mergeDecision(edited(1), empty), "keep");
assert.equal(mergeDecision(edited(1), structuredClone(edited(1))), "keep");
assert.equal(mergeDecision(edited(1), edited(2)), "conflict");
assert.equal(
  mergeDecision(edited(1), {
    extraPages: 0,
    rotations: {},
    scoring: { annotName: "Text_1", points: 4.67 },
    tags: [],
    changes: [
      { type: "Text", page: 0, data: { name: "Text_1", text: "Komentár 1" } },
    ],
  }),
  "keep",
  "Property order cannot create a conflict",
);
const project = new Map(Array.from({ length: 40 }, (_, i) => [i + 1, empty]));
for (let n = 1; n <= 10; n++) project.set(n, edited(n));
let conflicts = 0;
for (let n = 1; n <= 40; n++) {
  const incoming = n >= 20 ? edited(n) : empty;
  const decision = mergeDecision(project.get(n), incoming);
  if (decision === "replace") project.set(n, incoming);
  if (decision === "conflict") conflicts++;
}
assert.equal(conflicts, 0);
assert.equal([...project.values()].filter((x) => x.changes.length).length, 31);
assert.equal(project.get(1).changes[0].data.text, "Komentár 1");
assert.equal(project.get(40).changes[0].data.text, "Komentár 40");
assert.equal(mergeDecision(project.get(7), edited("different")), "conflict");
const chosenSecond = edited("different");
project.set(7, chosenSecond);
assert.equal(project.get(7), chosenSecond);
const first = {
    tags: ["a"],
    scoringCriteria: [],
    changes: { 1: { opened: true } },
    unknown: "preserve",
  },
  second = {
    tags: ["a", "b"],
    scoringCriteria: [],
    changes: { 2: { opened: true } },
  };
const merged = mergeLegacy(first, second);
assert.deepEqual(merged.tags, ["a", "b"]);
assert.deepEqual(Object.keys(merged.changes), ["1", "2"]);
assert.equal(merged.unknown, "preserve");
assert.deepEqual(first.tags, ["a"], "Merge does not mutate inputs");
console.log(
  "PASS: disjoint 1–10 / 20–40 export merge, empty-record protection, duplicate detection, first/second conflict choices and legacy metadata preservation",
);

const { sameGradedSubmission } = await import("../lib/import/equivalence.ts");
const previousFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
try {
  const plain = normalizedState({ scoring: { points: 4.67 } });
  assert.equal(
    await sameGradedSubmission(
      "project",
      { id: "doc", state: plain },
      structuredClone(plain),
      new Uint8Array([1, 2, 3]),
    ),
    true,
  );
  const taggedOnly = normalizedState({
    tags: [
      {
        id: "arnold-tag",
        meno: "kontrola",
        name: "kontrola",
        color: "#F2C511ff",
      },
    ],
  });
  assert.equal(
    await sameGradedSubmission(
      "project",
      { id: "doc", state: normalizedState() },
      taggedOnly,
      new Uint8Array([1, 2, 3]),
    ),
    false,
    "An unchanged ungraded PDF cannot hide imported Arnold tags",
  );
  assert.equal(
    mergeDecision(normalizedState(), taggedOnly),
    "replace",
    "Tag-only changes must import into an untouched solution",
  );
  assert.equal(
    await sameGradedSubmission(
      "project",
      { id: "doc", state: taggedOnly },
      structuredClone(taggedOnly),
      new Uint8Array([1, 2, 3]),
    ),
    true,
    "Reimporting identical tags stays a duplicate",
  );
  const drawn = {
    ...plain,
    changes: [{ page: 0, type: "Path", data: { path: "M 0 0 L 10 10" } }],
  };
  assert.equal(
    await sameGradedSubmission(
      "project",
      { id: "doc", state: plain },
      drawn,
      new Uint8Array([1, 2, 3]),
    ),
    false,
    "Same original bytes cannot hide new annotations",
  );
} finally {
  globalThis.fetch = previousFetch;
}
