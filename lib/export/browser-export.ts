import { exportName, projectTitle } from "../archive";
import {
  addGradedPdf,
  gradedDocuments,
  hasPdfEdits,
  writePoints,
} from "../archive-export";
import { api, download } from "../client-api";
export async function exportZipBrowser({
  project,
  setError,
  setBusy,
  report,
}: {
  project: any;
  setError: any;
  setBusy: any;
  report: any;
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
    const zip = new JSZip();
    const { flattenPdf } = await import("@/lib/pdf-engine");
    await document.fonts.ready;
    const exportDocs = gradedDocuments(fresh.documents);
    for (let i = 0; i < exportDocs.length; i++) {
      const d = exportDocs[i];
      setBusy(`Exportujem PDF… ${i + 1} / ${exportDocs.length}`);
      const original = await fetch(
        `/api/projects/${pid}/documents/${d.id}/file`,
      );
      if (!original.ok) throw new Error("Pôvodné PDF sa nepodarilo načítať.");
      const originalBytes = new Uint8Array(await original.arrayBuffer());
      const changed = hasPdfEdits(d.state);
      const out = changed
        ? await flattenPdf(originalBytes, d.state)
        : originalBytes;
      addGradedPdf(zip, d, out);
    }
    await writePoints(zip, sourceZip, exportDocs);
    setBusy("Balím archív…");
    download(
      await zip.generateAsync({ type: "blob", compression: "STORE" }),
      exportName(fresh.folder ? projectTitle(fresh.folder) : fresh.title),
    );
  } catch (e) {
    report(e);
  } finally {
    setBusy("");
  }
}
