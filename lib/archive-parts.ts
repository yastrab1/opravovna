import JSZip from "jszip";
import { addGradedPdf, writePoints } from "./archive-export";

// Leave room below common upload limits. Measure the complete ZIP, including JSON.
export const EXPORT_PART_BYTES = 80_000_000;
export type ExportEntry = { document: any; bytes: Uint8Array };
export async function* archiveParts(
  entries: ExportEntry[],
  source: JSZip,
  legacy: any,
  limit = EXPORT_PART_BYTES,
): AsyncGenerator<{ bytes: Uint8Array; count: number }> {
  const names = new Set<string>();
  for (const { document } of entries) {
    const name = document.path.split("/").pop();
    if (!name || names.has(name))
      throw new Error("Export obsahuje duplicitný názov PDF.");
    names.add(name);
  }
  async function* pack(group: ExportEntry[]): AsyncGenerator<{
    bytes: Uint8Array;
    count: number;
  }> {
    const zip = new JSZip();
    for (const entry of group) addGradedPdf(zip, entry.document, entry.bytes);
    await writePoints(
      zip,
      source,
      group.map((entry) => entry.document),
      legacy,
    );
    const bytes = await zip.generateAsync({
      type: "uint8array",
      compression: "STORE",
    });
    if (bytes.byteLength <= limit) {
      yield { bytes, count: group.length };
    } else if (group.length > 1) {
      const middle = Math.ceil(group.length / 2);
      yield* pack(group.slice(0, middle));
      yield* pack(group.slice(middle));
    } else {
      const document = group[0]?.document;
      throw Object.assign(
        new Error(
          "Jedno riešenie presahuje limit 80 MB pre import. Skontrolujte veľkosť PDF a komentárov.",
        ),
        {
          failedSolution: document && {
            id: document.id,
            path: document.path,
            label: document.metadata?.name || document.path.split("/").pop(),
          },
        },
      );
    }
  }
  let group: ExportEntry[] = [],
    size = 0;
  for (const entry of entries) {
    if (
      group.length &&
      size + entry.bytes.byteLength > limit - Math.min(100_000, limit * 0.05)
    ) {
      yield* pack(group);
      group = [];
      size = 0;
    }
    group.push(entry);
    size += entry.bytes.byteLength;
  }
  if (group.length || !entries.length) yield* pack(group);
}
