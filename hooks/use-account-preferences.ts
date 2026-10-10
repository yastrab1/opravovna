"use client";
import {
  defaultProjectPreferences,
  readPreferences,
  type Preferences,
  type ProjectPreferences,
} from "@/lib/preferences";
import {
  cachePendingPreferences,
  mergePreferencePatch,
  readPendingPreferences,
} from "@/lib/preference-cache";
import type { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
export function useAccountPreferences(
  user: ReturnType<typeof useUser>["user"],
  projectId: string | undefined,
  report: (error: any) => void,
) {
  const [state, setState] = useState({
    accountId: "",
    value: readPreferences({}),
  });
  const accountId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;
  const reportRef = useRef(report);
  reportRef.current = report;
  const controller = useRef<{
    accountId: string;
    value: Preferences;
    update: (patch: Partial<Preferences>, immediate: boolean) => Promise<void>;
  } | null>(null);
  useEffect(() => {
    const user = userRef.current;
    if (!user) {
      controller.current = null;
      return;
    }
    const accountId = user.id;
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {}
    let pending = readPendingPreferences(storage, accountId);
    let value = readPreferences(
      mergePreferencePatch(
        readPreferences(user.unsafeMetadata?.opravovna),
        pending,
      ),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saving: Promise<void> | undefined;
    let generation = 0;
    let stopped = false;
    const publish = () => {
      if (stopped) return;
      if (controller.current?.accountId === accountId)
        controller.current.value = value;
      setState({ accountId, value });
    };
    function flush(): Promise<void> {
      clearTimeout(timer);
      if (saving) return saving;
      saving = (async () => {
        while (!stopped && Object.keys(pending).length) {
          const version = generation;
          await user!.update({
            unsafeMetadata: { ...user!.unsafeMetadata, opravovna: value },
          });
          if (!stopped && version === generation) {
            pending = {};
            cachePendingPreferences(storage, accountId, pending);
          }
        }
      })().finally(() => {
        saving = undefined;
      });
      return saving;
    }
    const sync = () => flush().catch((error) => reportRef.current(error));
    controller.current = {
      accountId,
      value,
      async update(patch, immediate) {
        pending = mergePreferencePatch(pending, patch);
        value = readPreferences(mergePreferencePatch(value, patch));
        generation++;
        cachePendingPreferences(storage, accountId, pending);
        publish();
        clearTimeout(timer);
        if (immediate) await flush();
        else timer = setTimeout(sync, 400);
      },
    };
    publish();
    if (Object.keys(pending).length) void sync();
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, [accountId]);
  const preferences =
    state.accountId === user?.id ? state.value : readPreferences({});
  async function persistPreferences(patch: Partial<Preferences>) {
    const current = controller.current;
    if (!user || current?.accountId !== user.id)
      throw new Error("Prihláste sa.");
    await current.update(patch, true);
  }
  const projectPreferences =
    (projectId && preferences.projects[projectId]) ||
    defaultProjectPreferences();
  function setProjectPreferences(patch: Partial<ProjectPreferences>) {
    const current = controller.current;
    if (!projectId || !user || current?.accountId !== user.id) return;
    current
      .update(
        {
          projects: {
            [projectId]: {
              ...(current.value.projects[projectId] ??
                defaultProjectPreferences()),
              ...patch,
            },
          },
        },
        false,
      )
      .catch(report);
  }
  function setCategories(value: string[]) {
    setProjectPreferences({ categories: value });
  }
  return {
    preferences,
    persistPreferences,
    projectPreferences,
    categories: projectPreferences.categories,
    setProjectPreferences,
    setCategories,
  };
}
