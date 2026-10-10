import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { createApiFixture } from "./support/api-fixture.mjs";
const { mf, DB, BUCKET, req } = await createApiFixture();
try {
  const owner = { userId: "owner", email: "owner@test.sk" };
  const outsider = { userId: "outside", email: "outside@test.sk" };
  const project = (
    await req(owner, "projects", "POST", { title: "Merge test" })
  ).data.id;
  const root = `projects/${project}`;
  const input = await PDFDocument.create();
  input.addPage([200, 300]);
  const original = await input.save();
  const id = (
    await req(owner, root + "/documents", "POST", original, {
      "x-file-path": "p4-c8-test-person-123.pdf",
    })
  ).data.id;
  input.addPage([300, 400]);
  const replacement = await input.save();
  const state = {
    changes: [],
    tags: ["importovaný"],
    scoring: { points: 9.75 },
    rotations: {},
    extraPages: 0,
  };
  const operation = crypto.randomUUID();
  function form(
    revision = 0,
    next = state,
    bytes = replacement,
    token = operation,
  ) {
    const body = new FormData();
    body.set(
      "pdf",
      new Blob([bytes], { type: "application/pdf" }),
      "solution.pdf",
    );
    body.set("state", JSON.stringify(next));
    body.set("revision", String(revision));
    body.set("operation", token);
    return body;
  }
  const url = `${root}/documents/${id}/version`;
  assert.equal((await req(outsider, url, "PUT", form())).status, 403);
  assert.equal((await req(owner, url, "PUT", form())).status, 200);
  let doc = await DB.prepare("SELECT * FROM documents WHERE id=?")
    .bind(id)
    .first();
  assert.equal(doc.revision, 1);
  assert.equal(JSON.parse(doc.state).scoring.points, 9.75);
  assert.deepEqual(
    new Uint8Array(await (await BUCKET.get(doc.original)).arrayBuffer()),
    replacement,
  );
  assert((await req(owner, root)).data.legacy.tags.includes("importovaný"));
  const storedKey = doc.original;
  assert.equal(
    (
      await req(
        owner,
        url,
        "PUT",
        form(0, { ...state, scoring: { points: 8 } }),
      )
    ).status,
    409,
    "Reused operation cannot overwrite the selected PDF",
  );
  assert.deepEqual(
    new Uint8Array(await (await BUCKET.get(storedKey)).arrayBuffer()),
    replacement,
  );
  assert.equal(
    (await req(owner, url, "PUT", form())).status,
    200,
    "Lost response retries are idempotent",
  );
  assert.equal(
    (
      await req(
        owner,
        url,
        "PUT",
        form(0, state, original, crypto.randomUUID()),
      )
    ).status,
    409,
    "Stale choice cannot replace PDF",
  );
  doc = await DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first();
  assert.equal(doc.original, storedKey);
  assert.equal(doc.revision, 1);
  assert.equal(
    (
      await req(
        owner,
        url,
        "PUT",
        form(1, { ...state, scoring: { points: -1 } }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        owner,
        url,
        "PUT",
        form(1, state, new TextEncoder().encode("not PDF")),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        owner,
        url,
        "PUT",
        form(1, state, original, crypto.randomUUID()),
      )
    ).status,
    200,
  );
  doc = await DB.prepare("SELECT * FROM documents WHERE id=?").bind(id).first();
  assert.equal(doc.revision, 2);
  assert.deepEqual(
    new Uint8Array(await (await BUCKET.get(doc.original)).arrayBuffer()),
    original,
  );
  console.log(
    "PASS: selected PDF and state replace atomically; stale choices, permission checks, invalid input and lost-response replay",
  );
} finally {
  await mf.dispose();
}
