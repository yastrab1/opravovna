import { clerkClient } from "@clerk/nextjs/server";
import type { ApiContext } from "./http";
export async function projectCollaborators({ DB, project, u }: ApiContext) {
  const members = (
    await DB.prepare(
      "SELECT email FROM members WHERE project=? AND role='editor' ORDER BY email",
    )
      .bind(project.id)
      .all<{ email: string }>()
  ).results;
  const client = await clerkClient();
  const profiles: any[] = [];
  for (let i = 0; i < members.length; i += 100)
    profiles.push(
      ...(
        await client.users.getUserList({
          emailAddress: members.slice(i, i + 100).map((m) => m.email),
          limit: 100,
        })
      ).data,
    );
  return [
    {
      email: u.email,
      name: u.displayName || u.email,
      firstName:
        "firstName" in u
          ? (u.firstName ?? null)
          : (u.displayName || "").split(/\s+/)[0] || null,
    },
    ...members
      .filter((m) => m.email !== u.email)
      .map((m) => {
        const profile = profiles.find((p) =>
          p.emailAddresses.some(
            (e: any) =>
              e.id === p.primaryEmailAddressId &&
              e.emailAddress.toLowerCase() === m.email &&
              e.verification?.status === "verified",
          ),
        );
        return {
          email: m.email,
          name: profile?.fullName || m.email,
          firstName: profile?.firstName?.trim().split(/\s+/)[0] || null,
        };
      }),
  ];
}
