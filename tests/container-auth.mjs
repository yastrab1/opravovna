// Optional integration check against a running container using a real Clerk
// session. Supply CLERK_SECRET_KEY, CLERK_TEST_SESSION_ID and TEST_URL via env.
// Project creation is restricted to an isolated localhost container.
import assert from "node:assert/strict";

const base = new URL(process.env.TEST_URL || "http://127.0.0.1:8792");
const origin = process.env.TEST_ORIGIN || "https://opravovna.tech";
const create = process.env.TEST_CREATE === "1";
if (create) assert(["127.0.0.1", "localhost"].includes(base.hostname));
assert(
  process.env.CLERK_SECRET_KEY && process.env.CLERK_TEST_SESSION_ID,
  "Clerk test credentials required",
);
const response = await fetch(
  `https://api.clerk.com/v1/sessions/${process.env.CLERK_TEST_SESSION_ID}/tokens`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  },
);
assert.equal(response.status, 200, "Issue test session token");
const { jwt } = await response.json();
assert(jwt);
const cookie = `__session=${jwt}; __client_uat=1`;
const identity = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url")).sub;
for (const [name, headers, expected] of [
  ["anonymous", {}, 401],
  ["invalid", { Cookie: "__session=invalid; __client_uat=1" }, 401],
  ["cookie", { Cookie: cookie }, 200],
  ["bearer", { Authorization: `Bearer ${jwt}` }, 200],
]) {
  const result = await fetch(new URL("/api/me", base), { headers });
  assert.equal(result.status, expected, `${name} authentication`);
  if (expected === 200) {
    const user = await result.json();
    assert.equal(user.userId, identity);
    assert(user.email);
  }
  console.log(`${name} authentication: ${result.status}`);
}
const result = await fetch(new URL("/api/projects", base), {
  method: "POST",
  headers: {
    Cookie: cookie,
    Origin: origin,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: create ? "Authentication regression test" : "",
  }),
});
assert.equal(
  result.status,
  create ? 200 : 400,
  "Authenticated project creation",
);
console.log(
  create
    ? "Test project created in isolated container"
    : "Authenticated project request reached validation",
);
if (process.env.TEST_ASSIGNMENTS === "1") {
  const headers = { Cookie: cookie };
  const list = await fetch(new URL("/api/projects", base), { headers });
  assert.equal(list.status, 200);
  const project = (await list.json()).find((p) => p.owner === identity);
  if (project) {
    const roster = await fetch(
      new URL(`/api/projects/${project.id}/assignments`, base),
      { headers },
    );
    assert.equal(roster.status, 200, "Live Clerk collaborator lookup");
    const people = await roster.json();
    assert(
      people.length > 0 &&
        people.every(
          (p) =>
            typeof p.email === "string" &&
            typeof p.name === "string" &&
            (p.firstName === null || typeof p.firstName === "string"),
        ),
    );
    console.log("Live collaborator lookup: 200");
  }
}
