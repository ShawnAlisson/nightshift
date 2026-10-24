import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/models/user";
import { getSessionUserId } from "@/lib/session";

/** Returns the signed-in user id, or redirects to /login. */
export async function requireUserId() {
  const userId = await getSessionUserId();
  if (!userId || !isValidObjectId(userId)) redirect("/login");
  return userId;
}

export type CurrentUser = { id: string; email: string };

/** Resolves the signed-in user from the session cookie, or redirects to /login. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const userId = await requireUserId();

  await connectDB();
  const user = await User.findById(userId).select("email").lean();
  if (!user) redirect("/login");

  return { id: user._id.toString(), email: user.email };
});
