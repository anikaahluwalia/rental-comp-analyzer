/**
 * Developer tool for previewing the PDF report — not part of the live app.
 *
 * When we're tweaking the design of the downloadable PDF, we don't want
 * to run a full scrape of the rental websites every time just to see
 * what the report looks like. That would take a couple of minutes and
 * use up paid API credits.
 *
 * Instead, this script builds the PDF against a set of fake sample
 * listings and saves it to a file on disk, so the layout can be checked
 * in a second. It's only ever run by hand from the command line by
 * someone working on the code.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { RentalCompReport } from "../features/pdf-report";
import { summarizeAllUnitTypes, summarizeByBuilding } from "../features/consolidation";
import { generateMockListings } from "../features/mock-data";

async function main() {
  const listings = generateMockListings();
  const unitSummaries = summarizeAllUnitTypes(listings);
  const byBuilding = summarizeByBuilding(listings);
  const buf = await renderToBuffer(
    RentalCompReport({
      listings,
      unitSummaries,
      byBuilding,
      generatedAt: new Date(),
      lastScrapedAt: new Date().toISOString(),
    }) as any,
  );
  writeFileSync("/sessions/dreamy-quirky-ptolemy/mnt/outputs/test-chart-fix.pdf", buf);
  console.log("OK size=", buf.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
