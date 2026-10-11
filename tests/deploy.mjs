import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
const directory = resolve(".test-tmp/deploy-test-" + Date.now());
await mkdir(directory + "/bin", { recursive: true });
const server = createServer(async (req, res) => {
  if (req.url.startsWith("/health-fail")) {
    const compose = await readFile(
      directory + "/health-fail/personal-project.compose.yml",
      "utf8",
    );
    res.statusCode = compose.includes("2".repeat(64)) ? 503 : 200;
    res.end("health");
    return;
  }
  res.statusCode = req.url === "/api/projects" ? 401 : 200;
  res.end("ok");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const digest = "sha256:" + "2".repeat(64),
  old = "ghcr.io/yastrab1/opravovna@sha256:" + "1".repeat(64);
const shim = `#!/usr/bin/env node
import fs from 'node:fs';import cp from 'node:child_process';import path from 'node:path';const command=path.basename(process.argv[1]),args=process.argv.slice(2);fs.appendFileSync(process.env.DEPLOY_TEST_LOG,JSON.stringify({command,args})+'\\n');
if(command==='git'){if(args[0]==='rev-parse')console.log('abc123abc123');else if(process.env.DEPLOY_TEST_DIRTY)console.log(' M changed.ts')}
if(command==='docker'){if(args[0]==='push')console.log('digest: ${digest}');if(args[0]==='compose'&&process.env.DEPLOY_TEST_FAIL&&!fs.existsSync(process.env.DEPLOY_TEST_FAIL)){fs.writeFileSync(process.env.DEPLOY_TEST_FAIL,'failed once');process.exit(1)}}
if(command==='ssh'&&args.includes('python3')){let source=fs.readFileSync(0,'utf8');source=source.replaceAll('http://127.0.0.1:8791/healthz',process.env.DEPLOY_ORIGIN+'/healthz').replace('range(30)','range(2)').replace('time.sleep(1)','time.sleep(.01)');const result=cp.spawnSync('python3',['-'],{input:source,stdio:['pipe','inherit','inherit'],env:process.env});process.exit(result.status)}
`;
for (const name of ["npm", "git", "docker", "ssh"])
  await writeFile(directory + "/bin/" + name, shim, { mode: 0o755 });
const run = async (mode) => {
  const stack = directory + "/" + mode;
  await mkdir(stack + "/data/opravovna", { recursive: true });
  const db = spawnSync("python3", [
    "-c",
    "import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); db.execute('create table demo(value)'); db.execute('insert into demo values(1)'); db.commit()",
    stack + "/data/opravovna/state.sqlite",
  ]);
  assert.equal(db.status, 0);
  await writeFile(
    stack + "/data/opravovna/example.pdf",
    "%PDF-synthetic-backup",
  );
  if (mode === "missing-blob") {
    const setup = spawnSync("python3", [
      "-c",
      "import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); db.execute('create table _mf_objects(key,blob_id,size)'); db.execute(\"insert into _mf_objects values('pdf','missing-blob',3)\"); db.commit()",
      stack + "/data/opravovna/state.sqlite",
    ]);
    assert.equal(setup.status, 0);
  }
  const initial = `services:\n  opravovna:\n    image: ${old}\n`;
  await writeFile(stack + "/personal-project.compose.yml", initial);
  const env = {
    ...process.env,
    PATH: directory + "/bin:" + process.env.PATH,
    DEPLOY_STACK: stack,
    DEPLOY_BACKUP_ROOT: stack + "/backups/opravovna",
    DEPLOY_ENV_FILE: directory + "/missing.env",
    DEPLOY_ORIGIN: mode === "health-fail" ? origin + "/health-fail" : origin,
    DEPLOY_TEST_LOG: stack + "/commands.jsonl",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic",
    ...(mode === "rollback" ? { DEPLOY_TEST_FAIL: stack + "/fail-once" } : {}),
    ...(mode === "dirty" ? { DEPLOY_TEST_DIRTY: "1" } : {}),
  };
  delete env.CLERK_TEST_SESSION_ID;
  const child = spawn(process.execPath, ["scripts/deploy.mjs"], { env });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  const status = await new Promise((r) => child.once("exit", r));
  if (mode === "success") assert.equal(status, 0, output);
  const compose = await readFile(
      stack + "/personal-project.compose.yml",
      "utf8",
    ),
    commands = (await readFile(stack + "/commands.jsonl", "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
  if (mode === "success") {
    assert.equal(status, 0, output);
    assert(compose.includes(digest));
    assert.equal(commands.filter((c) => c.command === "npm").length, 6);
    assert.equal((await readdir(stack + "/backups/opravovna")).length, 1);
    assert(
      (await readdir(stack + "/backups/opravovna", { recursive: true })).some(
        (file) => file.endsWith("state.sqlite"),
      ),
      "Consistent SQLite backup missing",
    );
    const backup = (await readdir(stack + "/backups/opravovna"))[0];
    const state = stack + "/backups/opravovna/" + backup + "/state";
    assert.equal(
      await readFile(state + "/example.pdf", "utf8"),
      "%PDF-synthetic-backup",
    );
    const manifest = JSON.parse(
      await readFile(state + "/manifest.json", "utf8"),
    );
    assert.match(manifest["example.pdf"].sha256, /^[a-f0-9]{64}$/);
    assert(manifest["state.sqlite"]);
  }
  if (mode === "rollback" || mode === "health-fail") {
    assert.notEqual(status, 0);
    assert.equal(compose, initial);
    assert.equal(
      commands.filter((c) => c.command === "docker" && c.args[0] === "compose")
        .length,
      2,
      "Failed startup must restore and restart previous image",
    );
  }
  if (mode === "missing-blob") {
    assert.notEqual(status, 0);
    assert.equal(compose, initial);
    assert(
      !commands.some((c) => c.command === "docker" && c.args[0] === "compose"),
      "Incomplete backup must abort before restarting the app",
    );
  }
  if (mode === "dirty") {
    assert.notEqual(status, 0);
    assert.equal(compose, initial);
    assert(
      !commands.some((c) => c.command === "docker"),
      "Uncommitted changes must fail before build",
    );
  }
};
try {
  await run("success");
  await run("rollback");
  await run("health-fail");
  await run("dirty");
  await run("missing-blob");
  console.log(
    "PASS: one-command deployment checks, digest pinning, backups, health checks, startup rollback and dirty-tree rejection with isolated command shims",
  );
} finally {
  server.close();
}
