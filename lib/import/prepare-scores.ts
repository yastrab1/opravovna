import { parseSubmission } from "../archive";
import { normalizedState } from "../merge";
import { normalizeArnoldTagValues } from "../tags";

export interface InvalidScore {
  path: string;
  name: string;
  original: unknown;
}
export type CorrectScores = (
  issues: InvalidScore[],
) => Promise<Record<string, number> | null>;

export function parsePoints(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n =
    typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function replacePoints(state: any, points: number) {
  const prior = state.scoring ?? {};
  state.scoring = { ...prior, points };
  // Only the linked grading stamp is changed; reviewer comments stay intact.
  state.changes = state.changes.map((change: any) =>
    prior.annotName && change.data?.name === prior.annotName
      ? { ...change, data: { ...change.data, text: `${points}B` } }
      : change,
  );
}

export async function prepareScores(
  paths: string[],
  legacy: any,
  sidecar: any,
  scores: any,
  correct: CorrectScores,
) {
  const states = new Map<string, any>();
  const issues: InvalidScore[] = [];
  for (const path of paths) {
    const meta = parseSubmission(path)!;
    const state = structuredClone(
      normalizedState(
        sidecar.documents?.[path] ?? legacy.changes?.[meta.submissionId],
      ),
    );
    state.tags = normalizeArnoldTagValues(state.tags, legacy.tags);
    if (state.scoring.points == null && scores[meta.submissionId])
      state.scoring = { ...state.scoring, ...scores[meta.submissionId] };
    const raw = state.scoring.points;
    if (raw != null) {
      const parsed = parsePoints(raw);
      if (parsed == null) issues.push({ path, name: meta.name, original: raw });
      else replacePoints(state, parsed);
    }
    states.set(path, state);
  }
  if (issues.length) {
    const replacements = await correct(issues);
    if (!replacements) return null;
    for (const issue of issues) {
      const points = replacements[issue.path];
      if (typeof points !== "number" || parsePoints(points) == null)
        throw new Error("Zadajte nezáporné číslo pre každé riešenie.");
      replacePoints(states.get(issue.path), points);
    }
  }
  // Seed server documents from the same validated state used for merging.
  legacy.changes ??= {};
  for (const [path, state] of states)
    legacy.changes[parseSubmission(path)!.submissionId] = state;
  return states;
}
