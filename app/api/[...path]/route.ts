import { handleDocuments } from "@/lib/server/documents";
import { handleExports } from "@/lib/server/exports";
import { body, fail, id, json, type ApiContext } from "@/lib/server/http";
import { handleLegacy } from "@/lib/server/legacy";
import { handleSharing } from "@/lib/server/sharing";
import { handleUploads } from "@/lib/server/uploads";

import { getUser } from "@/lib/auth";

import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
const E = () =>
  env as unknown as { DB: D1Database; BUCKET: R2Bucket; EXPORTER?: Fetcher };

async function handle(req: Request) {
  try {
    const u = await getUser();
    if (!u) return json({ error: "Prihláste sa." }, 401);
    const email = u.email.toLowerCase();
    const { DB, BUCKET } = E();
    const url = new URL(req.url);
    const p = url.pathname.slice(5).split("/");
    if (
      req.method !== "GET" &&
      req.headers.get("origin") &&
      req.headers.get("origin") !== url.origin
    )
      fail("Nepovolený pôvod požiadavky.", 403);
    if (p[0] === "me") return json(u);
    if (p[0] === "join" && req.method === "POST") {
      const { token } = await body(req);
      const project = await DB.prepare("SELECT * FROM projects WHERE share=?")
        .bind(token)
        .first<any>();
      if (!project) fail("Odkaz už neplatí.", 404);
      if (project.owner !== u.userId)
        await DB.prepare(
          "INSERT OR IGNORE INTO members(id,project,email,role) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM members WHERE project=? AND email=?)",
        )
          .bind(id(), project.id, email, "editor", project.id, email)
          .run();
      return json({ id: project.id });
    }
    if (p[0] !== "projects") fail("Nenájdené.", 404);
    if (!p[1]) {
      if (req.method === "GET")
        return json(
          (
            await DB.prepare(
              "SELECT DISTINCT p.* FROM projects p LEFT JOIN members m ON m.project=p.id WHERE p.owner=? OR m.email=? ORDER BY p.created DESC",
            )
              .bind(u.userId, email)
              .all()
          ).results.map((x: any) => ({
            ...x,
            legacy: undefined,
            share: undefined,
          })),
        );
      if (req.method === "POST") {
        const b = await body(req);
        if (
          typeof b.title !== "string" ||
          !b.title.trim() ||
          b.title.length > 200
        )
          fail("Zadajte názov projektu.");
        const pid = id();
        await DB.prepare(
          "INSERT INTO projects(id,owner,title,created) VALUES(?,?,?,?)",
        )
          .bind(pid, u.userId, b.title.trim(), Date.now())
          .run();
        return json({ id: pid });
      }
      fail("Nepovolená metóda.", 405);
    }
    const project = await DB.prepare("SELECT * FROM projects WHERE id=?")
      .bind(p[1])
      .first<any>();
    if (!project) fail("Projekt neexistuje.", 404);
    const membership = await DB.prepare(
      "SELECT role FROM members WHERE project=? AND email=?",
    )
      .bind(project.id, email)
      .first<any>();
    const role = project.owner === u.userId ? "owner" : membership?.role;
    if (!role) fail("Nemáte prístup k projektu.", 403);
    if (
      req.method !== "GET" &&
      role === "viewer" &&
      !(p[2] === "export" && req.method === "POST")
    )
      fail("Projekt je iba na čítanie.", 403);

    const context: ApiContext = {
      req,
      u,
      email,
      DB,
      BUCKET,
      url,
      p,
      project,
      role,
      exporter: E().EXPORTER,
    };
    for (const handler of [
      handleExports,
      handleSharing,
      handleUploads,
      handleLegacy,
      handleDocuments,
    ]) {
      const response = await handler(context);
      if (response) return response;
    }
    if (!p[2]) {
      if (req.method === "GET")
        return json({
          ...project,
          role,
          legacy: JSON.parse(project.legacy),
          share: role === "owner" ? project.share : undefined,
          documents: (
            await DB.prepare(
              "SELECT id,path,metadata,state,revision,updated,graded,original AS fileVersion FROM documents WHERE project=? ORDER BY path",
            )
              .bind(project.id)
              .all()
          ).results.map((d: any) => ({
            ...d,
            metadata: JSON.parse(d.metadata),
            state: JSON.parse(d.state),
            graded: !!d.graded,
          })),
        });
      if (req.method === "PATCH") {
        const b = await body(req);
        if (role !== "owner") fail("Iba vlastník môže meniť projekt.", 403);
        if (!b.title?.trim() || b.title.length > 200) fail("Neplatný názov.");
        await DB.prepare("UPDATE projects SET title=? WHERE id=?")
          .bind(b.title.trim(), project.id)
          .run();
        return json({ ok: true });
      }
    }

    fail("Nenájdené.", 404);
  } catch (e: any) {
    if (!e.status) console.error("API request failed", e);
    return json(
      { error: e.status ? e.message : "Serverová chyba. Skúste to znova." },
      e.status ?? 500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
