import { documentTagStatements } from "./document-tags";
import { replaceDocumentVersion } from "./document-version";
import { parseSubmission, projectTitle } from "../archive";
import { body, fail, id, json, readBytes, type ApiContext } from "./http";
import { validateState } from "./validate-state";
export async function handleDocuments(
  context: ApiContext,
): Promise<Response | null> {
  const { req, DB, BUCKET, url, p, project } = context;
  if (p[2] === "documents" && !p[3] && req.method === "POST") {
    const path = decodeURIComponent(req.headers.get("x-file-path") || "");
    let meta;
    try {
      meta = parseSubmission(path);
    } catch {
      fail("Neplatná cesta v archíve.");
    }
    if (!meta) fail("Neplatný názov PDF.");
    const existing = await DB.prepare(
      "SELECT id,state,revision,graded FROM documents WHERE project=? AND (path=? OR json_extract(metadata,'$.submissionId')=?) LIMIT 1",
    )
      .bind(project.id, path, meta.submissionId)
      .first<any>();
    if (existing)
      return json({
        id: existing.id,
        state: JSON.parse(existing.state),
        revision: existing.revision,
        graded: !!existing.graded,
        existing: true,
      });
    const bytes = await readBytes(req, 50 * 1024 * 1024);
    if (bytes.byteLength > 40 * 1024 * 1024)
      fail("PDF je príliš veľké (max. 40 MB).", 413);
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      fail("Súbor nie je PDF.");
    const did = id(),
      key = `${project.id}/documents/${did}/original.pdf`;
    await BUCKET.put(key, bytes);
    const legacy = JSON.parse(project.legacy);
    const old = legacy.changes?.[meta.submissionId] ?? {};
    const state = {
      changes: old.changes ?? [],
      tags: old.tags ?? [],
      scoring: old.scoring ?? {},
      rotations: {},
      extraPages: 0,
    };
    validateState(state);
    await DB.prepare(
      "INSERT INTO documents(id,project,path,metadata,original,state,updated) VALUES(?,?,?,?,?,?,?)",
    )
      .bind(
        did,
        project.id,
        path,
        JSON.stringify(meta),
        key,
        JSON.stringify(state),
        Date.now(),
      )
      .run();
    if (!project.folder && meta.folder)
      await DB.prepare(
        "UPDATE projects SET folder=?, title=CASE WHEN title='Nový projekt' THEN ? ELSE title END WHERE id=?",
      )
        .bind(meta.folder, projectTitle(meta.folder), project.id)
        .run();
    return json({ id: did });
  }
  if (p[2] === "documents" && p[3]) {
    const doc = await DB.prepare(
      "SELECT * FROM documents WHERE id=? AND project=?",
    )
      .bind(p[3], project.id)
      .first<any>();
    if (!doc) fail("PDF neexistuje.", 404);
    if (p[4] === "version" && req.method === "PUT")
      return replaceDocumentVersion(context, doc);
    if (p[4] === "file" && req.method === "GET") {
      const key =
        url.searchParams.get("graded") === "1" && doc.graded
          ? doc.graded
          : doc.original;
      const f = await BUCKET.get(key);
      if (!f) fail("Súbor sa nenašiel.", 404);
      return new Response(f.body, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (p[4] === "graded" && req.method === "PUT") {
      const bytes = await readBytes(req, 50 * 1024 * 1024);
      if (
        bytes.byteLength > 50 * 1024 * 1024 ||
        new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
      )
        fail("Neplatný PDF súbor.");
      const key = `${project.id}/documents/${doc.id}/graded.pdf`;
      await BUCKET.put(key, bytes);
      await DB.prepare("UPDATE documents SET graded=? WHERE id=?")
        .bind(key, doc.id)
        .run();
      return json({ ok: true });
    }
    if (!p[4] && req.method === "PATCH") {
      const b = await body(req);
      if (!Number.isInteger(b.revision)) fail("Neplatná revízia.");
      validateState(b.state);
      const state = JSON.stringify(b.state);
      const [out] = await DB.batch([
        DB.prepare(
          "UPDATE documents SET state=?, revision=revision+1, updated=? WHERE id=? AND revision=?",
        ).bind(state, Date.now(), doc.id, b.revision),
        ...documentTagStatements(DB, project.id, doc, b.state, b.revision + 1),
      ]);
      if (!out.meta.changes)
        return json(
          {
            error:
              "Dokument medzitým upravil iný používateľ. Vaše zmeny ostali otvorené.",
            conflict: true,
          },
          409,
        );
      return json({ revision: b.revision + 1 });
    }
  }
  return null;
}
