import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/features/auth";
import { createUser, ensureSeedUsers } from "@/features/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/signup
 *
 * Creates a new account with a scrypt-hashed password. Every public
 * signup starts as a read-only 'viewer'. Admin and analyst roles are
 * invite-only — promoted manually via the seed script (out of scope for
 * the demo).
 *
 * On success, signs the user in immediately.
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

  const { email, password, confirmPassword } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
    confirmPassword?: unknown;
  };

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  if (
    typeof confirmPassword === "string" &&
    confirmPassword !== password
  ) {
    return NextResponse.json(
      { error: "Passwords don't match." },
      { status: 400 },
    );
  }

  await ensureSeedUsers();

  const result = await createUser({ email, password });
  if (!result.ok) {
    if (result.error === "email_taken") {
      return NextResponse.json(
        {
          error:
            "An account with that email already exists. Try signing in instead.",
        },
        { status: 409 },
      );
    }
    if (result.error === "invalid_email") {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  await setSession({ email: result.user.email, role: result.user.role });
  return NextResponse.json({ ok: true, role: result.user.role });
}
