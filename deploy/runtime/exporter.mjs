import { Worker } from 'node:worker_threads';
import { availableParallelism, tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { pack } from 'msgpackr';
import { exportName, projectTitle, gradedFilePath, legacyGradedFilePath } from './dist/export/archive.mjs';

class RenderPool {
  constructor(size) { this.slots = Array.from({ length: size }, () => ({ worker: null, task: null })); this.queue = []; }
  run(bytes, state) {
    return new Promise((resolve, reject) => { this.queue.push({ id: randomUUID(), bytes, state, resolve, reject }); this.dispatch(); });
  }
  dispatch() {
    for (const slot of this.slots) {
      if (slot.task || !this.queue.length) continue;
      if (!slot.worker) {
        const worker = slot.worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url));
        const fail = error => {
          if (slot.worker !== worker) return;
          clearTimeout(slot.timer); slot.worker = null;
          slot.task?.reject(error); slot.task = null;
          void worker.terminate(); this.dispatch();
        };
        worker.on('error', fail);
        worker.on('exit', () => fail(new Error('Exportný proces bol prerušený. Skúste export znova.')));
        worker.on('message', result => {
          if (!slot.task || result.id !== slot.task.id) return;
          clearTimeout(slot.timer);
          const task = slot.task; slot.task = null;
          result.error ? task.reject(new Error(result.error)) : task.resolve(result.bytes);
          this.dispatch();
        });
      }
      slot.task = this.queue.shift();
      slot.timer = setTimeout(() => {
        const task = slot.task; slot.task = null;
        const worker = slot.worker; slot.worker = null;
        task.reject(new Error('Export PDF trvá príliš dlho. Skúste export znova.'));
        void worker.terminate(); this.dispatch();
      }, 180_000);
      const { id, bytes, state } = slot.task;
      slot.worker.postMessage({ id, bytes, state }, [bytes.buffer]);
    }
  }
  async close() {
    for (const task of this.queue.splice(0)) task.reject(new Error('Server sa reštartuje.'));
    await Promise.all(this.slots.map(async slot => {
      clearTimeout(slot.timer); slot.task?.reject(new Error('Server sa reštartuje.')); slot.task = null;
      const worker = slot.worker; slot.worker = null; await worker?.terminate();
    }));
  }
}

