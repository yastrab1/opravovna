import assert from "node:assert/strict";
import { createApiFixture } from "./support/api-fixture.mjs";
const { mf, DB, req } = await createApiFixture();
try {
  const owner = {
    userId: "owner",
    email: "owner@example.sk",
    displayName: "Anna Reviewer",
    imageUrl: "https://img.clerk.com/anna.png",
  };
  const viewer = {
    userId: "viewer",
    email: "viewer@example.sk",
    displayName: "Boris Reviewer",
    imageUrl: "https://img.clerk.com/boris.png",
  };
  const stranger = { userId: "stranger", email: "stranger@example.sk" };
  const project = (
    await req(owner, "projects", "POST", { title: "Presence test" })
  ).data.id;
  const other = (
    await req(owner, "projects", "POST", { title: "Other project" })
  ).data.id;
  const base = `projects/${project}/presence`,
    otherBase = `projects/${other}/presence`;
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  await req(owner, `projects/${project}/members`, "POST", {
    email: viewer.email,
    role: "viewer",
  });
  assert.equal((await req(null, base)).status, 401);
  assert.equal((await req(stranger, `${base}/${first}`, "PUT")).status, 403);
  assert.equal((await req(owner, `${base}/invalid`, "PUT")).status, 400);
  let result = await req(owner, `${base}/${first}`, "PUT", {
    name: "Forged identity",
    image: "javascript:evil()",
  });
  assert.equal(result.status, 200);
  assert.equal(result.data[0].name, owner.displayName);
  assert.equal(result.data[0].image, owner.imageUrl);
  const docA = crypto.randomUUID(),
    docB = crypto.randomUUID(),
    foreignDoc = crypto.randomUUID();
  for (const [id, pid] of [
    [docA, project],
    [docB, project],
    [foreignDoc, other],
  ])
    await DB.prepare(
      "INSERT INTO documents(id,project,path,metadata,original,updated) VALUES(?,?,?,?,?,?)",
    )
      .bind(id, pid, id + ".pdf", "{}", "test.pdf", Date.now())
      .run();
  await req(owner, `${base}/${first}`, "PUT", {
    documentId: docA,
    active: true,
  });
  await DB.prepare("UPDATE project_presence SET activity=? WHERE session=?")
    .bind(Date.now() - 2000, first)
    .run();
  await req(owner, `${base}/${second}`, "PUT", {
    documentId: docB,
    active: false,
  });
  assert.equal(
    (await req(owner, base)).data[0].documentId,
    docA,
    "A background heartbeat cannot steal the focused tab's location",
  );
  await req(owner, `${base}/${first}`, "PUT", {
    documentId: docB,
    active: true,
  });
  assert.equal(
    (await req(owner, base)).data[0].documentId,
    docB,
    "Switching the focused solution updates the follow target",
  );
  assert.equal(
    (await req(owner, `${base}/${first}`, "PUT", { documentId: foreignDoc }))
      .status,
    404,
    "Cross-project locations are rejected",
  );
  assert.equal(
    (await req(owner, `${base}/${first}`, "PUT", { documentId: 123 })).status,
    400,
  );
  assert.equal(
    (
      await req(owner, `${base}/${first}`, "PUT", {
        documentId: null,
        padding: "x".repeat(600),
      })
    ).status,
    413,
  );
  assert.equal(
    (await req(owner, base)).data[0].documentId,
    docB,
    "Invalid announcements preserve the current target",
  );
  await DB.prepare("DELETE FROM documents WHERE id=?").bind(docB).run();
  assert.equal(
    (await req(owner, base)).data[0].documentId,
    null,
    "Deleted solutions cannot remain follow targets",
  );
  assert.equal(
    (await req(viewer, base)).data.length,
    1,
    "Two tabs represent one person",
  );
  result = await req(viewer, `${base}/${first}`, "PUT");
  assert.equal(result.status, 200, "Read-only members can announce presence");
  assert.equal(result.data.length, 2);
  assert.equal(
    (await req(viewer, `projects/${project}`, "PATCH", { title: "Forbidden" }))
      .status,
    403,
  );
  assert.deepEqual(
    (await req(owner, otherBase)).data,
    [],
    "Presence is project scoped",
  );
  await req(owner, `${base}/${first}`, "DELETE");
  assert.equal(
    (await req(owner, base)).data.length,
    2,
    "Leaving one tab keeps the second tab active",
  );
  await req(owner, `${base}/${second}`, "DELETE");
  result = await req(viewer, base);
  assert.deepEqual(
    result.data.map((person) => person.userId),
    [viewer.userId],
    "Cannot delete another user's same session ID",
  );
  await req(owner, `${base}/${second}`, "PUT");
  await DB.prepare("UPDATE project_presence SET updated=? WHERE user=?")
    .bind(Date.now() - 60_000, owner.userId)
    .run();
  assert.deepEqual(
    (await req(viewer, base)).data.map((person) => person.userId),
    [viewer.userId],
    "Abandoned sessions expire",
  );
  await req(viewer, `${base}/${first}`, "PUT");
  assert.equal(
    (
      await DB.prepare(
        "SELECT COUNT(*) AS count FROM project_presence WHERE user=?",
      )
        .bind(owner.userId)
        .first()
    ).count,
    0,
    "Expired rows cleaned on heartbeat",
  );
  await DB.prepare("DELETE FROM members WHERE project=? AND email=?")
    .bind(project, viewer.email)
    .run();
  assert.deepEqual(
    (await req(owner, base)).data,
    [],
    "Revoked users disappear immediately",
  );
  assert.equal((await req(viewer, base)).status, 403);
  console.log(
    "PASS: trusted viewer profiles, member-only presence, read-only participation, tab deduplication, project isolation, scoped leave, expiry, revocation and validated focused-solution targets",
  );
} finally {
  await mf.dispose();
}
