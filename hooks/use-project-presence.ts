"use client";
import { api } from "@/lib/client-api";
import { PRESENCE_INTERVAL, type ProjectViewer } from "@/lib/presence";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

export function useProjectPresence(
  projectId: string | undefined,
  documentId?: string | null,
) {
  const location = useRef(documentId);
  location.current = documentId;
  const refresh = useRef<(() => void) | null>(null);
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
    let queued = false;
    const focused = () =>
      document.hasFocus() && document.visibilityState === "visible";
    let attention = focused();
    async function pulse() {
      queued = true;
      if (!active || pending) return;
      pending = true;
      try {
        do {
          queued = false;
          const activity = attention;
          attention = false;
          const viewers: ProjectViewer[] = await api(path, {
            method: "PUT",
            signal: abort.signal,
            body: JSON.stringify({
              documentId: location.current ?? null,
              active: activity,
            }),
          });
          if (active)
            setSnapshot({
              projectId: projectId!,
              accountId: accountId!,
              viewers,
            });
        } while (queued && active);
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
      attention = focused();
      void pulse();
    }
    function visible() {
      if (document.visibilityState === "visible") {
        attention = focused();
        void pulse();
      }
    }
    refresh.current = () => {
      attention = focused();
      void pulse();
    };
    void pulse();
    const timer = setInterval(pulse, PRESENCE_INTERVAL);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      refresh.current = null;
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      leave();
    };
  }, [projectId, accountId]);
  useEffect(() => {
    refresh.current?.();
  }, [documentId]);
  return snapshot &&
    snapshot.projectId === projectId &&
    snapshot.accountId === accountId
    ? snapshot.viewers.filter((viewer) => viewer.userId !== accountId)
    : [];
}
