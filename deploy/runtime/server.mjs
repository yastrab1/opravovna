import { Miniflare, Log, LogLevel } from 'miniflare';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createExporter } from './exporter.mjs';

const root = process.cwd();
const state = process.env.DATA_DIR || '/data';
const config = JSON.parse(await fs.readFile('dist/server/wrangler.json', 'utf8'));
const origin = new URL(process.env.APP_ORIGIN || 'http://localhost:8787');
const moduleRoot = path.join(root, 'dist/server');
const entryPath = path.join(moduleRoot, 'container-entry.mjs');
const moduleFiles = (await fs.readdir(moduleRoot, { recursive: true }))
  .filter(x => /\.(m?js)$/.test(x)).map(x => path.join(moduleRoot, x));
for (const key of ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

// Run the compiled Worker directly: no dev watcher, CLI login or cloud storage.
// Preserve Wrangler's binding IDs so an offline copy of its v3 state opens intact.
const exporter = createExporter(() => mf.getR2Bucket('BUCKET'));
const mf = new Miniflare({
  name: config.name,
  // Clerk and the framework use dynamic imports; register every built chunk.
  modules: [entryPath, ...moduleFiles.filter(x => x !== entryPath)]
    .map(file => ({ type: 'ESModule', path: file })),
  modulesRoot: moduleRoot,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  host: '0.0.0.0',
  port: Number(process.env.PORT || 8787),
  cf: false,
  log: new Log(LogLevel.INFO),
  serviceBindings: { EXPORTER: request => exporter.fetch(request) },
  bindings: {
    APP_ORIGIN: origin.origin,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  d1Databases: Object.fromEntries(config.d1_databases.map(x => [x.binding, x.database_id])),
  d1Persist: path.join(state, 'd1'),
  r2Buckets: Object.fromEntries(config.r2_buckets.map(x => [x.binding, x.bucket_name])),
  r2Persist: path.join(state, 'r2'),
  assets: {
    workerName: config.name,
    directory: path.join(root, 'dist/client'),
    binding: 'ASSETS',
    routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true },
    assetConfig: { not_found_handling: 'none' },
  },
});

try {
  const db = await mf.getD1Database('DB');
  await db.prepare('CREATE TABLE IF NOT EXISTS opravovna_migrations (name TEXT PRIMARY KEY)').run();
  const files = (await fs.readdir('drizzle')).filter(x => x.endsWith('.sql')).sort();
  for (const [index, file] of files.entries()) {
    if (await db.prepare('SELECT name FROM opravovna_migrations WHERE name=?').bind(file).first()) continue;
    // Existing local installations already have the initial schema.
    const initialized = index === 0 && await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").first();
    const statements = initialized ? [] : (await fs.readFile(path.join('drizzle', file), 'utf8'))
      .split('--> statement-breakpoint').map(x => x.trim()).filter(Boolean).map(x => db.prepare(x));
    await db.batch([...statements, db.prepare('INSERT INTO opravovna_migrations(name) VALUES(?)').bind(file)]);
  }
  // Health only becomes ready once migrations have succeeded.
  await db.prepare("CREATE TABLE IF NOT EXISTS opravovna_health (id INTEGER PRIMARY KEY)").run();
  console.log(`Opravovna listening on ${await mf.ready}; public origin ${origin.origin}`);
  console.log(`Server export pool: ${exporter.threads} CPU threads`);
} catch (error) {
  await mf.dispose();
  throw error;
}

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  await exporter.close();
  await mf.dispose();
  process.exit(0);
});
