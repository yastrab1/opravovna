export type PointsFilter = {
  comparison: "all" | "eq" | "lt" | "gt";
  value: string;
};
export const emptyPointsFilter: PointsFilter = { comparison: "all", value: "" };
export function readPointsFilter(raw: any): PointsFilter {
  return {
    comparison: ["eq", "lt", "gt"].includes(raw?.comparison)
      ? raw.comparison
      : "all",
    value: typeof raw?.value === "string" ? raw.value : "",
  };
}
export function matchesPoints(points: unknown, filter: PointsFilter) {
  if (filter.comparison === "all" || !filter.value.trim()) return true;
  const target = Number(filter.value.replace(",", "."));
  if (!Number.isFinite(target) || target < 0) return true;
  if (typeof points !== "number" || !Number.isFinite(points)) return false;
  switch (filter.comparison) {
    case "eq":
      return points === target;
    case "lt":
      return points < target;
    case "gt":
      return points > target;
  }
}
