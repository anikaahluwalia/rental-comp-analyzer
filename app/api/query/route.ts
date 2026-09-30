import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/features/auth";
import { getResearchContext } from "@/features/listings";
import { runResearchAgent } from "@/features/research-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/query  { "q": "cheapest 1-bed" }
 *
 * Uses bounded server-side Claude tool use, with a deterministic fallback.
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
  if (typeof q !== "string" || !q.trim() || q.length > 2000) {
    return NextResponse.json(
      { error: "`q` must be a non-empty string of at most 2000 characters." },
      { status: 400 },
    );
  }

  const answer = await runResearchAgent(q, getResearchContext());
  return NextResponse.json({ ok: true, answer });
}
