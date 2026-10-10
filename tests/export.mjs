import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { unpack } from 'msgpackr';
import { createCanvas, loadImage } from '@napi-rs/canvas';

execFileSync(process.execPath, ['scripts/build-export.mjs']);
const root = path.resolve('.test-tmp/export-runtime');
await fs.mkdir(root, { recursive: true });
for (const file of ['exporter.mjs', 'pdf-worker.mjs']) await fs.copyFile('deploy/runtime/' + file, path.join(root, file));
await fs.mkdir(path.join(root, 'dist/export'), { recursive: true });
for (const file of ['archive', 'pdf-annotations', 'pdf-render']) await fs.copyFile(`dist/export/${file}.mjs`, path.join(root, `dist/export/${file}.mjs`));
const { createExporter } = await import(path.join(root, 'exporter.mjs'));
const input = await PDFDocument.create(); input.addPage([595.28, 841.89]);
const bytes = await input.save(), zip = new JSZip(), objects = new Map();
const image = createCanvas(12, 12); image.getContext('2d').fillStyle = '#00b8da'; image.getContext('2d').fillRect(0, 0, 12, 12);
const state = { tags: ['kontrola'], scoring: { points: 4.67, annotName: 'stamp' }, rotations: {}, extraPages: 0, changes: [
  { page: 0, type: 'Text', data: { text: '4.67B', name: 'stamp', left: 80, top: 60, width: 200, fontSize: 40, fontFamily: 'Gloria Hallelujah', fill: '#c02080' } },
  { page: 0, type: 'Path', data: { path: 'M 0 0 L 120 0 L 120 60', left: 80, top: 150, fill: null, stroke: '#ff6600', strokeWidth: 4 } },
  { page: 0, type: 'Image', data: { src: image.toDataURL(), left: 80, top: 250, width: 12, height: 12, scaleX: 4, scaleY: 4 } },
] };
const documents = Array.from({ length: 4 }, (_, i) => ({ path: `4-priklad/p4-c8-user-${i}-${i + 1}.pdf`, original: 'file-' + i, metadata: { submissionId: String(i + 1), folder: '4-priklad' }, revision: 1, state: i === 2 ? { changes: [], tags: [], scoring: {}, rotations: {}, extraPages: 0 } : i === 1 ? { ...state, rotations: { 0: 90 }, extraPages: 1 } : structuredClone(state) }));
for (const doc of documents) { zip.file(doc.path, bytes); objects.set(doc.original, bytes); }
zip.file('README.txt', 'Preserve original archive attachments'); zip.file('4-priklad/3_graded.pdf', 'stale');
objects.set('archive', await zip.generateAsync({ type: 'uint8array' }));
const snapshot = { project: { id: 'project', title: 'Ignored title', folder: '4-Kto-druhemu-jamu-kope--sam-do-nej-spadne', archive: 'archive', legacy: { custom: 'preserve', changes: { '1': { opened: true, timeOpened: 123, other: 'keep' } } } }, documents };
const bucket = { get: async key => objects.has(key) ? { body: new Blob([objects.get(key)]).stream() } : null };
const exporter = createExporter(async () => bucket, { threads: 2, directory: path.join(root, 'artifacts') });
const headers = { 'x-export-owner': 'owner', 'x-export-project': 'project' };
const call = (url, init = {}) => exporter.fetch(new Request('http://internal' + url, { ...init, headers: { ...headers, ...init.headers } }));
async function wait(job) {
  const deadline = Date.now() + 30_000;
  while (!['ready', 'error'].includes(job.status)) {
    assert(Date.now() < deadline, 'Export should finish');
    await new Promise(r => setTimeout(r, 50)); job = await (await call('/jobs/' + job.id)).json();
  }
  return job;
}
try {
  const start = performance.now();
  const create = () => call('/create', { method: 'POST', body: JSON.stringify(snapshot) });
  let job = await (await create()).json();
  assert.equal((await (await create()).json()).id, job.id, 'Same snapshot reuses in-progress export');
  assert.equal((await call('/jobs/' + job.id, { headers: { 'x-export-owner': 'someone-else' } })).status, 404);
  assert.equal((await call('/jobs/' + job.id, { headers: { 'x-export-project': 'another-project' } })).status, 404);
  assert.equal((await call('/jobs/' + job.id + '/download')).status, 409);
  job = await wait(job); assert.equal(job.status, 'ready', job.error); assert.equal(job.completed, 4); assert.equal(job.threads, 2);
  const response = await call('/jobs/' + job.id + '/download'); assert.equal(response.status, 200);
  const output = await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(job.filename, '4. Kto druhemu jamu kope sam do nej spadne_opravene.zip');
  assert.equal(await output.file('README.txt').async('string'), 'Preserve original archive attachments');
  for (const doc of documents) assert.deepEqual(await output.file(doc.path).async('uint8array'), bytes, 'Original PDF bytes remain intact');
  assert.equal(output.file('4-priklad/3_graded.pdf'), null, 'Cleared annotations remove stale flattened PDFs');
  const legacy = unpack(await output.file('changes.arn').async('uint8array'));
  assert.equal(legacy.custom, 'preserve'); assert.equal(legacy.changes['1'].other, 'keep'); assert.equal(legacy.changes['1'].timeOpened, 123);
  assert.equal(legacy.changes['1'].scoring.points, 4.67); assert.deepEqual(legacy.changes['1'].changes, state.changes);
  assert.deepEqual(JSON.parse(await output.file('opravovna.json').async('string')).documents[documents[1].path], documents[1].state);
  const flatBytes = await output.file('4-priklad/2_graded.pdf').async('uint8array'), flat = await PDFDocument.load(flatBytes);
  assert.equal(flat.getPageCount(), 2); assert.equal(flat.getPage(0).getRotation().angle, 90);
  await fs.writeFile(path.join(root, 'annotated.pdf'), await output.file('4-priklad/1_graded.pdf').async('uint8array'));
  execFileSync('pdftoppm', ['-scale-to', '1000', '-singlefile', '-png', path.join(root, 'annotated.pdf'), path.join(root, 'annotated')]);
  const preview = await loadImage(await fs.readFile(path.join(root, 'annotated.png')));
  const pixels = createCanvas(preview.width, preview.height), context = pixels.getContext('2d'); context.drawImage(preview, 0, 0);
  const sample = context.getImageData(Math.round(100 / 595.28 * preview.width), Math.round(270 / 841.89 * preview.height), 1, 1).data;
  assert(sample[0] < 20 && sample[1] > 150 && sample[2] > 180, 'Inserted cyan image must be visible in the actual exported PDF');
  assert.equal((await (await create()).json()).id, job.id, 'Finished snapshot is cached');
  console.log(`PASS: threaded ZIP export (${Math.round(performance.now() - start)}ms), exact schema, unchanged originals, decimal grade, text/path/image rendering, rotation, extra page, job isolation, reuse`);
  snapshot.documents[0].state.changes = [{ page: 0, type: 'Image', data: { src: 'http://127.0.0.1/private.png' } }];
  const failed = await wait(await (await create()).json()); assert.equal(failed.status, 'error');
  assert.equal((await call('/jobs/' + failed.id + '/download')).status, 409, 'Failed exports cannot download partial archives');
  assert.notEqual((await (await create()).json()).id, failed.id, 'Failed exports can retry');
  console.log('PASS: remote image references are rejected and failed archives stay unavailable');
} finally { await exporter.close(); }
