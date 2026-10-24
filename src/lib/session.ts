import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

const COOKIE_NAME = "session";
const SESSION_DURATION_S = 60 * 60 * 24 * 7;

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in .env.local");
  }
  return new TextEncoder().encode(secret);
}

/** Returns the user id stored in a session token, or null if it is missing, invalid or expired. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getSessionUserId() {
  return verifySessionToken((await cookies()).get(COOKIE_NAME)?.value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(getKey());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_S,
  });
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export { COOKIE_NAME };
