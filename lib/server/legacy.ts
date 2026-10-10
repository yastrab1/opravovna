import { unpack } from "msgpackr";
import { mergeLegacy } from "../merge";
import { fail, json, readBytes, type ApiContext } from "./http";
export async function handleLegacy({
  req,
  DB,
  url,
  p,
  project,
}: ApiContext): Promise<Response | null> {
  if (p[2] === "legacy" && req.method === "PUT") {
    const bytes = await readBytes(req, 3_000_000);
    if (bytes.byteLength > 3_000_000) fail("Metadáta sú príliš veľké.", 413);
    let legacy: any;
    try {
      legacy = unpack(new Uint8Array(bytes));
    } catch {
      fail("changes.arn sa nepodarilo načítať.");
    }
    if (!legacy || typeof legacy !== "object" || !legacy.changes)
      fail("Neplatný formát changes.arn.");
    if (url.searchParams.get("merge") === "1")
      legacy = mergeLegacy(JSON.parse(project.legacy), legacy);
    await DB.prepare("UPDATE projects SET legacy=? WHERE id=?")
      .bind(JSON.stringify(legacy), project.id)
      .run();
    return json({ ok: true });
  }
  return null;
}
