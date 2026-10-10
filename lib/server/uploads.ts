import { fail, id, json, readBytes, type ApiContext } from "./http";

export async function handleUploads({
  req,
  u,
  DB,
  BUCKET,
  url,
  p,
  project,
}: ApiContext): Promise<Response | null> {
  if (p[2] === "archive") {
    if (req.method === "GET") {
      if (!project.archive) fail("Archív ešte nie je uložený.", 404);
      const f = await BUCKET.get(project.archive);
      if (!f) fail("Archív sa nenašiel.", 404);
      return new Response(f.body, {
        headers: {
          "Content-Type": "application/zip",
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (req.method === "POST") {
      const key = `${project.id}/archives/${id()}.zip`;
      const upload = await BUCKET.createMultipartUpload(key);
      const uid = id();
      await DB.prepare(
        "INSERT INTO uploads(id,project,user,key,multipart) VALUES(?,?,?,?,?)",
      )
        .bind(uid, project.id, u.userId, key, upload.uploadId)
        .run();
      return json({ id: uid, key });
    }
  }
  if (p[2] === "uploads") {
    const up = await DB.prepare(
      "SELECT * FROM uploads WHERE id=? AND project=? AND user=?",
    )
      .bind(p[3], project.id, u.userId)
      .first<any>();
    if (!up) fail("Upload neexistuje.", 404);
    const multipart = BUCKET.resumeMultipartUpload(up.key, up.multipart);
    if (req.method === "PUT") {
      const n = Number(url.searchParams.get("part"));
      if (!Number.isInteger(n) || n < 1 || n > 10000) fail("Neplatný blok.");
      const buf = await readBytes(req, 8 * 1024 * 1024);
      if (buf.byteLength > 8 * 1024 * 1024) fail("Blok je príliš veľký.", 413);
      const part = await multipart.uploadPart(n, buf);
      const parts = JSON.parse(up.parts).filter((x: any) => x.partNumber !== n);
      parts.push(part);
      await DB.prepare("UPDATE uploads SET parts=? WHERE id=?")
        .bind(JSON.stringify(parts), up.id)
        .run();
      return json(part);
    }
    if (req.method === "POST") {
      await multipart.complete(
        JSON.parse(up.parts).sort(
          (a: any, b: any) => a.partNumber - b.partNumber,
        ),
      );
      await DB.batch([
        DB.prepare("UPDATE projects SET archive=? WHERE id=?").bind(
          up.key,
          project.id,
        ),
        DB.prepare("DELETE FROM uploads WHERE id=?").bind(up.id),
      ]);
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      await multipart.abort();
      await DB.prepare("DELETE FROM uploads WHERE id=?").bind(up.id).run();
      return json({ ok: true });
    }
  }
  return null;
}
