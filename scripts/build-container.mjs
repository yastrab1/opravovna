import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  throw new Error("Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY before building.");
const tags = process.argv.slice(2);
if (!tags.length) throw new Error("Supply at least one image tag.");
const builder = process.env.CONTAINER_BUILDER || "opravovna-r2d2";
const endpoint = process.env.CONTAINER_BUILD_HOST || "ssh://r2d2@r2d2";
if (!/^[\w.-]+$/.test(builder) || !/^ssh:\/\/[\w.@-]+$/.test(endpoint))
  throw new Error("Invalid SSH builder configuration.");
const run = (args) => {
  const result = spawnSync("docker", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Docker buildx failed (${result.status}).`);
};
if (
  spawnSync("docker", ["buildx", "inspect", builder], { stdio: "ignore" })
    .status !== 0
)
  run([
    "buildx",
    "create",
    "--name",
    builder,
    "--driver",
    "docker-container",
    endpoint,
  ]);
const temporary =
  !process.env.CONTAINER_METADATA_FILE &&
  mkdtempSync(join(tmpdir(), "opravovna-build-"));
const metadata =
  process.env.CONTAINER_METADATA_FILE || join(temporary, "metadata.json");
try {
  run([
    "buildx",
    "build",
    "--builder",
    builder,
    "--platform",
    "linux/amd64",
    "--push",
    "--metadata-file",
    metadata,
    "--build-arg",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ...tags.flatMap((tag) => ["-t", tag]),
    ".",
  ]);
  const digest = JSON.parse(readFileSync(metadata, "utf8"))[
    "containerimage.digest"
  ];
  if (!/^sha256:[a-f0-9]{64}$/.test(digest))
    throw new Error("Buildx did not return an image digest.");
  console.log(`Published image digest: ${digest}`);
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
