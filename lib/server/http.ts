export type ApiContext = {
  req: Request;
  u: {
    userId: string;
    email: string;
    displayName?: string;
    firstName?: string | null;
    imageUrl?: string;
  };
  email: string;
  DB: D1Database;
  BUCKET: R2Bucket;
  url: URL;
  p: string[];
  project: any;
  role: string;
  exporter?: Fetcher;
};
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export const id = () => crypto.randomUUID();

// Enforce byte limits while reading, before allocating an unbounded body.
export async function readBytes(
  req: Request,
  limit: number,
): Promise<Uint8Array> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        fail("Príliš veľa údajov.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function body(req: Request) {
  try {
    return JSON.parse(
      new TextDecoder().decode(await readBytes(req, 3_000_000)),
    );
  } catch (error: any) {
    if (error.status) throw error;
    fail("Neplatné JSON údaje.");
  }
}
