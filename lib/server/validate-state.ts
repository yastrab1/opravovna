import { fail } from "./http";

export function validateState(state: any) {
  if (!state || !Array.isArray(state.changes) || !Array.isArray(state.tags))
    fail("Neplatné údaje.");
  if (state.changes.length > 5000 || state.tags.length > 100)
    fail("Príliš veľa anotácií alebo štítkov.");
  const points = state.scoring?.points;
  if (
    points != null &&
    (typeof points !== "number" || !Number.isFinite(points) || points < 0)
  )
    fail("Body musia byť nezáporné číslo.");
  const extra = state.extraPages ?? 0;
  if (!Number.isInteger(extra) || extra < 0 || extra > 100)
    fail("Najviac 100 pridaných strán.");
  const rotations = state.rotations ?? {};
  if (
    typeof rotations !== "object" ||
    Array.isArray(rotations) ||
    Object.keys(rotations).length > 2000
  )
    fail("Neplatné otočenia strán.");
  for (const [page, angle] of Object.entries(rotations)) {
    if (
      !/^\d+$/.test(page) ||
      Number(page) >= 2000 ||
      typeof angle !== "number" ||
      !Number.isInteger(angle) ||
      angle % 90 !== 0 ||
      Math.abs(angle) > 3600
    )
      fail("Neplatné otočenie strany.");
  }
  for (const change of state.changes) {
    if (
      !change ||
      !Number.isInteger(change.page) ||
      change.page < 0 ||
      change.page >= 2000 ||
      typeof change.type !== "string" ||
      !change.data ||
      typeof change.data !== "object"
    )
      fail("Neplatná anotácia.");
  }
  for (const tag of state.tags) {
    const name = typeof tag === "string" ? tag : tag?.name;
    if (typeof name !== "string" || !name.trim() || name.length > 60)
      fail("Štítok musí mať názov do 60 znakov.");
  }
}
