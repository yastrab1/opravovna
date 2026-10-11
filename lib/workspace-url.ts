export type WorkspaceLocation = { project: string; solution: string | null };
export type HistoryMode = "push" | "replace" | "none";
export function readWorkspaceUrl(url: URL): WorkspaceLocation | null {
  const project = url.searchParams.get("project");
  return project
    ? { project, solution: url.searchParams.get("solution") }
    : null;
}
export function workspaceUrl(url: URL, target: WorkspaceLocation | null) {
  const next = new URL(url);
  next.searchParams.delete("project");
  next.searchParams.delete("solution");
  if (target) {
    next.searchParams.delete("join");
    next.searchParams.set("project", target.project);
    if (target.solution) next.searchParams.set("solution", target.solution);
  }
  return next;
}
export function writeWorkspaceUrl(
  target: WorkspaceLocation | null,
  mode: HistoryMode = "push",
) {
  if (mode === "none") return;
  const url = workspaceUrl(new URL(window.location.href), target);
  if (url.href !== window.location.href)
    window.history[mode === "replace" ? "replaceState" : "pushState"](
      window.history.state,
      "",
      url,
    );
}
