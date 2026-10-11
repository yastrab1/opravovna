import { readTagComment } from "../archive-tag-comment";
import { importTagMetadata } from "../archive-tags";
import { writeImportedVersion } from "./write-version";
import { uploadArchive } from "./upload-archive";
import {
  gradedFilePath,
  legacyGradedFilePath,
  parseSubmission,
} from "../archive";
import { api } from "../client-api";
import { mergeDecision } from "../merge";
import { normalizeArnoldLegacy } from "../tags";
import { sameGradedSubmission, sameBytes } from "./equivalence";
import { prepareScores, type CorrectScores } from "./prepare-scores";
export async function importZip(
  file: File,
  {
    correctScores,
    project,
    setError,
    save,
    mergePending,
    report,
    setBusy,
    list,
    open,
    setMergeConflicts,
    setMergeOpen,
  }: {
    correctScores: CorrectScores;
    project: any;
    setError: any;
    save: any;
    mergePending: any;
    report: any;
    setBusy: any;
    list: any;
    open: any;
    setMergeConflicts: React.Dispatch<React.SetStateAction<any[]>>;
    setMergeOpen: any;
  },
) {
  if (!file) return;
  if (mergePending.current) {
    report("Najprv vyriešte konflikty z predchádzajúceho importu.");
    return;
  }
  if (!(await save())) return;
  setError("");
  try {
    if (!file.name.toLowerCase().endsWith(".zip") || file.size > 1024 ** 3)
      throw new Error("Vyberte ZIP archív do 1 GB.");
    setBusy("Kontrolujem archív…");
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((x) => !x.dir);
    let total = 0;
    let pdfs = entries.filter(
      (x) => /\.pdf$/i.test(x.name) && parseSubmission(x.name),
    );
    const gradedOnly = !pdfs.length;
    if (gradedOnly)
      pdfs = entries.filter(
        (x) =>
          /_graded\.pdf$/i.test(x.name) &&
          parseSubmission(x.name.replace(/_graded\.pdf$/i, ".pdf")),
      );
    if (!pdfs.length)
      throw new Error(
        "ZIP neobsahuje riešenia vo formáte p4-c8-meno-12345.pdf.",
      );
    const submissionIds = pdfs.map(
      (f) =>
        parseSubmission(
          gradedOnly ? f.name.replace(/_graded\.pdf$/i, ".pdf") : f.name,
        )!.submissionId,
    );
    if (new Set(submissionIds).size !== submissionIds.length)
      throw new Error("Archív obsahuje viac PDF pre rovnaké riešenie.");
    if (pdfs.length > 2000) throw new Error("Najviac 2000 riešení na projekt.");
    // Validate before creating files; no archive paths are ever used as storage keys.
    for (const f of entries) {
      if (
        f.name.includes("..") ||
        (f.name.startsWith("/") && f.name !== "/points.json") ||
        f.name.includes("\\")
      )
        throw new Error("Archív obsahuje neplatnú cestu.");
      total += (f as any)._data?.uncompressedSize ?? 0;
    }
    if (total > 2 * 1024 ** 3)
      throw new Error("Rozbalený archív je príliš veľký.");
    if (
      !gradedOnly &&
      project.folder &&
      pdfs.some((f) => {
        const folder = parseSubmission(f.name)?.folder;
        return Boolean(folder && folder !== project.folder);
      })
    )
      throw new Error(
        "Tento ZIP patrí do iného projektu. Vytvorte nový projekt.",
      );
    const pid = project.id;
    const root = "projects/" + pid;
    const conflicts: any[] = [];
    let incomingLegacy: any = {};
    if (zip.file("changes.arn")) {
      const { unpack } = await import("msgpackr");
      incomingLegacy = normalizeArnoldLegacy(
        unpack(await zip.file("changes.arn")!.async("uint8array")),
      );
    }
    const pointsFile = entries.find((x) =>
      /(^|\/)points?\.json$/i.test(x.name.replace(/^\//, "")),
    );
    let pointScores: any = {};
    if (pointsFile) {
      const parsed = JSON.parse(await pointsFile.async("string"));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.scores ||
        typeof parsed.scores !== "object"
      )
        throw new Error("Neplatný formát points.json.");
      importTagMetadata(parsed, incomingLegacy);
      pointScores = parsed.scores;
      incomingLegacy.changes ??= {};
      for (const [id, score] of Object.entries(pointScores)) {
        if (!score || typeof score !== "object") continue;
        const old = incomingLegacy.changes[id] ?? {};
        incomingLegacy.changes[id] = {
          ...old,
          scoring: { ...old.scoring, ...score },
        };
      }
    }
    await readTagComment(zip, incomingLegacy);
    let sidecar: any = {};
    if (zip.file("opravovna.json")) {
      sidecar = JSON.parse(await zip.file("opravovna.json")!.async("string"));
      if (sidecar.version !== 1)
        throw new Error("Nepodporovaná verzia opravovna.json.");
    }
    const states = await prepareScores(
      pdfs.map((f) =>
        gradedOnly ? f.name.replace(/_graded\.pdf$/i, ".pdf") : f.name,
      ),
      incomingLegacy,
      sidecar,
      pointScores,
      correctScores,
    );
    if (!states) return;
    await uploadArchive(file, root, setBusy);
    if (Object.keys(incomingLegacy.changes ?? {}).length) {
      const { pack } = await import("msgpackr");
      await api(root + "/legacy?merge=1", {
        method: "PUT",
        body: pack(incomingLegacy) as any,
      });
    }
    const existingDocuments = new Map<string, any>(
      (project.documents ?? []).map((d: any) => [d.metadata.submissionId, d]),
    );
    let next = 0,
      completed = 0,
      stopped = false;
    const worker = async () => {
      while (!stopped) {
        const i = next++;
        if (i >= pdfs.length) return;
        const f = pdfs[i],
          sourcePath = gradedOnly
            ? f.name.replace(/_graded\.pdf$/i, ".pdf")
            : f.name,
          meta = parseSubmission(sourcePath)!;
        try {
          const pdfBytes = await f.async("uint8array");
          const known = existingDocuments.get(meta.submissionId);
          // Existing records already have their original PDF stored. Sending it
          // again wastes bandwidth and may return before the body finishes.
          const d = known
            ? { ...known, existing: true }
            : await api(root + "/documents", {
                method: "POST",
                headers: { "x-file-path": encodeURIComponent(sourcePath) },
                body: pdfBytes as any,
              });
          const graded = gradedOnly
            ? null
            : (zip.file(gradedFilePath(f.name)) ??
              zip.file(legacyGradedFilePath(f.name, meta.submissionId)));
          if (graded && !d.existing)
            await api(root + "/documents/" + d.id + "/graded", {
              method: "PUT",
              body: (await graded.async("uint8array")) as any,
            });
          const incoming = states.get(sourcePath);
          if (d.existing) {
            if (await sameGradedSubmission(pid, d, incoming, pdfBytes)) {
              completed++;
              setBusy(
                `Importujem riešenia… ${completed} / ${pdfs.length} (3 súbežne)`,
              );
              continue;
            }
            let decision = mergeDecision(d.state, incoming);
            if (decision === "keep") {
              const stored = await fetch(`/api/${root}/documents/${d.id}/file`);
              if (!stored.ok) throw new Error("PDF sa nepodarilo načítať.");
              if (
                !sameBytes(new Uint8Array(await stored.arrayBuffer()), pdfBytes)
              )
                decision = "conflict";
            }
            if (decision === "conflict")
              conflicts.push({
                projectId: pid,
                id: d.id,
                path: sourcePath,
                metadata: meta,
                first: d.state,
                second: incoming,
                incomingPdf: pdfBytes,
                revision: d.revision,
                choice: "",
              });
            if (decision === "replace") {
              try {
                await writeImportedVersion(
                  pid,
                  d.id,
                  incoming,
                  d.revision,
                  pdfBytes,
                );
              } catch (e: any) {
                if (e.status !== 409) throw e;
                const latest = await api(root);
                const now = latest.documents.find((x: any) => x.id === d.id);
                conflicts.push({
                  projectId: pid,
                  id: d.id,
                  path: sourcePath,
                  metadata: meta,
                  first: now.state,
                  second: incoming,
                  incomingPdf: pdfBytes,
                  revision: now.revision,
                  choice: "",
                });
              }
            }
          } else if (
            sidecar.documents?.[sourcePath] ||
            pointScores[meta.submissionId]
          )
            await api(root + "/documents/" + d.id, {
              method: "PATCH",
              body: JSON.stringify({ state: incoming, revision: 0 }),
            });
          completed++;
          setBusy(
            `Importujem riešenia… ${completed} / ${pdfs.length} (3 súbežne)`,
          );
        } catch (e: any) {
          stopped = true;
          throw new Error(
            `Import riešenia ${sourcePath} sa zastavil: ${e.message} Už uložené riešenia ostali zachované; archív môžete nahrať znova.`,
            { cause: e },
          );
        }
      }
    };
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(3, pdfs.length) }, worker),
    );
    const failed = results.find((r) => r.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    await list();
    await open(pid);
    if (conflicts.length) {
      setMergeConflicts(
        conflicts.sort((a, b) =>
          a.metadata.name.localeCompare(b.metadata.name),
        ),
      );
      setMergeOpen(true);
    }
  } catch (e) {
    report(e);
  } finally {
    setBusy("");
  }
}
