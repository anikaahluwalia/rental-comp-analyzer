import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { can, getSession } from "@/features/auth";
import {
  summarizeAllUnitTypes,
  summarizeByBuilding,
} from "@/features/consolidation";
import { getLastScrapedAt, getListings } from "@/features/listings";
import { RentalCompReport } from "@/features/pdf-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/export-pdf
 *
 * Streams the branded Rental Comp report as a PDF download. Gated on the
 * `exportPdf` role capability — all roles have it today (viewers are
 * allowed to export for execs), but the policy is centralized so a future
 * "no export for viewers" decision is a one-line change.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session, "exportPdf")) {
    return NextResponse.json(
      { error: "Your role doesn't allow exporting reports." },
      { status: 403 },
    );
  }

  const listings = getListings();
  const lastScrapedAt = getLastScrapedAt();

  // Can't render a meaningful report with no data — refuse instead of
  // producing an empty PDF.
  if (listings.length === 0 || !lastScrapedAt) {
    return NextResponse.json(
      {
        error:
          "No listings to export yet. Run a scrape from the dashboard first.",
      },
      { status: 409 },
    );
  }

  const unitSummaries = summarizeAllUnitTypes(listings);
  const byBuilding = summarizeByBuilding(listings);

  const buffer = await renderToBuffer(
    <RentalCompReport
      listings={listings}
      unitSummaries={unitSummaries}
      byBuilding={byBuilding}
      generatedAt={new Date()}
      lastScrapedAt={lastScrapedAt}
    />,
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `fitzrovia-rental-comp-${stamp}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
