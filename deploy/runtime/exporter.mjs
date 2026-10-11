import { RenderPool } from "./render-pool.mjs";
import { generateArchive } from "./generate-archive.mjs";
import { availableParallelism, tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { exportName, projectTitle } from "./dist/export/archive.mjs";
import { gradedDocuments } from "./dist/export/archive-export.mjs";

export function createExporter(getBucket, options = {}) {
  const threads = Math.min(
    16,
    Math.max(
      1,
      Number(options.threads ?? process.env.EXPORT_WORKERS) ||
        Math.min(8, availableParallelism() - 2),
    ),
  );
  const pool = new RenderPool(threads),
    jobs = new Map(),
    queue = [];
  const directory =
    options.directory || path.join(tmpdir(), "opravovna-exports");
  const initialized = (async () => {
    await fs.mkdir(directory, { recursive: true });
    // Jobs are in memory; files from a previous process cannot be resumed.
    for (const file of await fs.readdir(directory))
      if (/^[0-9a-f-]+(?:-part-\d+)?\.zip$/.test(file))
        await fs.rm(path.join(directory, file), { force: true });
  })();
  let active = false,
    closing = false;
  const ttl = 30 * 60_000;
  const publicJob = (job) => ({
    id: job.id,
    status: job.status,
    completed: job.completed,
    total: job.total,
    stage: job.stage,
    percent: job.percent,
    error: job.error,
    failedSolution: job.failedSolution,
    filename: job.filename,
    threads,
    parts: job.status === "ready" ? job.parts : undefined,
  });
  async function remove(job) {
    jobs.delete(job.id);
    await Promise.all(job.files.map((file) => fs.rm(file, { force: true })));
  }
  async function cleanup() {
    for (const job of jobs.values())
      if (
        ["ready", "error"].includes(job.status) &&
        Date.now() - job.finished > ttl
      )
        await remove(job);
  }
  const timer = setInterval(() => void cleanup().catch(console.error), 60_000);
  timer.unref();

  async function pump() {
    if (active || closing) return;
    active = true;
    try {
      while (queue.length && !closing) {
        const job = queue.shift();
        try {
          await generateArchive(job, {
            initialized,
            getBucket,
            threads,
            pool,
            isClosing: () => closing,
            directory,
            partBytes: options.partBytes,
          });
        } catch (error) {
          console.error("Archive export failed:", error.message);
          job.status = "error";
          job.error = error.message;
          job.failedSolution ||= error.failedSolution;
          job.finished = Date.now();
          job.snapshot = null;
          await Promise.all(
            job.files.map((file) => fs.rm(file, { force: true })),
          );
        }
      }
    } finally {
      active = false;
    }
  }
  return {
    threads,
    async fetch(request) {
      const url = new URL(request.url),
        owner = request.headers.get("x-export-owner"),
        project = request.headers.get("x-export-project");
      if (!owner || !project)
        return Response.json({ error: "Prihláste sa." }, { status: 401 });
      if (url.pathname === "/create" && request.method === "POST") {
        const snapshot = await request.json();
        if (snapshot.project.id !== project || !snapshot.project.archive)
          return Response.json(
            { error: "Najprv importujte ZIP archív." },
            { status: 400 },
          );
        await cleanup();
        const fingerprint = createHash("sha256")
          .update(owner + JSON.stringify(snapshot))
          .digest("hex");
        for (const job of jobs.values())
          if (job.fingerprint === fingerprint && job.status !== "error")
            return Response.json(publicJob(job));
        if (
          [...jobs.values()].filter((j) =>
            ["queued", "running"].includes(j.status),
          ).length >= 4
        )
          return Response.json(
            {
              error: "Server už pripravuje ďalšie exporty. Skúste to o chvíľu.",
            },
            { status: 429 },
          );
        const retained = [...jobs.values()].filter((j) =>
          ["ready", "error"].includes(j.status),
        );
        while (retained.length >= 8) await remove(retained.shift());
        const id = randomUUID(),
          title = snapshot.project.folder
            ? projectTitle(snapshot.project.folder)
            : snapshot.project.title;
        const job = {
          id,
          fingerprint,
          owner,
          project,
          snapshot,
          status: "queued",
          stage: "queued",
          completed: 0,
          total: gradedDocuments(snapshot.documents).length,
          percent: 0,
          file: path.join(directory, id + ".zip"),
          files: [],
          filename: exportName(title),
        };
        jobs.set(id, job);
        queue.push(job);
        void pump();
        return Response.json(publicJob(job));
      }
      const match = /^\/jobs\/([^/]+)(\/download)?$/.exec(url.pathname),
        job = match && jobs.get(match[1]);
      if (
        request.method !== "GET" ||
        !job ||
        job.owner !== owner ||
        job.project !== project
      )
        return Response.json(
          { error: "Export už nie je dostupný. Spustite ho znova." },
          { status: 404 },
        );
      if (!match[2]) return Response.json(publicJob(job));
      if (job.status !== "ready")
        return Response.json(
          { error: "Export ešte nie je pripravený." },
          { status: 409 },
        );
      const selected = url.searchParams.get("part");
      if (selected === null && job.parts.length > 1)
        return Response.json(
          { error: "Vyberte časť exportu na stiahnutie." },
          { status: 409 },
        );
      const number = selected === null ? 1 : Number(selected);
      if (
        !/^[1-9]\d*$/.test(selected ?? "1") ||
        !job.parts.some((p) => p.part === number)
      )
        return Response.json(
          { error: "Časť exportu sa nenašla." },
          { status: 404 },
        );
      const file = job.files[number - 1];
      const stat = await fs.stat(file);
      return new Response(Readable.toWeb(createReadStream(file)), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Length": String(stat.size),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`,
          "Cache-Control": "private, no-store",
        },
      });
    },
    async close() {
      closing = true;
      clearInterval(timer);
      await pool.close();
    },
  };
}
