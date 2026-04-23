import { NextResponse } from "next/server";
import { can, getSession } from "@/features/auth";
import { triggerScrape } from "@/features/listings";

/**
 * POST /api/scrape
 *
 * Runs the building-site scraper across every property in parallel via
 * `triggerScrape()` — each call pulls from the building's own official
 * marketing site. Stores whatever comes back, including an empty result
 * if every scrape failed — the UI shows that honestly rather than silently
 * substituting synthetic data. The per-building `runs` in the response
 * carry the reason each scrape returned empty (403, timeout, parser miss,
 * etc.) so the operator can diagnose.
 *
 * Role-gated via the `triggerScrape` action (analyst + admin only).
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session, "triggerScrape")) {
    return NextResponse.json(
      {
        error:
          "Your role doesn't allow triggering scrapes. Analyst access required.",
      },
      { status: 403 },
    );
  }

  const result = await triggerScrape();
  return NextResponse.json({ ok: true, ...result });
}
