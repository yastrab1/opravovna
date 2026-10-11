import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const run = (command, args, capture = false) => {
  const result = spawnSync(command, args, {
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || result.stdout || "");
    throw new Error(`${command} failed (${result.status ?? "not started"})`);
  }
  return result.stdout?.trim();
};
function checks() {
  for (const check of [
    "check",
    "lint",
    "format:check",
    "check:size",
    "test",
    "test:export",
  ])
    run("npm", ["run", check]);
}
if (process.argv.includes("--check")) {
  checks();
  process.exit(0);
}
const envFile = resolve(
  process.env.DEPLOY_ENV_FILE || ".sites-runtime/clerk-production.env",
);
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  throw new Error("Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or DEPLOY_ENV_FILE.");
if (run("git", ["status", "--porcelain"], true))
  throw new Error(
    "Commit changes before deploying so the image has a reproducible revision.",
  );
checks();
const revision = run("git", ["rev-parse", "--short=12", "HEAD"], true);
const host = process.env.DEPLOY_HOST || "r2d2@r2d2";
const stack = process.env.DEPLOY_STACK || "/home/r2d2/unified";
const image = process.env.DEPLOY_IMAGE || "ghcr.io/yastrab1/opravovna";
const origin = process.env.DEPLOY_ORIGIN || "https://opravovna.tech";
if (
  !/^[\w.@-]+$/.test(host) ||
  !/^\/[\w/.-]+$/.test(stack) ||
  !/^[\w./-]+$/.test(image)
)
  throw new Error("Invalid deployment host, stack or image.");
const tag = `${image}:${revision}`;
console.log(`Building ${tag}`);
run("node", ["scripts/build-container.mjs", tag]);
const pushed = run("docker", ["push", tag], true);
const digest = pushed.match(/digest: (sha256:[a-f0-9]{64})/)?.[1];
if (!digest) throw new Error("Registry did not return an image digest.");
const pinned = `${image}@${digest}`;
run("ssh", ["-o", "BatchMode=yes", host, "docker", "pull", pinned]);
const remote = `
import pathlib, re, shutil, sqlite3, subprocess, urllib.request, time, sys
stack=pathlib.Path(${JSON.stringify(stack)})
compose=stack/'personal-project.compose.yml'
original=compose.read_text()
pattern=r'(?m)^(    image: )'+re.escape(${JSON.stringify(image)})+r'@sha256:[a-f0-9]{64}$'
updated,count=re.subn(pattern,lambda m:m.group(1)+${JSON.stringify(pinned)},original)
if count!=1: raise RuntimeError('Expected exactly one pinned Opravovna service')
backup=stack/'backups'/'opravovna'/('deploy-${revision}-'+str(int(time.time())))
backup.mkdir(parents=True)
shutil.copy2(compose,backup/compose.name)
for source in (stack/'data'/'opravovna').rglob('*.sqlite'):
    relative=source.relative_to(stack/'data'/'opravovna')
    target=backup/'sqlite'/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
        if dst.execute('pragma integrity_check').fetchone()[0]!='ok': raise RuntimeError('Invalid database backup')
command=['docker','compose','-f','docker-compose.apps.yml','-f','docker-compose.config-api.yml','up','-d','--no-deps','opravovna']
def healthy():
    for attempt in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8791/healthz',timeout=3) as response:
                if response.status==200:return True
        except Exception:pass
        time.sleep(1)
    return False
compose.write_text(updated)
try:
    subprocess.run(command,cwd=stack,check=True)
    if not healthy():raise RuntimeError('New container failed health checks')
except Exception:
    compose.write_text(original)
    subprocess.run(command,cwd=stack,check=True)
    if not healthy():raise RuntimeError('Rollback also failed health checks')
    raise
print('Deployment healthy; rollback configuration and SQLite backups:',backup)
`;
const result = spawnSync("ssh", ["-o", "BatchMode=yes", host, "python3", "-"], {
  input: remote,
  encoding: "utf8",
  stdio: ["pipe", "inherit", "inherit"],
});
if (result.status !== 0)
  throw new Error("Remote deployment failed; see rollback result above.");
for (const [path, expected] of [
  ["/", 200],
  ["/healthz", 200],
  ["/api/projects", 401],
]) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(15000),
  });
  await response.body?.cancel();
  if (response.status !== expected)
    throw new Error(
      `Public check ${path}: expected ${expected}, got ${response.status}`,
    );
}
if (process.env.CLERK_TEST_SESSION_ID) {
  process.env.TEST_URL = origin;
  process.env.TEST_CREATE = "0";
  process.env.TEST_ASSIGNMENTS = "1";
  run("node", ["--dns-result-order=ipv4first", "tests/container-auth.mjs"]);
} else
  console.log(
    "Authenticated smoke skipped: set CLERK_TEST_SESSION_ID to enable it.",
  );
console.log(`Deployed ${revision} to ${origin}: ${pinned}`);
