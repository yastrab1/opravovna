import { archiveParts, type ExportEntry } from "../archive-parts";
import { exportName, projectTitle } from "../archive";
import { gradedDocuments, hasPdfEdits } from "../archive-export";
import { api, download } from "../client-api";
export async function exportZipBrowser({
  project,
  setError,
  setBusy,
  report,
  publishDownloads,
}: {
  project: any;
  setError: any;
  setBusy: any;
  report: any;
  publishDownloads: any;
}) {
  setError("");
  try {
    setBusy("Načítavam archív zo servera…");
    const pid = project.id;
    const fresh = await api("projects/" + pid);
    const JSZip = (await import("jszip")).default;
    const res = await fetch("/api/projects/" + pid + "/archive");
    if (!res.ok) throw new Error("Najprv importujte ZIP archív.");
    const sourceZip = await JSZip.loadAsync(await res.arrayBuffer());
    const entries: ExportEntry[] = [];
    const { flattenPdf } = await import("@/lib/pdf-engine");
    await document.fonts.ready;
    const exportDocs = gradedDocuments(fresh.documents);
    for (let i = 0; i < exportDocs.length; i++) {
      const d = exportDocs[i];
      setBusy(`Exportujem PDF… ${i + 1} / ${exportDocs.length}`);
      try {
        const original = await fetch(
          `/api/projects/${pid}/documents/${d.id}/file`,
        );
        if (!original.ok) throw new Error("Pôvodné PDF sa nepodarilo načítať.");
        const originalBytes = new Uint8Array(await original.arrayBuffer());
        const changed = hasPdfEdits(d.state);
        const out = changed
          ? await flattenPdf(originalBytes, d.state)
          : originalBytes;
        entries.push({ document: d, bytes: out });
      } catch (error) {
        throw Object.assign(
          error instanceof Error ? error : new Error(String(error)),
          {
            failedSolution: {
              project: pid,
              id: d.id,
              path: d.path,
              label: d.metadata?.name || d.path.split("/").pop(),
            },
          },
        );
      }
    }
    setBusy("Balím archív…");
    const parts = [];
    try {
      for await (const part of archiveParts(entries, sourceZip, fresh.legacy)) {
        parts.push({
          part: parts.length + 1,
          count: part.count,
          bytes: part.bytes.byteLength,
          url: URL.createObjectURL(
            new Blob([new Uint8Array(part.bytes)], { type: "application/zip" }),
          ),
        });
      }
    } catch (error: any) {
      for (const part of parts) URL.revokeObjectURL(part.url);
      if (error.failedSolution) error.failedSolution.project = pid;
      throw error;
    }
    const filename = exportName(
      fresh.folder ? projectTitle(fresh.folder) : fresh.title,
    );
    publishDownloads({ project: pid, filename, expires: false, parts });
    if (parts.length === 1) {
      download(await (await fetch(parts[0].url)).blob(), filename);
      publishDownloads(null);
    }
  } catch (e) {
    report(e);
  } finally {
    setBusy("");
  }
}
