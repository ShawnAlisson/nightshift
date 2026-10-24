import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** True when only people holding the invite code may register. Read per request, not at build. */
export function isInviteOnly() {
  return process.env.SIGNUP_INVITE_ONLY === "true";
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time comparison. Fails closed when invite-only mode has no code configured. */
export function isInviteCodeValid(code: string) {
  const expected = process.env.SIGNUP_INVITE_CODE;
  if (!expected) return false;
  return timingSafeEqual(digest(code), digest(expected));
}
