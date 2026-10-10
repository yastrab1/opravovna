import app from "./index.js";

const containerWorker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      try {
        await env.DB.prepare("SELECT id FROM opravovna_health LIMIT 1").all();
        return new Response("ok", { headers: { "Cache-Control": "no-store" } });
      } catch {
        return new Response("starting", { status: 503 });
      }
    }
    // The tunnel terminates TLS. Restore the configured public origin before
    // Clerk and the application's same-origin checks inspect the request.
    const publicUrl = new URL(url.pathname + url.search, env.APP_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("host", publicUrl.host);
    headers.set("x-forwarded-host", publicUrl.host);
    headers.set("x-forwarded-proto", publicUrl.protocol.slice(0, -1));
    const forwarded = new Request(publicUrl, new Request(request, { headers }));
    if (request.method === "GET" || request.method === "HEAD") {
      const asset = await env.ASSETS.fetch(forwarded);
      if (asset.status !== 404) return asset;
    }
    return app.fetch(forwarded, env, ctx);
  },
};

export default containerWorker;
