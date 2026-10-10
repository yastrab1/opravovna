import type JSZip from "jszip";

export function gradedDocuments(documents: any[]) {
  return documents.filter((document) => document.state.scoring?.points != null);
}

export function hasPdfEdits(state: any) {
  return Boolean(
    state.changes?.length ||
    state.extraPages ||
    Object.values(state.rotations ?? {}).some((value) => value !== 0),
  );
}

export async function writePoints(
  zip: JSZip,
  sourceZip: JSZip,
  documents: any[],
) {
  const original = Object.values(sourceZip.files).find(
    (entry) =>
      !entry.dir && /(^|\/)points?\.json$/i.test(entry.name.replace(/^\//, "")),
  );
  let points: any = { criteria: {}, scores: {} };
  if (original) {
    try {
      const parsed = JSON.parse(await original.async("string"));
      if (parsed && typeof parsed === "object")
        points = { ...points, ...parsed, scores: {} };
    } catch {
      /* Older archives may not have usable scores. */
    }
  }
  for (const document of gradedDocuments(documents)) {
    const scoring = document.state.scoring;
    const comments = (document.state.changes ?? [])
      .filter(
        (change: any) =>
          change.type === "Text" &&
          change.data?.text &&
          change.data.name !== scoring.annotName,
      )
      .map((change: any) => change.data.text);
    points.scores[document.metadata.submissionId] = {
      acceptedCriteria: scoring.acceptedCriteria ?? [],
      final: scoring.final ?? true,
      points: scoring.points,
      comments: scoring.comments ?? [...comments, `${scoring.points}B`],
    };
  }
  // Arnold uses this literal root entry, including its leading slash.
  zip.file("/points.json", JSON.stringify(points, null, 2));
}

export function addGradedPdf(zip: JSZip, document: any, bytes: Uint8Array) {
  const basename = document.path.split("/").pop();
  if (!basename || zip.file(basename))
    throw new Error("Export obsahuje duplicitný názov PDF.");
  zip.file(basename, bytes);
}
