import { PRESENCE_TTL, type ProjectViewer } from "../presence";
import { fail, json, type ApiContext } from "./http";

export async function handlePresence({
  req,
  DB,
  p,
  project,
  u,
  email,
}: ApiContext): Promise<Response | null> {
  if (p[2] !== "presence") return null;
  const now = Date.now();
  const session = p[3];
  if (req.method !== "GET") {
    if (!["PUT", "DELETE"].includes(req.method))
      fail("Nepovolená metóda.", 405);
    if (
      p[4] ||
      !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(session ?? "")
    )
      fail("Neplatná relácia.");
    if (req.method === "DELETE") {
      await DB.prepare(
        "DELETE FROM project_presence WHERE project=? AND user=? AND session=?",
      )
        .bind(project.id, u.userId, session)
        .run();
      return json({ ok: true });
    }
    await DB.batch([
      DB.prepare("DELETE FROM project_presence WHERE updated<=?").bind(
        now - PRESENCE_TTL,
      ),
      DB.prepare(
        `INSERT INTO project_presence(project,user,session,email,name,image,updated)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(project,user,session) DO UPDATE SET
        email=excluded.email,name=excluded.name,image=excluded.image,updated=excluded.updated`,
      ).bind(
        project.id,
        u.userId,
        session,
        email,
        (u.displayName || email).slice(0, 200),
        /^https:\/\//.test(u.imageUrl ?? "") ? u.imageUrl! : "",
        now,
      ),
    ]);
  }
  const rows = (
    await DB.prepare(
      `SELECT pr.user AS userId,pr.name,pr.image,pr.updated
    FROM project_presence pr WHERE pr.project=? AND pr.updated>?
    AND (pr.user=? OR EXISTS(SELECT 1 FROM members m WHERE m.project=pr.project AND m.email=pr.email))
    ORDER BY pr.updated DESC,pr.user LIMIT 200`,
    )
      .bind(project.id, now - PRESENCE_TTL, project.owner)
      .all<ProjectViewer>()
  ).results;
  const people = new Map<string, ProjectViewer>();
  for (const row of rows)
    if (!people.has(row.userId)) people.set(row.userId, row);
  return json([...people.values()]);
}
