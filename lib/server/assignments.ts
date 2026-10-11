import { tagName } from "../tags";
import { assignmentPlan } from "../assignments";
import { validateState } from "./validate-state";
import { body, fail, json, type ApiContext } from "./http";
import { projectCollaborators } from "./collaborators";
export async function handleAssignments(
  context: ApiContext,
): Promise<Response | null> {
  const { p, req, role, DB, project } = context;
  if (p[2] !== "assignments" || p[3]) return null;
  if (role !== "owner") fail("Iba vlastník môže priraďovať riešenia.", 403);
  if (!["GET", "POST"].includes(req.method)) return null;
  const people = await projectCollaborators(context);
  if (req.method === "GET") return json(people);
  const { assignments } = await body(req);
  if (
    !assignments ||
    typeof assignments !== "object" ||
    Array.isArray(assignments)
  )
    fail("Neplatné priradenia.");
  const docs = (
    await DB.prepare(
      "SELECT id,metadata,state,revision FROM documents WHERE project=? ORDER BY id",
    )
      .bind(project.id)
      .all<any>()
  ).results.map((d) => ({
    ...d,
    metadata: JSON.parse(d.metadata),
    state: JSON.parse(d.state),
  }));
  const categories = new Set(docs.map((d) => d.metadata.rocnik));
  for (const [category, emails] of Object.entries(assignments)) {
    if (
      !categories.has(category) ||
      !Array.isArray(emails) ||
      new Set(emails).size !== emails.length ||
      emails.some(
        (email) =>
          typeof email !== "string" ||
          !people.some((p) => p.email === email && p.firstName),
      )
    )
      fail("Vyberte platných spolupracovníkov pre kategóriu.");
  }
  const plan = assignmentPlan(
    { ...project, legacy: JSON.parse(project.legacy), documents: docs },
    assignments,
    people,
  );
  const originalById = new Map(docs.map((d) => [d.id, d]));
  const changes = plan.documents.filter(
    (d: any) =>
      JSON.stringify(d.state.tags) !==
      JSON.stringify(originalById.get(d.id)!.state.tags),
  );
  changes.forEach((d: any) => validateState(d.state));
  const revisions = JSON.stringify(
    docs.map((d) => ({ id: d.id, revision: d.revision })),
  );
  const next = JSON.stringify(plan.legacy),
    marker = JSON.stringify({
      ...plan.legacy,
      _assignmentOperation: crypto.randomUUID(),
    });
  // A unique transaction marker gates every write. A stale document/catalog
  // snapshot makes the whole batch a no-op rather than partially assigning work.
  const [result] = await DB.batch([
    DB.prepare(
      `UPDATE projects SET legacy=? WHERE id=? AND legacy=? AND (SELECT count(*) FROM documents WHERE project=?)=? AND NOT EXISTS(SELECT 1 FROM json_each(?) s LEFT JOIN documents d ON d.id=json_extract(s.value,'$.id') AND d.project=? WHERE d.id IS NULL OR d.revision<>json_extract(s.value,'$.revision'))`,
    ).bind(
      marker,
      project.id,
      project.legacy,
      project.id,
      docs.length,
      revisions,
      project.id,
    ),
    DB.prepare(
      `UPDATE documents SET state=json_set(state,'$.tags',json((SELECT json_extract(s.value,'$.tags') FROM json_each(?) s WHERE json_extract(s.value,'$.id')=documents.id))),revision=revision+1,updated=? WHERE project=? AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND EXISTS(SELECT 1 FROM projects WHERE id=? AND legacy=?)`,
    ).bind(
      JSON.stringify(
        changes.map((d: any) => ({ id: d.id, tags: d.state.tags })),
      ),
      Date.now(),
      project.id,
      JSON.stringify(changes.map((d: any) => ({ id: d.id }))),
      project.id,
      marker,
    ),
    DB.prepare("UPDATE projects SET legacy=? WHERE id=? AND legacy=?").bind(
      next,
      project.id,
      marker,
    ),
  ]);
  if (!result.meta.changes)
    fail("Projekt sa medzitým zmenil. Skúste priradenie znova.", 409);
  return json({
    ok: true,
    assigned: plan.documents.filter((d: any) =>
      d.state.tags.some((t: any) => tagName(t).startsWith("assigned:")),
    ).length,
  });
}
