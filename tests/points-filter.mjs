import assert from "node:assert/strict";
import { matchesPoints, readPointsFilter } from "../lib/points-filter.ts";
const filter = (comparison, value) => ({ comparison, value });
assert(matchesPoints(4.67, filter("eq", "4,67")));
assert(!matchesPoints(4.67, filter("eq", "4.68")));
assert(matchesPoints(0, filter("eq", "0")));
assert(matchesPoints(12.5, filter("gt", "5")));
assert(!matchesPoints(5, filter("gt", "5")));
assert(matchesPoints(4.67, filter("lt", "5")));
assert(!matchesPoints(5, filter("lt", "5")));
assert(!matchesPoints(null, filter("lt", "5")));
assert(!matchesPoints(undefined, filter("eq", "0")));
assert(matchesPoints(undefined, filter("all", "5")));
assert(matchesPoints(4.67, filter("eq", "")));
assert(matchesPoints(4.67, filter("eq", "-1")));
assert.deepEqual(readPointsFilter({ comparison: "unknown", value: 4 }), {
  comparison: "all",
  value: "",
});
console.log(
  "PASS: fractional equality, strict less/greater, zero, ungraded exclusion and disabled/incomplete filter",
);
