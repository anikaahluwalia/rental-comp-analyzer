import { cookies } from "next/headers";
import {
  ROLE_CAN,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type Role,
  type Session,
} from "./session-config";

/**
 * Manages who is currently signed in.
 *
 * When someone successfully logs in, this file saves a small "you're
 * signed in as X" marker in their browser. Every page and API request
 * then reads that marker to know who the user is and what they're
 * allowed to do.
 *
 * It exposes three actions:
 *   - getSession() — reads the marker (returns null if nobody's signed in)
 *   - setSession() — writes the marker (called after a successful login)
 *   - clearSession() — deletes the marker (called on sign-out)
 *
 * Plus a `can()` helper that checks whether the current user is
 * allowed to perform a specific action like "trigger a scrape" or
 * "export a PDF". The permission rules themselves live in
 * ./session-config.ts.
 *
 * Honest note on the limitation: the marker is encoded but not
 * cryptographically signed, so a technically savvy user could edit
 * their own cookie to change their role. For production we'd swap in a
 * hosted auth service (Clerk, Auth.js, etc.) — the three functions
 * above are designed so that swap only touches this one file.
 */

export {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  ROLE_CAN,
  type Role,
  type Session,
};

/**
 * Check whether the current session can perform an action. Intended for
 * use in server components / route handlers.
 *
 *   const session = await getSession();
 *   if (!session || !can(session, 'triggerScrape')) return forbidden();
 */
export function can(
  session: Session | null,
  action: keyof (typeof ROLE_CAN)["admin"],
): boolean {
  if (!session) return false;
  return ROLE_CAN[session.role]?.[action] ?? false;
}

/** Read the current session on the server. Returns null if signed out. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf-8"),
    ) as Partial<Session>;
    if (!parsed?.email) return null;
    const role: Role =
      parsed.role && parsed.role in ROLE_CAN ? parsed.role : "viewer";
    return { email: parsed.email, role };
  } catch {
    return null;
  }
}

/** Write a session cookie. Call from a route handler / server action. */
export async function setSession(session: Session): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(session), "utf-8").toString(
    "base64url",
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clear the session cookie. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
