import JSZip from "jszip";
import { importTagMetadata } from "./archive-tags";
type CommentZip = JSZip & { comment?: string };
const PREFIX = "opravovna-tags:v1:";
const MAX_METADATA_BYTES = 16 * 1024 * 1024;

// Keep PMAT's points.json schema exact; optional round-trip data belongs in
// the standard ZIP comment, not among the website's grading records/files.
export async function writeTagComment(zip: JSZip, metadata: any) {
  const source = JSON.stringify(metadata);
  if (new TextEncoder().encode(source).byteLength > MAX_METADATA_BYTES)
    throw new Error("Metadáta štítkov sú príliš veľké na bezpečný export.");
  const payload = new JSZip();
  payload.file("tags.json", source);
  const comment =
    PREFIX +
    (await payload.generateAsync({
      type: "base64",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }));
  if (comment.length > 65_535)
    throw new Error(
      "Metadáta štítkov prekračujú limit ZIP komentára. Export sa zastavil, aby sa nestratili štítky.",
    );
  (zip as CommentZip).comment = comment;
}

export async function readTagComment(zip: JSZip, legacy: any) {
  const comment = (zip as CommentZip).comment;
  if (!comment?.startsWith(PREFIX)) return;
  const payload = await JSZip.loadAsync(comment.slice(PREFIX.length), {
    base64: true,
  });
  const file = payload.file("tags.json");
  if (
    !file ||
    ((file as any)._data?.uncompressedSize ?? Infinity) > MAX_METADATA_BYTES
  )
    throw new Error("Neplatné metadáta štítkov v ZIP komentári.");
  importTagMetadata(
    { opravovna: JSON.parse(await file.async("string")) },
    legacy,
  );
}
