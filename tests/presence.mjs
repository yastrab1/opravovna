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
  await req(owner, `${base}/${second}`, "PUT");
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
    "PASS: trusted viewer profiles, member-only presence, read-only participation, tab deduplication, project isolation, scoped leave, expiry and revocation",
  );
} finally {
  await mf.dispose();
}
