"use client";
import {
  readWorkspaceUrl,
  writeWorkspaceUrl,
  type WorkspaceLocation,
} from "@/lib/workspace-url";
import { useEffect, useRef } from "react";

type Navigation = {
  current: React.RefObject<any>;
  open: (project: string, solution?: string, mode?: "none") => Promise<boolean>;
  switchDoc: (id: string, mode?: "none") => Promise<boolean>;
  save: () => Promise<boolean>;
  setProject: (value: null, mode?: "none") => void;
  report: (error: unknown) => void;
};
export function useWorkspacePermalink(
  signedIn: boolean | undefined,
  navigation: Navigation,
) {
  const latest = useRef(navigation);
  latest.current = navigation;
  useEffect(() => {
    if (!signedIn) return;
    let canceled = false,
      running = false;
    let pending:
      { target: WorkspaceLocation | null; initial: boolean } | undefined;
    const restore = async (initial: boolean) => {
      pending = {
        target: readWorkspaceUrl(new URL(window.location.href)),
        initial,
      };
      if (running) return;
      running = true;
      try {
        while (pending && !canceled) {
          const { target, initial } = pending;
          pending = undefined;
          const n = latest.current;
          let success = false;
          try {
            if (target) {
              success =
                n.current.current.project?.id === target.project &&
                target.solution
                  ? await n.switchDoc(target.solution, "none")
                  : await n.open(
                      target.project,
                      target.solution ?? undefined,
                      "none",
                    );
            } else if (!initial && (await n.save())) {
              n.setProject(null, "none");
              success = true;
            }
          } catch (error) {
            n.report(error);
          }
          if (canceled || pending || (initial && !success)) continue;
          const { project, active } = n.current.current;
          writeWorkspaceUrl(
            project ? { project: project.id, solution: active } : null,
            "replace",
          );
        }
      } finally {
        running = false;
      }
    };
    void restore(true);
    const pop = () => void restore(false);
    window.addEventListener("popstate", pop);
    return () => {
      canceled = true;
      window.removeEventListener("popstate", pop);
    };
  }, [signedIn]);
}
