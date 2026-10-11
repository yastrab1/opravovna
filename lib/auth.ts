import { auth, currentUser } from "@clerk/nextjs/server";
export async function getUser() {
  const session = await auth();
  if (!session.userId) return null;
  const user = await currentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress;
  if (!email || email.verification?.status !== "verified")
    throw Object.assign(
      new Error("Overte svoju e-mailovú adresu v účte Clerk."),
      { status: 403 },
    );
  return {
    userId: session.userId,
    email: email.emailAddress,
    firstName: user.firstName?.trim().split(/\s+/)[0] || null,
    displayName: user.fullName || user.username || email.emailAddress,
    imageUrl: user.imageUrl,
  };
}
