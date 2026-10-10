import assert from "node:assert/strict";
import { createApiFixture } from "./support/api-fixture.mjs";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { pack, unpack } from "msgpackr";
const { mf, DB, BUCKET, req } = await createApiFixture();
try {
  const owner = { userId: "owner", email: "owner@example.sk" },
    editor = { userId: "editor", email: "editor@example.sk" },
    viewer = { userId: "viewer", email: "viewer@example.sk" },
    outsider = { userId: "outsider", email: "outside@example.sk" };
  assert.equal((await req(null, "projects")).status, 401);
  let r = await req(owner, "projects", "POST", {
    title: "4. Kto druhemu jamu kope sam do nej spadne",
  });
  assert.equal(r.status, 200);
  const pid = r.data.id,
    base = "projects/" + pid;
  assert.equal((await req(outsider, base)).status, 403);
  assert.equal((await req(owner, "projects")).data.length, 1);
  const input = new JSZip();
  const name = "4-priklad/p4-c8-test-reviewer-41803.pdf";
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  input.file(name, bytes);
  const legacy = {
    tags: ["skontrolovať"],
    scoringCriteria: [],
    changes: {
      41803: {
        changes: [],
        tags: [],
        scoring: { points: 4.75, final: true, acceptedCriteria: [] },
        opened: true,
        timeOpened: 123,
      },
    },
  };
  assert.equal(
    (await req(owner, base + "/legacy", "PUT", pack(legacy))).status,
    200,
  );
  r = await req(owner, base + "/documents", "POST", bytes, {
    "x-file-path": encodeURIComponent(name),
  });
  assert.equal(r.status, 200);
  const did = r.data.id;
  r = await req(owner, base);
  assert.equal(r.data.documents[0].metadata.name, "Test Reviewer");
  assert.equal(r.data.documents[0].metadata.rocnik, "8");
  assert.equal(r.data.documents[0].state.scoring.points, 4.75);
  const state = { ...r.data.documents[0].state, tags: ["skontrolovať"] };
  assert.equal(
    (
      await req(owner, base + "/documents/" + did, "PATCH", {
        state,
        revision: 0,
      })
    ).status,
    200,
    "Imported fractional scores survive edits",
  );
  assert.equal(
    (
      await req(owner, base + "/documents/" + did, "PATCH", {
        state,
        revision: 0,
      })
    ).status,
    409,
    "Stale revisions must not overwrite",
  );
  assert.equal(
    (
      await req(owner, base + "/documents/" + did, "PATCH", {
        state: { ...state, scoring: { points: -1 } },
        revision: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req(owner, base + "/documents", "POST", bytes, {
        "x-file-path": encodeURIComponent("../bad.pdf"),
      })
    ).status,
    400,
  );
  for (const u of [editor, viewer])
    assert.equal(
      (
        await req(owner, base + "/members", "POST", {
          email: u.email,
          role: u === viewer ? "viewer" : "editor",
        })
      ).status,
      200,
    );
  assert.equal((await req(viewer, base)).status, 200);
  assert.equal(
    (
      await req(viewer, base + "/documents/" + did, "PATCH", {
        state,
        revision: 1,
      })
    ).status,
    403,
  );
  assert.equal((await req(editor, base + "/members")).status, 403);
  let exportRequest;
  globalThis.__testEnv.EXPORTER = {
    fetch: async (request) => {
      exportRequest = request;
      return Response.json({ id: "export-job", status: "queued" });
    },
  };
  assert.equal((await req(null, base + "/export", "POST", {})).status, 401);
  assert.equal((await req(outsider, base + "/export", "POST", {})).status, 403);
  assert.equal(
    (await req(viewer, base + "/export", "POST", {})).status,
    200,
    "Read-only members can export",
  );
  assert.equal(exportRequest.headers.get("x-export-owner"), viewer.userId);
  const exportSnapshot = await exportRequest.json();
  assert.equal(exportSnapshot.project.id, pid);
  assert.equal(exportSnapshot.documents[0].metadata.submissionId, "41803");
  assert.ok(exportSnapshot.documents[0].original);
  assert.equal(
    (await req(owner, base + "/export/export-job/download")).status,
    200,
  );
  assert.equal(
    new URL(exportRequest.url).pathname,
    "/jobs/export-job/download",
  );
  assert.equal(
    (
      await req(
        owner,
        base + "/export",
        "POST",
        {},
        { origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  delete globalThis.__testEnv.EXPORTER;
  assert.equal(
    (await req(owner, base + "/export", "POST", {})).status,
    501,
    "Unsupported hosts retain browser fallback",
  );
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...state, scoring: { points: 4.67 } },
        revision: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...state, scoring: {}, changes: [] },
        revision: 2,
      })
    ).status,
    200,
  );
  r = await req(owner, base);
  assert.equal(
    r.data.documents[0].state.scoring.points,
    undefined,
    "Removed grade stays removed after reload",
  );
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...state, extraPages: 1000000 },
        revision: 3,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...state, rotations: { 0: 35 } },
        revision: 3,
      })
    ).status,
    400,
  );
  assert.equal((await req(owner, "projects", "POST", "{")).status, 400);
  const cleared = r.data.documents[0].state,
    sharedTag = { name: "spoločne", color: "#cc4488" };
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...cleared, tags: [sharedTag] },
        revision: 3,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...cleared, tags: ["konflikt"] },
        revision: 3,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req(editor, base + "/documents/" + did, "PATCH", {
        state: { ...cleared, tags: [] },
        revision: 4,
      })
    ).status,
    200,
  );
  r = await req(viewer, base);
  assert.deepEqual(
    r.data.legacy.tags.find((t) => t.name === "spoločne"),
    sharedTag,
    "Project catalog preserves a tag after its last assignment is removed",
  );
  assert.ok(
    !r.data.legacy.tags.includes("konflikt"),
    "Stale saves do not alter shared tag catalog",
  );
  assert.equal(
    (
      await req(
        owner,
        base,
        "PATCH",
        { title: "Unsafe" },
        { origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  r = await req(owner, base + "/share", "POST", {});
  const token = r.data.token;
  assert.equal((await req(outsider, "join", "POST", { token })).status, 200);
  assert.equal((await req(outsider, base)).status, 200);
  await req(owner, base + "/share", "POST", { revoke: true });
  assert.equal(
    (
      await req({ userId: "new", email: "new@example.sk" }, "join", "POST", {
        token,
      })
    ).status,
    404,
  );
  r = await req(owner, base + "/members");
  const m = r.data.find((x) => x.email === viewer.email);
  await req(owner, base + "/members", "DELETE", { id: m.id });
  assert.equal((await req(viewer, base)).status, 403);
  const upload = (await req(owner, base + "/archive", "POST")).data.id;
  const tiny = new Uint8Array([80, 75, 3, 4]);
  assert.equal(
    (await req(outsider, base + "/uploads/" + upload + "?part=1", "PUT", tiny))
      .status,
    404,
  );
  assert.equal(
    (await req(owner, base + "/uploads/" + upload + "?part=1", "PUT", tiny))
      .status,
    200,
  );
  assert.equal(
    (await req(owner, base + "/uploads/" + upload, "POST", {})).status,
    200,
  );
  assert.deepEqual(
    new Uint8Array(
      await (
        await BUCKET.get(
          (
            await DB.prepare("SELECT archive FROM projects WHERE id=?")
              .bind(pid)
              .first()
          ).archive,
        )
      ).arrayBuffer(),
    ),
    tiny,
  );
  const latest = (await req(owner, base)).data.documents.find(
    (d) => d.id === did,
  );
  assert.equal(
    (
      await req(owner, base + "/documents/" + did, "PATCH", {
        state: { ...latest.state, scoring: { points: 12.675 } },
        revision: latest.revision,
      })
    ).status,
    200,
    "Decimal grades above five are accepted",
  );
  assert.equal(
    (await req(owner, base)).data.documents.find((d) => d.id === did).state
      .scoring.points,
    12.675,
  );
  assert.equal(
    (
      await req(owner, base + "/documents/" + did, "PATCH", {
        state: { ...latest.state, scoring: { points: -0.01 } },
        revision: latest.revision + 1,
      })
    ).status,
    400,
    "Negative grades are always rejected",
  );
  console.log(
    "PASS: auth boundary, project isolation, metadata, legacy scores, revision conflicts, role permissions, invite revocation, upload ownership, R2 multipart persistence",
  );
  const { exportName } = await import("../lib/archive.ts");
  assert.deepEqual(unpack(pack(legacy)), legacy);
  assert.equal(
    exportName("4. Kto druhému jamu kope sám do nej spadne"),
    "4. Kto druhemu jamu kope sam do nej spadne_opravene.zip",
  );
  console.log("PASS: lossless metadata and exact export filename");
} finally {
  await mf.dispose();
}