export function createExporter(getBucket, options = {}) {
  const threads = Math.min(16, Math.max(1, Number(options.threads ?? process.env.EXPORT_WORKERS) || Math.min(8, availableParallelism() - 2)));
  const pool = new RenderPool(threads), jobs = new Map(), queue = [];
  const directory = options.directory || path.join(tmpdir(), 'opravovna-exports');
  const initialized = (async () => {
    await fs.mkdir(directory, { recursive: true });
    // Jobs are in memory; files from a previous process cannot be resumed.
    for (const file of await fs.readdir(directory)) if (/^[0-9a-f-]+\.zip$/.test(file)) await fs.rm(path.join(directory, file), { force: true });
  })();
  let active = false, closing = false;
  const ttl = 30 * 60_000;
  const publicJob = job => ({ id: job.id, status: job.status, completed: job.completed, total: job.total, stage: job.stage, percent: job.percent, error: job.error, filename: job.filename, threads });
  async function remove(job) { jobs.delete(job.id); await fs.rm(job.file, { force: true }); }
  async function cleanup() {
    for (const job of jobs.values()) if (['ready', 'error'].includes(job.status) && Date.now() - job.finished > ttl) await remove(job);
  }
  const timer = setInterval(() => void cleanup().catch(console.error), 60_000); timer.unref();
  async function generate(job) {
    const start = performance.now();
    await initialized;
    job.status = 'running'; job.stage = 'loading';
    const { snapshot } = job, bucket = await getBucket();
    const original = await bucket.get(snapshot.project.archive);
    if (!original) throw new Error('Pôvodný ZIP archív sa nenašiel.');
    // Consume the R2 body stream. Calling arrayBuffer() on Miniflare's proxy
    // serializes the entire file through RPC and blocks other requests.
    const zip = await JSZip.loadAsync(await new Response(original.body).arrayBuffer());
    const legacy = structuredClone(snapshot.project.legacy);
    legacy.tags ??= []; legacy.changes ??= {}; legacy.scoringCriteria ??= [];
    const sidecar = { version: 1, documents: {} };
    // Metadata order is deterministic even though PDFs render concurrently.
    for (const document of snapshot.documents) {
      const { metadata: m, state } = document, old = legacy.changes[m.submissionId] ?? {};
      legacy.changes[m.submissionId] = { ...old, changes: state.changes, tags: state.tags, scoring: state.scoring, opened: old.opened ?? false, timeOpened: old.timeOpened ?? 0 };
      sidecar.documents[document.path] = state;
      for (const tag of state.tags ?? []) if (!legacy.tags.some(t => (typeof t === 'object' ? t.name : t) === (typeof tag === 'object' ? tag.name : tag))) legacy.tags.push(tag);
    }
    let index = 0, failure;
    job.stage = 'pdf';
    const workers = Array.from({ length: Math.min(threads, snapshot.documents.length) }, async () => {
      while (!failure && !closing && index < snapshot.documents.length) {
        const document = snapshot.documents[index++];
        try {
          const input = await bucket.get(document.original);
          if (!input) throw new Error('Pôvodné PDF sa nenašlo.');
          const bytes = new Uint8Array(await new Response(input.body).arrayBuffer());
          zip.file(document.path, bytes);
          const { metadata: m, state } = document;
          const graded = gradedFilePath(document.path);
          // Remove any old ID-only copy when replacing the flattened file.
          zip.remove(legacyGradedFilePath(document.path, m.submissionId));
          zip.remove(graded);
          const changed = state.changes?.length || state.extraPages || Object.values(state.rotations ?? {}).some(v => v !== 0);
          if (changed) zip.file(graded, await pool.run(bytes.slice(), state));
          else zip.remove(graded);
          job.completed++;
        } catch (error) { failure = error; }
      }
    });
    await Promise.all(workers);
    if (failure) throw failure;
    if (closing) throw new Error('Server sa reštartuje. Skúste export znova.');
    zip.file('changes.arn', pack(legacy)); zip.file('opravovna.json', JSON.stringify(sidecar));
    job.stage = 'packing';
    await fs.mkdir(directory, { recursive: true });
    await pipeline(zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' }, update => { job.percent = Math.round(update.percent); }), createWriteStream(job.file, { mode: 0o600 }));
    job.status = 'ready'; job.stage = 'ready'; job.finished = Date.now(); job.snapshot = null;
    console.log(`Export complete: ${job.total} PDFs, ${threads} render threads, ${Math.round(performance.now() - start)}ms`);
  }
  async function pump() {
    if (active || closing) return;
    active = true;
    try {
      while (queue.length && !closing) {
        const job = queue.shift();
        try { await generate(job); }
        catch (error) {
          console.error('Archive export failed:', error.message);
          job.status = 'error'; job.error = error.message; job.finished = Date.now(); job.snapshot = null;
          await fs.rm(job.file, { force: true });
        }
      }
    } finally { active = false; }
  }
  return {
    threads,
    async fetch(request) {
      const url = new URL(request.url), owner = request.headers.get('x-export-owner'), project = request.headers.get('x-export-project');
      if (!owner || !project) return Response.json({ error: 'Prihláste sa.' }, { status: 401 });
      if (url.pathname === '/create' && request.method === 'POST') {
        const snapshot = await request.json();
        if (snapshot.project.id !== project || !snapshot.project.archive) return Response.json({ error: 'Najprv importujte ZIP archív.' }, { status: 400 });
        await cleanup();
        const fingerprint = createHash('sha256').update(owner + JSON.stringify(snapshot)).digest('hex');
        for (const job of jobs.values()) if (job.fingerprint === fingerprint && job.status !== 'error') return Response.json(publicJob(job));
        if ([...jobs.values()].filter(j => ['queued', 'running'].includes(j.status)).length >= 4) return Response.json({ error: 'Server už pripravuje ďalšie exporty. Skúste to o chvíľu.' }, { status: 429 });
        const retained = [...jobs.values()].filter(j => ['ready', 'error'].includes(j.status));
        while (retained.length >= 8) await remove(retained.shift());
        const id = randomUUID(), title = snapshot.project.folder ? projectTitle(snapshot.project.folder) : snapshot.project.title;
        const job = { id, fingerprint, owner, project, snapshot, status: 'queued', stage: 'queued', completed: 0, total: snapshot.documents.length, percent: 0, file: path.join(directory, id + '.zip'), filename: exportName(title) };
        jobs.set(id, job); queue.push(job); void pump();
        return Response.json(publicJob(job));
      }
      const match = /^\/jobs\/([^/]+)(\/download)?$/.exec(url.pathname), job = match && jobs.get(match[1]);
      if (request.method !== 'GET' || !job || job.owner !== owner || job.project !== project) return Response.json({ error: 'Export už nie je dostupný. Spustite ho znova.' }, { status: 404 });
      if (!match[2]) return Response.json(publicJob(job));
      if (job.status !== 'ready') return Response.json({ error: 'Export ešte nie je pripravený.' }, { status: 409 });
      const stat = await fs.stat(job.file);
      return new Response(Readable.toWeb(createReadStream(job.file)), { headers: { 'Content-Type': 'application/zip', 'Content-Length': String(stat.size), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`, 'Cache-Control': 'private, no-store' } });
    },
    async close() { closing = true; clearInterval(timer); await pool.close(); },
  };
}
