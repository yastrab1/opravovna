import { tagName } from "../tags";
import { body, fail, json, type ApiContext } from "./http";

const tagValue = (alias: string) =>
  `CASE WHEN ${alias}.type='text' THEN ${alias}.value ELSE COALESCE(json_extract(${alias}.value,'$.name'),json_extract(${alias}.value,'$.meno'),json_extract(${alias}.value,'$.label')) END`;
export async function handleProjectTags({
  req,
  DB,
  p,
  project,
}: ApiContext): Promise<Response | null> {
  if (p[2] !== "tags" || p[3] || req.method !== "DELETE") return null;
  const request = await body(req);
  if (
    typeof request.name !== "string" ||
    !request.name.trim() ||
    request.name.length > 60
  )
    fail("Neplatný štítok.");
  const name = request.name.trim(),
    confirmed = request.confirmed === true;
  const legacy = JSON.parse(project.legacy);
  const identifiers = [
    name,
    ...(legacy.tags ?? [])
      .filter((t: any) => tagName(t) === name && typeof t?.id === "string")
      .map((t: any) => t.id),
  ];
  const ids = JSON.stringify(identifiers);
  const keep = (t: any) =>
    !identifiers.includes(typeof t === "string" ? t : tagName(t));
  const next = { ...legacy, tags: (legacy.tags ?? []).filter(keep) };
  if (legacy.changes)
    next.changes = Object.fromEntries(
      Object.entries(legacy.changes).map(([id, value]: [string, any]) => [
        id,
        Array.isArray(value?.tags)
          ? { ...value, tags: value.tags.filter(keep) }
          : value,
      ]),
    );
  const snapshot = JSON.stringify(next);
  const marker = JSON.stringify({
    ...next,
    _tagDeletionOperation: crypto.randomUUID(),
  });
  const matches = `EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(d.state,'$.tags'),'[]')) t WHERE ${tagValue("t")} IN (SELECT value FROM json_each(?)))`;
  const usage = async () =>
    Number(
      (
        await DB.prepare(
          `SELECT count(*) AS count FROM documents d WHERE d.project=? AND ${matches}`,
        )
          .bind(project.id, ids)
          .first<any>()
      )?.count ?? 0,
    );
  const count = await usage();
  if (count && !confirmed) return json({ confirmationRequired: true, count });
  // Both mutations share a transaction. The catalog CAS protects concurrent
  // catalog edits, and document JSON is filtered in SQL to preserve live edits.
  const [result] = await DB.batch([
    DB.prepare(
      `UPDATE projects SET legacy=? WHERE id=? AND legacy=? AND (?=1 OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.project=? AND ${matches}))`,
    ).bind(
      marker,
      project.id,
      project.legacy,
      Number(confirmed),
      project.id,
      ids,
    ),
    DB.prepare(
      `UPDATE documents AS d SET state=json_set(state,'$.tags',json((SELECT COALESCE(json_group_array(json(CASE WHEN t.type='text' THEN json_quote(t.value) ELSE t.value END)),'[]') FROM json_each(json_extract(d.state,'$.tags')) t WHERE ${tagValue("t")} NOT IN (SELECT value FROM json_each(?))))), revision=revision+1, updated=? WHERE project=? AND ?=1 AND EXISTS(SELECT 1 FROM projects WHERE id=? AND legacy=?) AND ${matches}`,
    ).bind(
      ids,
      Date.now(),
      project.id,
      Number(confirmed),
      project.id,
      marker,
      ids,
    ),
    DB.prepare("UPDATE projects SET legacy=? WHERE id=? AND legacy=?").bind(
      snapshot,
      project.id,
      marker,
    ),
  ]);
  if (!result.meta.changes) {
    const count = await usage();
    if (count && !confirmed) return json({ confirmationRequired: true, count });
    fail(
      "Štítky medzitým upravil iný používateľ. Obnovte projekt a skúste znova.",
      409,
    );
  }
  return json({ ok: true });
}
