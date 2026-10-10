// Append vocabulary only when this exact document update committed in the batch.
export function documentTagStatements(
  DB: D1Database,
  project: string,
  doc: any,
  state: any,
  revision: number,
) {
  const tags = [...(JSON.parse(doc.state).tags ?? []), ...state.tags].filter(
    (tag: any) => typeof tag === "string" || typeof tag?.name === "string",
  );
  return tags.map((tag: any) =>
    DB.prepare(
      `UPDATE projects SET legacy=json_set(legacy,'$.tags',json_insert(COALESCE(json_extract(legacy,'$.tags'),'[]'),'$[#]',json(?)))
     WHERE id=? AND EXISTS(SELECT 1 FROM documents WHERE id=? AND revision=? AND state=?)
     AND NOT EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(projects.legacy,'$.tags'),'[]')) t WHERE CASE WHEN t.type='object' THEN json_extract(t.value,'$.name') ELSE t.value END=?)`,
    ).bind(
      JSON.stringify(tag),
      project,
      doc.id,
      revision,
      JSON.stringify(state),
      typeof tag === "string" ? tag : tag.name,
    ),
  );
}
