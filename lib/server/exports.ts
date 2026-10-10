import { fail, json, type ApiContext } from "./http";

export async function handleExports({
  req,
  u,
  DB,
  p,
  project,
  exporter,
}: ApiContext): Promise<Response | null> {
  if (p[2] === "export") {
    const service = exporter;
    if (!service)
      return json({ error: "Serverový export nie je dostupný." }, 501);
    const headers = {
      "x-export-owner": u.userId,
      "x-export-project": project.id,
    };
    const dispatch = async (request: Request) => {
      const response = await service.fetch(request);
      const forwarded = new Response(response.body, response);
      forwarded.headers.set("Cache-Control", "private, no-store");
      return forwarded;
    };
    if (req.method === "POST" && !p[3]) {
      const documents = (
        await DB.prepare(
          "SELECT path,original,metadata,state,revision FROM documents WHERE project=? ORDER BY path",
        )
          .bind(project.id)
          .all()
      ).results.map((d: any) => ({
        ...d,
        metadata: JSON.parse(d.metadata),
        state: JSON.parse(d.state),
      }));
      return dispatch(
        new Request("http://export.internal/create", {
          method: "POST",
          headers,
          body: JSON.stringify({
            project: {
              id: project.id,
              title: project.title,
              folder: project.folder,
              archive: project.archive,
              legacy: JSON.parse(project.legacy),
            },
            documents,
          }),
        }),
      );
    }
    if (
      req.method === "GET" &&
      p[3] &&
      p.length < 6 &&
      (!p[4] || p[4] === "download")
    )
      return dispatch(
        new Request(
          "http://export.internal/jobs/" +
            encodeURIComponent(p[3]) +
            (p[4] ? "/download" : ""),
          { headers },
        ),
      );
    fail("Nepovolená metóda.", 405);
  }
  return null;
}
