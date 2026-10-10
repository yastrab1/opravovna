import type { Preferences } from "./preferences";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (accountId: string) => `opravovna:pending-preferences:${accountId}`;

// Only unsynced edits live here. Clerk remains the account's source of truth.
export function readPendingPreferences(
  storage: StorageLike | undefined,
  accountId: string,
): Partial<Preferences> {
  try {
    const value = JSON.parse(storage?.getItem(key(accountId)) ?? "null");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export function cachePendingPreferences(
  storage: StorageLike | undefined,
  accountId: string,
  pending: Partial<Preferences>,
) {
  try {
    if (Object.keys(pending).length)
      storage?.setItem(key(accountId), JSON.stringify(pending));
    else storage?.removeItem(key(accountId));
  } catch {
    // Account saving still works when browser storage is unavailable.
  }
}
export function mergePreferencePatch(
  previous: Partial<Preferences>,
  patch: Partial<Preferences>,
): Partial<Preferences> {
  return {
    ...previous,
    ...patch,
    ...(patch.projects && {
      projects: { ...previous.projects, ...patch.projects },
    }),
  };
}
