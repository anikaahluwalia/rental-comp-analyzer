import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/features/auth";
import { getListings } from "@/features/listings";
import { runQuery } from "@/features/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/query  { "q": "cheapest 1-bed" }
 *
 * Routes natural-language questions through the deterministic parser.
 * Designed to be a drop-in for a future Claude-backed tool-use
 * implementation — same request/response shape.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const q = (body as { q?: unknown })?.q;
  if (typeof q !== "string") {
    return NextResponse.json(
      { error: "`q` must be a string." },
      { status: 400 },
    );
  }

  const listings = getListings();
  const answer = runQuery(q, listings);
  return NextResponse.json({ ok: true, answer });
}
