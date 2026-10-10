import {
  collectTags,
  normalizeArnoldTagValues,
  normalizeArnoldLegacy,
} from "./tags";

// Keep Arnold's grading fields unchanged; namespaced metadata adds tag round trips.
export function exportTagMetadata(documents: any[], catalog: any[] = []) {
  catalog = normalizeArnoldLegacy({ tags: catalog }).tags;
  const tags = collectTags(
    catalog,
    ...documents.map((d) =>
      normalizeArnoldTagValues(d.state.tags ?? [], catalog),
    ),
  );
  return {
    version: 1,
    tags,
    submissions: Object.fromEntries(
      documents
        .filter((d) => d.state.scoring?.points != null)
        .map((d) => [
          d.metadata.submissionId,
          normalizeArnoldTagValues(d.state.tags ?? [], tags),
        ]),
    ),
  };
}
export function importTagMetadata(points: any, legacy: any) {
  const metadata = points.opravovna;
  if (metadata == null) return;
  if (
    metadata.version !== 1 ||
    !Array.isArray(metadata.tags) ||
    !metadata.submissions ||
    typeof metadata.submissions !== "object" ||
    Array.isArray(metadata.submissions)
  )
    throw new Error("Neplatné metadáta štítkov v points.json.");
  legacy.tags = normalizeArnoldLegacy({
    tags: collectTags(legacy.tags ?? [], metadata.tags),
  }).tags;
  legacy.changes ??= {};
  for (const [id, tags] of Object.entries(metadata.submissions)) {
    if (!Array.isArray(tags))
      throw new Error("Neplatné štítky riešenia v points.json.");
    legacy.changes[id] = {
      ...legacy.changes[id],
      tags: normalizeArnoldTagValues(tags, legacy.tags),
    };
  }
}
