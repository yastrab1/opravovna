import { body, fail, id, json, type ApiContext } from "./http";

export async function handleSharing({
  req,
  DB,
  p,
  project,
  role,
}: ApiContext): Promise<Response | null> {
  if (p[2] === "members") {
    if (role !== "owner") fail("Iba vlastník spravuje zdieľanie.", 403);
    if (req.method === "GET")
      return json(
        (
          await DB.prepare("SELECT id,email,role FROM members WHERE project=?")
            .bind(project.id)
            .all()
        ).results,
      );
    const b = await body(req);
    if (req.method === "DELETE") {
      await DB.prepare("DELETE FROM members WHERE project=? AND id=?")
        .bind(project.id, b.id)
        .run();
      return json({ ok: true });
    }
    if (req.method === "POST") {
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) ||
        !["editor", "viewer"].includes(b.role)
      )
        fail("Neplatný e-mail alebo rola.");
      await DB.batch([
        DB.prepare("DELETE FROM members WHERE project=? AND email=?").bind(
          project.id,
          b.email.toLowerCase(),
        ),
        DB.prepare(
          "INSERT INTO members(id,project,email,role) VALUES(?,?,?,?)",
        ).bind(id(), project.id, b.email.toLowerCase(), b.role),
      ]);
      return json({ ok: true });
    }
  }
  if (p[2] === "share" && req.method === "POST") {
    if (role !== "owner") fail("Iba vlastník spravuje zdieľanie.", 403);
    const b = await body(req);
    const token = b.revoke ? null : id() + id();
    await DB.prepare("UPDATE projects SET share=? WHERE id=?")
      .bind(token, project.id)
      .run();
    return json({ token });
  }
  return null;
}
