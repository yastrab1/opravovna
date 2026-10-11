"use client";
import { api } from "@/lib/client-api";
import { normalizeArnoldProject } from "@/lib/tags";
export function useProjectActions({
  current,
  save,
  setProject,
  setBusy,
  report,
  projectPreferences,
  setProjectPreferences,
}: any) {
  async function mutate(path: string, method: string, body: any) {
    if (!(await save()))
      return {
        error:
          "Zmeny riešenia sa nepodarilo uložiť. Najprv vyriešte chybu ukladania.",
      };
    const pid = current.current.project?.id;
    if (!pid) return null;
    setBusy("Aktualizujem projekt…");
    try {
      const result = await api(`projects/${pid}/${path}`, {
        method,
        body: JSON.stringify(body),
      });
      if (result.confirmationRequired) return result;
      const fresh = normalizeArnoldProject(await api(`projects/${pid}`));
      if (current.current.project?.id === pid) {
        current.current = {
          ...current.current,
          project: fresh,
          doc: fresh.documents.find(
            (d: any) => d.id === current.current.active,
          ),
        };
        setProject(fresh);
      }
      return result;
    } catch (error) {
      report(error);
      return { error: error instanceof Error ? error.message : String(error) };
    } finally {
      setBusy("");
    }
  }
  async function deleteProjectTag(name: string, confirmed = false) {
    const result = await mutate("tags", "DELETE", { name, confirmed });
    if (result?.ok && projectPreferences.tagFilter === name)
      setProjectPreferences({ tagFilter: "" });
    return result;
  }
  return {
    deleteProjectTag,
    assignCategories: (assignments: Record<string, string[]>) =>
      mutate("assignments", "POST", { assignments }),
  };
}
