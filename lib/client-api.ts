const delay = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
export async function api(path: string, init: RequestInit = {}): Promise<any> {
  const retryable = ["GET", "HEAD", "PUT"].includes(
    (init.method ?? "GET").toUpperCase(),
  );
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("/api/" + path, {
        ...init,
        headers,
      });
    } catch (cause) {
      if (init.signal?.aborted) throw cause;
      if (!retryable || attempt >= 2)
        throw new Error(
          "Spojenie so serverom sa prerušilo. Skúste akciu znova.",
          { cause },
        );
      await delay(attempt);
      continue;
    }
    if (retryable && attempt < 2 && [429, 502, 503, 504].includes(res.status)) {
      await res.body?.cancel();
      await delay(attempt);
      continue;
    }
    if (!res.ok) {
      const data: any = await res.json().catch(() => ({
        error: `Server vrátil chybu ${res.status}. Skúste akciu znova.`,
      }));
      throw Object.assign(new Error(data.error), { status: res.status });
    }
    try {
      return await res.json();
    } catch (cause) {
      if (!retryable || attempt >= 2 || init.signal?.aborted)
        throw new Error(
          "Odpoveď zo servera sa prerušila. Skúste akciu znova.",
          { cause },
        );
      await delay(attempt);
    }
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
