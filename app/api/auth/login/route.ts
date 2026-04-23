import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/features/auth";
import { ensureSeedUsers, verifyUser } from "@/features/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/login
 *
 * Verifies email + password against the scrypt-hashed user store. On
 * success, sets an httpOnly session cookie with the user's role.
 *
 * Intentionally returns a single generic error for both "no such user"
 * and "wrong password" so attackers can't enumerate emails.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { email, password } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
  };

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 },
    );
  }

  // First boot only: make sure the demo accounts exist.
  await ensureSeedUsers();

  const user = await verifyUser(email, password);
  if (!user) {
    // Generic message — don't leak whether the email exists.
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  await setSession({ email: user.email, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
