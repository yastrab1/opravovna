"use client";
import { useAccountPreferences } from "@/hooks/use-account-preferences";
import { useProjectSession } from "@/hooks/use-project-session";
import { api } from "@/lib/client-api";
import { exportZipBrowser as runexportZipBrowser } from "@/lib/export/browser-export";
import { exportZip as runexportZip } from "@/lib/export/server-export";
import { importZip as runimportZip } from "@/lib/import/import-project";
import { resolveMerge as runresolveMerge } from "@/lib/import/resolve-conflicts";
import { categoryLabel, compareCategories } from "@/lib/preferences";
import { collectTags, tagName } from "@/lib/tags";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useImportScores } from "./use-import-scores";
export function useWorkspace() {
  const scoreCorrection = useImportScores();
  const { isLoaded, isSignedIn, user } = useUser();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [tagFilter, setTagFilter] = useState(""),
    [sharing, setSharing] = useState(false),
    [members, setMembers] = useState<any[]>([]),
    [email, setEmail] = useState(""),
    [memberRole, setMemberRole] = useState("editor"),
    [link, setLink] = useState(""),
    [tag, setTag] = useState(""),
    [mergeConflicts, setMergeConflicts] = useState<any[]>([]),
    [mergeOpen, setMergeOpen] = useState(false);
  const mergeDialog = useRef<HTMLDialogElement>(null);
  const mergePending = useRef(0);
  mergePending.current = mergeConflicts.length;
  const {
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
  } = useProjectSession(isSignedIn, mergePending, setSharing);
  const {
    preferences,
    persistPreferences,
    projectPreferences,
    categories,
    setProjectPreferences,
    setCategories,
  } = useAccountPreferences(user, project?.id, report);

  useEffect(() => {
    if (mergeOpen) mergeDialog.current?.showModal();
    else mergeDialog.current?.close();
  }, [mergeOpen]);
  const shareDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (sharing) shareDialog.current?.showModal();
    else shareDialog.current?.close();
  }, [sharing]);
  const editor = useRef<any>(null);

  async function applyGrade(points: number) {
    await editor.current?.stamp(points);
  }
  async function importZip(file: File) {
    return runimportZip(file, {
      correctScores: scoreCorrection.request,
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
    });
  }
  async function resolveMerge() {
    return runresolveMerge({
      mergeConflicts,
      project,
      setBusy,
      setError,
      setMergeConflicts,
      setMergeOpen,
      open,
      report,
    });
  }
  async function exportZip() {
    return runexportZip({
      project,
      save,
      setError,
      setBusy,
      report,
      exportZipBrowser,
    });
  }
  async function exportZipBrowser() {
    return runexportZipBrowser({ project, setError, setBusy, report });
  }
  async function openSharing() {
    setSharing(!sharing);
    if (!sharing) {
      try {
        setMembers(await api(`projects/${project.id}/members`));
        setLink(
          project.share ? location.origin + "/?join=" + project.share : "",
        );
      } catch (e) {
        report(e);
      }
    }
  }

  const hasJoin =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("join");
  const navigationDocuments =
    project?.documents
      .filter(
        (d: any) =>
          `${d.metadata.name} ${d.metadata.submissionId} ${d.metadata.rocnik} ${categoryLabel(d.metadata.rocnik)}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!categories.length || categories.includes(d.metadata.rocnik)) &&
          (!tagFilter ||
            d.state.tags.some(
              (t: any) => (typeof t === "object" ? t.name : t) === tagFilter,
            )),
      )
      .sort(
        (a: any, b: any) =>
          (projectPreferences.sort === "graded"
            ? Number(b.state.scoring?.points != null) -
              Number(a.state.scoring?.points != null)
            : 0) ||
          a.metadata.name.localeCompare(b.metadata.name, "sk", {
            numeric: true,
          }) ||
          Number(a.metadata.submissionId) - Number(b.metadata.submissionId),
      ) ?? [];
  const documents = navigationDocuments.filter(
    (d: any) =>
      filter === "all" ||
      (filter === "graded"
        ? d.state.scoring?.points != null
        : d.state.scoring?.points == null),
  );
  const activeIndex = navigationDocuments.findIndex(
    (d: any) => d.id === active,
  );
  const nextDocument = navigationDocuments
    .slice(Math.max(0, activeIndex + 1))
    .find((d: any) => documents.some((visible: any) => visible.id === d.id));
  async function openNext() {
    if (nextDocument) await switchDoc(nextDocument.id);
  }
  const categoryOptions = Array.from(
    new Set<string>(
      project?.documents.map((d: any) => d.metadata.rocnik) ?? [],
    ),
  ).sort(compareCategories);
  const projectTags = collectTags(
    project?.legacy?.tags ?? [],
    ...(project?.documents.map((d: any) => d.state.tags ?? []) ?? []),
  );
  const allTags = projectTags.map(tagName);
  function toggleTag(value: any) {
    if (!doc) return;
    const assigned = doc.state.tags.some(
      (t: any) => tagName(t) === tagName(value),
    );
    changed({
      ...doc.state,
      tags: assigned
        ? doc.state.tags.filter((t: any) => tagName(t) !== tagName(value))
        : [...doc.state.tags, value],
    });
  }

  return {
    scoreCorrection,
    isSignedIn,
    preferences,
    persistPreferences,
    error,
    saveStatus,
    current,
    dirty,
    setError,
    open,
    project,
    mergeConflicts,
    setMergeOpen,
    mergeOpen,
    mergeDialog,
    setMergeConflicts,
    busy,
    resolveMerge,
    isLoaded,
    projects,
    hasJoin,
    join,
    create,
    newTitle,
    setNewTitle,
    save,
    setProject,
    list,
    report,
    readonly,
    exportZip,
    openSharing,
    sharing,
    shareDialog,
    setSharing,
    email,
    setEmail,
    memberRole,
    setMemberRole,
    members,
    setMembers,
    link,
    setLink,
    importZip,
    query,
    setQuery,
    projectPreferences,
    setProjectPreferences,
    filter,
    setFilter,
    allTags,
    tagFilter,
    setTagFilter,
    categories,
    categoryOptions,
    setCategories,
    documents,
    active,
    switchDoc,
    nextDocument,
    openNext,
    doc,
    changed,
    editor,
    applyGrade,
    projectTags,
    toggleTag,
    tag,
    setTag,
  };
}
