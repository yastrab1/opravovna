"use client";
import { readPreferences, type Preferences } from "@/lib/preferences";
import type { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
export function useAccountPreferences(
  user: ReturnType<typeof useUser>["user"],
  projectId: string,
  report: (error: any) => void,
) {
  const [preferences, setPreferences] = useState<Preferences>(() =>
    readPreferences({}),
  );
  const preferencesRef = useRef(preferences),
    preferenceQueue = useRef<Promise<any>>(Promise.resolve());
  useEffect(() => {
    const value = readPreferences(user?.unsafeMetadata?.opravovna);
    preferencesRef.current = value;
    setPreferences(value);
  }, [user?.id]);
  async function persistPreferences(patch: Partial<Preferences>) {
    if (!user) throw new Error("Prihláste sa.");
    const value = { ...preferencesRef.current, ...patch };
    preferencesRef.current = value;
    setPreferences(value);
    const pending = preferenceQueue.current
      .catch(() => {})
      .then(() =>
        user.update({
          unsafeMetadata: { ...user.unsafeMetadata, opravovna: value },
        }),
      );
    preferenceQueue.current = pending;
    await pending;
  }
  const projectPreferences = preferences.projects[projectId] ?? {
    categories: [],
    sort: "name" as const,
  };
  const categories = projectPreferences.categories;
  function setProjectPreferences(patch: Partial<typeof projectPreferences>) {
    persistPreferences({
      projects: {
        ...preferencesRef.current.projects,
        [projectId]: {
          ...(preferencesRef.current.projects[projectId] ?? {
            categories: [],
            sort: "name",
          }),
          ...patch,
        },
      },
    }).catch(report);
  }
  function setCategories(value: string[]) {
    setProjectPreferences({ categories: value });
  }

  return {
    preferences,
    persistPreferences,
    projectPreferences,
    categories,
    setProjectPreferences,
    setCategories,
  };
}
