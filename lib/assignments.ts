import { collectTags, normalizeArnoldProject, tagName } from "./tags";
export function assignmentPlan(
  project: any,
  assignments: Record<string, string[]>,
  people: { email: string; firstName: string | null }[],
) {
  const normalized = normalizeArnoldProject(project),
    oldNames = new Set(
      (project.legacy.tags ?? [])
        .filter((t: any) => tagName(t).startsWith("assigned:"))
        .map((t: any) => (typeof t?.id === "string" ? t.id : tagName(t))),
    );
  const keep = (t: any) =>
    !tagName(t).startsWith("assigned:") &&
    !oldNames.has(typeof t === "string" ? t : tagName(t));
  const positions = new Map<string, number>();
  const states = new Map<string, any>();
  const documents = [...normalized.documents].sort(
    (a: any, b: any) =>
      Number(a.metadata.submissionId) - Number(b.metadata.submissionId) ||
      a.id.localeCompare(b.id),
  );
  for (const doc of documents) {
    const tags = doc.state.tags.filter(keep),
      category = doc.metadata.rocnik,
      recipients = assignments[category] ?? [];
    if (doc.state.scoring?.points == null && recipients.length) {
      const index = positions.get(category) ?? 0,
        person = people.find(
          (p) => p.email === recipients[index % recipients.length],
        );
      if (!person?.firstName)
        throw Error("Spolupracovník nemá meno v účte. Najprv ho doplňte.");
      tags.push(`assigned:${person.firstName.slice(0, 51)}`);
      positions.set(category, index + 1);
    }
    states.set(doc.id, { ...doc.state, tags });
  }
  const legacy = {
    ...project.legacy,
    assignments,
    tags: collectTags(
      (project.legacy.tags ?? []).filter(keep),
      ...Array.from(states.values()).map((s) => s.tags),
    ),
  };
  if (legacy.changes)
    legacy.changes = Object.fromEntries(
      Object.entries(legacy.changes).map(([id, value]: [string, any]) => [
        id,
        Array.isArray(value?.tags)
          ? { ...value, tags: value.tags.filter(keep) }
          : value,
      ]),
    );
  return {
    legacy,
    documents: project.documents.map((d: any) => ({
      ...d,
      state: states.get(d.id),
    })),
  };
}
