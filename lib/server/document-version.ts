import { documentTagStatements } from "./document-tags";
import { fail, json, readBytes, type ApiContext } from "./http";
import { validateState } from "./validate-state";

// Store an immutable candidate, then swap the PDF and state in one revision check.
export async function replaceDocumentVersion(context: ApiContext, doc: any) {
  const { req, DB, BUCKET, project } = context;
  const bytes = await readBytes(req, 44 * 1024 * 1024);
  let form: FormData;
  try {
    form = await new Response(bytes as BodyInit, {
      headers: { "Content-Type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    fail("Neplatná verzia riešenia.");
  }
  const pdf = form.get("pdf"),
    rawState = form.get("state");
  const revision = Number(form.get("revision"));
  if (!form.has("revision") || !Number.isInteger(revision) || revision < 0)
    fail("Neplatná revízia.");
  if (
    !(pdf instanceof File) ||
    pdf.size > 40 * 1024 * 1024 ||
    typeof rawState !== "string" ||
    rawState.length > 3_000_000
  )
    fail("Neplatná verzia riešenia.");
  let state;
  try {
    state = JSON.parse(rawState);
  } catch {
    fail("Neplatné JSON údaje.");
  }
  validateState(state);
  const data = new Uint8Array(await pdf.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
    fail("Súbor nie je PDF.");
  const operation = form.get("operation");
  if (typeof operation !== "string" || !/^[a-f0-9-]{36}$/.test(operation))
    fail("Neplatná operácia.");
  const key = `${project.id}/documents/${doc.id}/versions/${operation}.pdf`;
  if (doc.original === key) {
    if (doc.revision === revision + 1 && doc.state === JSON.stringify(state))
      return json({ revision: revision + 1 });
    return json({ error: "Táto verzia už bola nahraná.", conflict: true }, 409);
  }
  if (doc.revision !== revision)
    return json(
      { error: "Dokument medzitým upravil iný používateľ.", conflict: true },
      409,
    );
  await BUCKET.put(key, data);
  const [result] = await DB.batch([
    DB.prepare(
      "UPDATE documents SET original=?, graded=NULL, state=?, revision=revision+1, updated=? WHERE id=? AND revision=?",
    ).bind(key, JSON.stringify(state), Date.now(), doc.id, revision),
    ...documentTagStatements(DB, project.id, doc, state, revision + 1),
  ]);
  if (!result.meta.changes) {
    return json(
      { error: "Dokument medzitým upravil iný používateľ.", conflict: true },
      409,
    );
  }
  return json({ revision: revision + 1 });
}
