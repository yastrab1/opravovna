import { writeImportedVersion } from "./write-version";
import { api } from "../client-api";
export async function resolveMerge({
  mergeConflicts,
  project,
  setBusy,
  setError,
  setMergeConflicts,
  setMergeOpen,
  open,
  report,
}: {
  mergeConflicts: any[];
  project: any;
  setBusy: any;
  setError: any;
  setMergeConflicts: React.Dispatch<React.SetStateAction<any[]>>;
  setMergeOpen: any;
  open: any;
  report: any;
}) {
  const pid = mergeConflicts[0]?.projectId ?? project?.id;
  setBusy("Zlučujem vybrané verzie…");
  setError("");
  try {
    for (const conflict of mergeConflicts) {
      if (conflict.choice !== "second") {
        setMergeConflicts((old) => old.filter((x) => x.id !== conflict.id));
        continue;
      }
      try {
        await writeImportedVersion(
          pid,
          conflict.id,
          conflict.second,
          conflict.revision,
          conflict.incomingPdf,
        );
        setMergeConflicts((old) => old.filter((x) => x.id !== conflict.id));
      } catch (e: any) {
        if (e.status === 409) {
          const fresh = await api("projects/" + pid);
          const now = fresh.documents.find((x: any) => x.id === conflict.id);
          setMergeConflicts((old) =>
            old.map((x) =>
              x.id === conflict.id
                ? {
                    ...x,
                    first: now.state,
                    revision: now.revision,
                    choice: "",
                  }
                : x,
            ),
          );
          throw new Error(
            "Riešenie " +
              conflict.metadata.name +
              " medzitým upravil spolupracovník. Vyberte jeho verziu znova.",
          );
        }
        throw e;
      }
    }
    setMergeConflicts([]);
    setMergeOpen(false);
    await open(pid);
  } catch (e) {
    report(e);
  } finally {
    setBusy("");
  }
}
