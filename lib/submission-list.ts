import {
  categoryLabel,
  compareCategories,
  type ProjectPreferences,
} from "./preferences";
import { emptyPointsFilter, matchesPoints } from "./points-filter";
import { tagName } from "./tags";
export function navigationDocuments(
  project: any,
  preferences: ProjectPreferences,
): any[] {
  const { query, categories, tagFilter, taggedOnly, gradedFirst, sort } =
    preferences;
  const byName = (a: any, b: any) =>
    a.metadata.name.localeCompare(b.metadata.name, "sk", { numeric: true }) ||
    Number(a.metadata.submissionId) - Number(b.metadata.submissionId);
  return (project?.documents ?? [])
    .filter(
      (d: any) =>
        `${d.metadata.name} ${d.metadata.submissionId} ${d.metadata.rocnik} ${categoryLabel(d.metadata.rocnik)}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        matchesPoints(
          d.state.scoring?.points,
          preferences.points ?? emptyPointsFilter,
        ) &&
        (!categories.length || categories.includes(d.metadata.rocnik)) &&
        (!taggedOnly || d.state.tags.length > 0) &&
        (!tagFilter || d.state.tags.some((t: any) => tagName(t) === tagFilter)),
    )
    .sort((a: any, b: any) => {
      const ap = a.state.scoring?.points,
        bp = b.state.scoring?.points;
      const byPoints =
        ap == null ? (bp == null ? 0 : 1) : bp == null ? -1 : ap - bp;
      return (
        (gradedFirst ? Number(bp != null) - Number(ap != null) : 0) ||
        (sort === "category"
          ? compareCategories(a.metadata.rocnik, b.metadata.rocnik)
          : sort === "points"
            ? byPoints
            : 0) ||
        byName(a, b)
      );
    });
}
