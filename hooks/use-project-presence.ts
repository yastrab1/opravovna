"use client";
import { api } from "@/lib/client-api";
import { PRESENCE_INTERVAL, type ProjectViewer } from "@/lib/presence";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export function useProjectPresence(projectId: string | undefined) {
  const { user } = useUser();
  const accountId = user?.id;
  const [snapshot, setSnapshot] = useState<{
    projectId: string;
    accountId: string;
    viewers: ProjectViewer[];
  } | null>(null);
  useEffect(() => {
    if (!projectId || !accountId) return;
    const session = crypto.randomUUID();
    const path = `projects/${projectId}/presence/${session}`;
    const abort = new AbortController();
    let active = true;
    let pending = false;
    async function pulse() {
      if (!active || pending) return;
      pending = true;
      try {
        const viewers: ProjectViewer[] = await api(path, {
          method: "PUT",
          signal: abort.signal,
        });
        if (active)
          setSnapshot({
            projectId: projectId!,
            accountId: accountId!,
            viewers,
          });
      } catch {
        // Presence is transient; avoid showing stale people during a disconnect.
        if (active) setSnapshot(null);
      } finally {
        pending = false;
      }
    }
    function leave() {
      active = false;
      void api(path, { method: "DELETE", keepalive: true }).catch(() => {});
    }
    function resume() {
      active = true;
      void pulse();
    }
    function visible() {
      if (document.visibilityState === "visible") void pulse();
    }
    void pulse();
    const timer = setInterval(pulse, PRESENCE_INTERVAL);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", visible);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", visible);
      leave();
    };
  }, [projectId, accountId]);
  return snapshot &&
    snapshot.projectId === projectId &&
    snapshot.accountId === accountId
    ? snapshot.viewers.filter((viewer) => viewer.userId !== accountId)
    : [];
}
