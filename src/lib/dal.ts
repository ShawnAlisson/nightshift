import "server-only";
import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getSessionUserId } from "@/lib/session";

/** Returns the signed-in user id, or redirects to /login. */
export async function requireUserId() {
  const userId = await getSessionUserId();
  if (!userId || !isValidObjectId(userId)) redirect("/login");
  return userId;
}
