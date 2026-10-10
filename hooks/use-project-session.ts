"use client";
import { api } from "@/lib/client-api";
import { collectTags, normalizeArnoldProject } from "@/lib/tags";
import { useEffect, useRef, useState } from "react";
export function useProjectSession(
  isSignedIn: boolean | undefined,
  mergePending: React.RefObject<number>,
  setSharing: (open: boolean) => void,
) {
  const [projects, setProjects] = useState<any[]>([]),
    [project, setProject] = useState<any>(null),
    [active, setActive] = useState<string | null>(null),
    [newTitle, setNewTitle] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [saveStatus, setSaveStatus] = useState("Uložené");
  const current = useRef<any>(null),
    dirty = useRef(false),
    saving = useRef<Promise<any> | null>(null),
    timer = useRef<any>(null),
    busyRef = useRef("");
  busyRef.current = busy;
  const doc = project?.documents.find((d: any) => d.id === active);
  current.current = { project, active, doc };
  const readonly = project?.role === "viewer";
  async function list() {
    setProjects(await api("projects"));
  }
  function report(e: any) {
    setError(typeof e === "string" ? e : e.message);
  }
  async function open(pid: string) {
    if (!(await save())) return;
    setBusy("Načítavam projekt…");
    try {
      const p = normalizeArnoldProject(await api("projects/" + pid));
      setProject(p);
      setActive(p.documents[0]?.id ?? null);
      setSharing(false);
      dirty.current = false;
      setSaveStatus("Uložené");
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const p = await api("projects", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim() || "Nový projekt" }),
      });
      setNewTitle("");
      await list();
      await open(p.id);
    } catch (e) {
      report(e);
    }
  }
  function changed(state: any) {
    const previous = current.current.project,
      activeId = current.current.active;
    if (!previous) return;
    dirty.current = true;
    setSaveStatus("Neuložené zmeny");
    const oldDoc = previous.documents.find((d: any) => d.id === activeId),
      next = {
        ...previous,
        legacy: {
          ...previous.legacy,
          tags: collectTags(
            previous.legacy.tags ?? [],
            oldDoc?.state.tags ?? [],
            state.tags ?? [],
          ),
        },
        documents: previous.documents.map((d: any) =>
          d.id === activeId ? { ...d, state } : d,
        ),
      };
    current.current.project = next;
    current.current.doc = next.documents.find((d: any) => d.id === activeId);
    setProject(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 1000);
  }
  async function save(): Promise<boolean> {
    clearTimeout(timer.current);
    if (saving.current && !(await saving.current)) return false;
    if (!dirty.current) return true;
    const { project: p, doc: d } = current.current;
    if (!p || !d) return true;
    const snapshot = d.state;
    dirty.current = false;
    setSaveStatus("Ukladám…");
    saving.current = (async () => {
      try {
        const r = await api(`projects/${p.id}/documents/${d.id}`, {
          method: "PATCH",
          body: JSON.stringify({ state: snapshot, revision: d.revision }),
        });
        if (current.current.project?.id === p.id) {
          const updated = {
            ...current.current.project,
            documents: current.current.project.documents.map((v: any) =>
              v.id === d.id ? { ...v, revision: r.revision } : v,
            ),
          };
          current.current = {
            ...current.current,
            project: updated,
            doc: updated.documents.find(
              (v: any) => v.id === current.current.active,
            ),
          };
          setProject(updated);
        }
        if (!dirty.current) setSaveStatus("Uložené");
        return true;
      } catch (e: any) {
        dirty.current = true;
        setSaveStatus(e.status === 409 ? "Konflikt zmien" : "Uloženie zlyhalo");
        report(e);
        return false;
      } finally {
        saving.current = null;
      }
    })();
    const success = await saving.current;
    return success && dirty.current ? save() : success;
  }
  useEffect(() => {
    if (!isSignedIn) return;
    list().catch(report);
  }, [isSignedIn]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current || busyRef.current || mergePending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  useEffect(() => {
    if (!project) return;
    let canceled = false;
    const id = setInterval(async () => {
      if (dirty.current || saving.current || busyRef.current) return;
      try {
        const p = normalizeArnoldProject(await api("projects/" + project.id));
        if (
          canceled ||
          current.current.project?.id !== project.id ||
          dirty.current ||
          saving.current ||
          busyRef.current
        )
          return;
        setProject((old: any) => ({
          ...p,
          documents: p.documents.map((d: any) => {
            const prev = old.documents.find((x: any) => x.id === d.id);
            return {
              ...d,
              remoteRevision:
                prev?.revision !== d.revision
                  ? d.revision
                  : prev?.remoteRevision,
            };
          }),
        }));
      } catch (e) {
        report(e);
      }
    }, 5000);
    return () => {
      canceled = true;
      clearInterval(id);
    };
  }, [project?.id]);
  async function switchDoc(id: string) {
    if (await save()) {
      const project = current.current.project;
      if (!project.documents.some((doc: any) => doc.id === id)) {
        const fresh = normalizeArnoldProject(
          await api("projects/" + project.id),
        );
        if (!fresh.documents.some((doc: any) => doc.id === id))
          throw new Error("Riešenie už nie je dostupné.");
        setProject(fresh);
      }
      dirty.current = false;
      setActive(id);
    }
  }
  async function join() {
    try {
      setBusy("Pripájam projekt…");
      const token = new URLSearchParams(location.search).get("join");
      const p = await api("join", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      history.replaceState({}, "", "/");
      await list();
      await open(p.id);
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  return {
    projects,
    project,
    setProject,
    active,
    newTitle,
    setNewTitle,
    busy,
    setBusy,
    error,
    setError,
    saveStatus,
    current,
    dirty,
    doc,
    readonly,
    list,
    report,
    open,
    create,
    changed,
    save,
    switchDoc,
    join,
  };
}
