import assert from "node:assert/strict";
import { createApiFixture } from "./support/api-fixture.mjs";
const { mf, DB, req } = await createApiFixture();
const owner = {
    userId: "owner",
    email: "owner@example.sk",
    displayName: "Owner Person",
  },
  editor = { userId: "anna", email: "anna@example.sk" },
  viewer = { userId: "viewer", email: "viewer@example.sk" };
globalThis.__testClerkClient = {
  users: {
    getUserList: async () => ({
      data: ["anna", "boris"].map((name) => ({
        id: name,
        firstName: name === "anna" ? "Anna" : "Boris",
        fullName: name + " Reviewer",
        primaryEmailAddressId: name,
        emailAddresses: [
          {
            id: name,
            emailAddress: name + "@example.sk",
            verification: { status: "verified" },
          },
        ],
      })),
    }),
  },
};
try {
  const pid = (await req(owner, "projects", "POST", { title: "Assignments" }))
      .data.id,
    base = `projects/${pid}`;
  for (const [email, role] of [
    [editor.email, "editor"],
    ["boris@example.sk", "editor"],
    [viewer.email, "viewer"],
  ])
    await req(owner, base + "/members", "POST", { email, role });
  const legacy = {
    tags: [
      "keep",
      { id: "uf-id", name: "uf", color: "cyan" },
      "unused",
      "assigned:Old",
    ],
    changes: {
      1: {
        tags: ["uf-id", "assigned:Old", "keep"],
        comment: "keep legacy comment",
      },
    },
  };
  await DB.prepare("UPDATE projects SET legacy=? WHERE id=?")
    .bind(JSON.stringify(legacy), pid)
    .run();
  for (let i = 0; i < 9; i++) {
    const state = {
      changes: [
        { page: 0, type: "Text", data: { text: "Keep annotation " + i } },
      ],
      tags: [
        "keep",
        { name: "colored", color: "red" },
        "assigned:Old",
        ...(i < 2 ? [i === 0 ? "uf-id" : { name: "uf", id: "uf-id" }] : []),
      ],
      scoring: i === 5 ? { points: 0 } : i === 6 ? { points: 4.67 } : {},
      extraPages: 0,
    };
    await DB.prepare(
      "INSERT INTO documents(id,project,path,metadata,original,state,updated) VALUES(?,?,?,?,?,?,?)",
    )
      .bind(
        "d" + i,
        pid,
        "file" + i + ".pdf",
        JSON.stringify({
          name: "Reviewer " + i,
          rocnik: i < 7 ? "5" : "k",
          submissionId: String(i),
        }),
        "key" + i,
        JSON.stringify(state),
        1,
      )
      .run();
  }
  assert.equal(
    (
      await req(viewer, base + "/tags", "DELETE", {
        name: "uf",
        confirmed: true,
      })
    ).status,
    403,
  );
  assert.equal((await req(editor, base + "/assignments")).status, 403);
  const roster = await req(owner, base + "/assignments");
  assert.equal(roster.status, 200);
  assert.equal(roster.data.length, 3);
  let r = await req(editor, base + "/tags", "DELETE", { name: "uf" });
  assert.equal(r.data.confirmationRequired, true);
  assert.equal(r.data.count, 2);
  let project = (await req(owner, base)).data;
  assert.equal(project.documents[0].revision, 0);
  r = await req(editor, base + "/tags", "DELETE", {
    name: "uf",
    confirmed: true,
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  project = (await req(owner, base)).data;
  assert(
    project.documents.every(
      (d) => !d.state.tags.some((t) => t === "uf-id" || t?.name === "uf"),
    ),
  );
  assert.deepEqual(project.documents[0].state.tags[1], {
    name: "colored",
    color: "red",
  });
  assert.deepEqual(project.legacy.changes[1].tags, ["assigned:Old", "keep"]);
  assert.equal(project.legacy.changes[1].comment, "keep legacy comment");
  assert.equal(project.documents[0].revision, 1);
  assert.equal(project.documents[2].revision, 0);
  assert.equal(
    (
      await req(editor, base + "/documents/d0", "PATCH", {
        revision: 0,
        state: project.documents[0].state,
      })
    ).status,
    409,
  );
  r = await req(editor, base + "/tags", "DELETE", { name: "unused" });
  assert.equal(r.data.ok, true);
  assert(!r.data.confirmationRequired);
  assert.equal(
    (
      await req(owner, base + "/assignments", "POST", {
        assignments: { 5: [viewer.email] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req(owner, base + "/assignments", "POST", {
        assignments: { unknown: [editor.email] },
      })
    ).status,
    400,
  );
  r = await req(owner, base + "/assignments", "POST", {
    assignments: {
      5: [editor.email, "boris@example.sk"],
      k: ["boris@example.sk"],
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r));
  project = (await req(owner, base)).data;
  const assigned = (d) =>
    d.state.tags.filter(
      (t) => typeof t === "string" && t.startsWith("assigned:"),
    );
  const ungraded = project.documents.filter(
    (d) => d.metadata.rocnik === "5" && d.state.scoring.points == null,
  );
  assert.equal(
    ungraded.filter((d) => assigned(d)[0] === "assigned:Anna").length,
    3,
  );
  assert.equal(
    ungraded.filter((d) => assigned(d)[0] === "assigned:Boris").length,
    2,
  );
  assert(
    project.documents
      .filter((d) => d.state.scoring.points != null)
      .every((d) => assigned(d).length === 0),
    "Zero/fractional grades must not get assignments",
  );
  assert(
    project.documents.every((d) =>
      d.state.changes[0].data.text.startsWith("Keep annotation"),
    ),
  );
  assert(!project.legacy.tags.includes("assigned:Old"));
  assert(!("_assignmentOperation" in project.legacy));
  r = await req(owner, base + "/assignments", "POST", {
    assignments: { 5: ["boris@example.sk"] },
  });
  assert.equal(r.status, 200);
  project = (await req(owner, base)).data;
  assert(
    project.documents
      .filter(
        (d) => d.metadata.rocnik === "5" && d.state.scoring.points == null,
      )
      .every((d) => assigned(d)[0] === "assigned:Boris"),
  );
  assert(
    project.documents
      .filter((d) => d.metadata.rocnik === "k")
      .every((d) => assigned(d).length === 0),
  );
  const before = JSON.stringify(project.legacy);
  let intercepted = false;
  globalThis.__testEnv.DB = {
    prepare: DB.prepare.bind(DB),
    batch: async (statements) => {
      if (!intercepted) {
        intercepted = true;
        await DB.prepare(
          "UPDATE documents SET revision=revision+1,state=json_set(state,'$.scoring.points',9) WHERE id='d0'",
        ).run();
      }
      return DB.batch(statements);
    },
  };
  r = await req(owner, base + "/assignments", "POST", {
    assignments: { 5: [editor.email] },
  });
  assert.equal(r.status, 409, JSON.stringify(r));
  globalThis.__testEnv.DB = DB;
  project = (await req(owner, base)).data;
  assert.equal(
    JSON.stringify(project.legacy),
    before,
    "Stale assignment must not partially write catalog",
  );
  assert(
    project.documents.every((d) => !assigned(d).includes("assigned:Anna")),
    "Stale assignment must not partially write document tags",
  );
  await req(owner, base + "/assignments", "POST", { assignments: {} });
  project = (await req(owner, base)).data;
  assert(project.documents.every((d) => assigned(d).length === 0));
  let raced = false;
  globalThis.__testEnv.DB = {
    prepare: DB.prepare.bind(DB),
    batch: async (statements) => {
      if (!raced) {
        raced = true;
        await DB.prepare(
          "UPDATE documents SET state=json_set(state,'$.tags',json_insert(json_extract(state,'$.tags'),'$[#]','late')),revision=revision+1 WHERE id='d2'",
        ).run();
      }
      return DB.batch(statements);
    },
  };
  r = await req(owner, base + "/tags", "DELETE", { name: "late" });
  assert.equal(
    r.data.confirmationRequired,
    true,
    "A tag assigned after the initial count still requires confirmation",
  );
  assert.equal(r.data.count, 1);
  globalThis.__testEnv.DB = DB;
  project = (await req(owner, base)).data;
  assert(
    project.documents.find((d) => d.id === "d2").state.tags.includes("late"),
  );
  console.log(
    "PASS: confirmed project-wide deletion, Arnold ID mapping, tag metadata, permissions, balanced ungraded assignment, reassignment, zero/decimal grades, atomic stale-write rejection and revision protection",
  );
} finally {
  globalThis.__testEnv.DB = DB;
  delete globalThis.__testClerkClient;
  await mf.dispose();
}
