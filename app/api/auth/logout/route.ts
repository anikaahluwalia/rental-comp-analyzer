import { NextResponse } from "next/server";
import { clearSession } from "@/features/auth";

/**
 * Signs the user out.
 *
 * Clears the "you're signed in" marker from their browser and returns
 * a success response. Always reports success — even if someone somehow
 * hits this when they weren't signed in, we treat it the same way, so
 * the end result is always "you're now signed out".
 */
export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
