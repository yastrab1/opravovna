import fs from "node:fs/promises";
import ts from "typescript";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
export async function createApiFixture() {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      compatibilityDate: "2026-05-15",
      d1Databases: ["DB"],
      r2Buckets: ["BUCKET"],
    }),
  );
  try {
    await fs.mkdir(".test-tmp/server", { recursive: true });
    for (const name of ["archive", "merge"])
      await fs.writeFile(
        `.test-tmp/${name}.mjs`,
        ts.transpileModule(await fs.readFile(`lib/${name}.ts`, "utf8"), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText,
      );
    for (const name of await fs.readdir("lib/server"))
      if (name.endsWith(".ts"))
        await fs.writeFile(
          `.test-tmp/server/${name.replace(/\.ts$/, ".mjs")}`,
          ts
            .transpileModule(await fs.readFile(`lib/server/${name}`, "utf8"), {
              compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
              },
            })
            .outputText.replace(/(from\s+['"]\.[^'"]+)(['"])/g, "$1.mjs$2"),
        );
    const DB = await mf.getD1Database("DB"),
      BUCKET = await mf.getR2Bucket("BUCKET");
    globalThis.__testEnv = { DB, BUCKET };
    for (const file of (await fs.readdir("drizzle"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      for (const sql of (await fs.readFile("drizzle/" + file, "utf8")).split(
        "--> statement-breakpoint",
      ))
        await DB.prepare(sql).run();
    let source = (await fs.readFile("app/api/[...path]/route.ts", "utf8"))
      .replaceAll("@/lib/server/", "./server/")
      .replace(/(from\s+['"]\.\/server\/[^'"]+)(['"])/g, "$1.mjs$2");
    source = source
      .replace(
        'import { env } from "cloudflare:workers";',
        "const env=globalThis.__testEnv;",
      )
      .replace(
        'import { getUser } from "@/lib/auth";',
        "const getUser=async()=>globalThis.__testUser;",
      );
    await fs.writeFile(
      ".test-tmp/route.mjs",
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    );
    const route = await import("../../.test-tmp/route.mjs");
    async function req(user, path, method = "GET", body, headers = {}) {
      globalThis.__testUser = user;
      const r = await route[method](
        new Request("https://app.test/api/" + path, {
          method,
          headers,
          ...(body !== undefined
            ? {
                body:
                  typeof body === "object" &&
                  !(body instanceof Uint8Array) &&
                  !(body instanceof FormData)
                    ? JSON.stringify(body)
                    : body,
              }
            : {}),
        }),
      );
      return { status: r.status, data: await r.json() };
    }
    return { mf, DB, BUCKET, req };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}
