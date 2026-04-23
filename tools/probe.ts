#!/usr/bin/env tsx
/**
 * Probe script for tuning the building-site scraper against a real live page.
 *
 * Usage:
 *   npm run probe -- --property parker
 *   npm run probe -- --property the-selby --trace
 *   npm run probe -- --property the-hampton --raw
 *
 * Prints:
 *   1. The building's official site + floorplans URL (from
 *      `features/properties.ts`).
 *   2. The pages the scraper discovered + scraped (site map + selected
 *      URLs).
 *   3. The parsed listings and any incentives found.
 *   4. The ScrapeRun metadata (status, listingsFound, any error).
 *
 * --raw   dumps each scraped page's markdown to `.data/debug/<property>-*.md`
 *         so the parser can be re-run offline against the exact markdown we
 *         saw, without burning another Firecrawl credit.
 * --trace re-scrapes the building, feeds the combined markdown back through
 *         the parser, and prints every rent candidate it found with
 *         accept/reject reason. Best tool for diagnosing why a building
 *         returns 0 listings.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Next.js auto-loads .env.local for server-side code, but this probe runs
// standalone via tsx. Load it by hand so FIRECRAWL_KEY is picked up.
(function loadDotEnv() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
  }
})();

import { PROPERTIES } from "../features/properties";
import { scrapeBuildingSite } from "../features/sources/building-site";
import { fetchHtml, mapSite } from "../features/sources/fetch-html";
import { extractListingsWithTrace } from "../features/sources/parse-units";
import { extractIncentives } from "../features/sources/extract-incentives";

type Args = {
  property?: string;
  raw?: boolean;
  trace?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--property") out.property = argv[++i];
    else if (a === "--raw") out.raw = true;
    else if (a === "--trace") out.trace = true;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.property) {
    console.error("Usage: npm run probe -- --property <id> [--raw] [--trace]");
    console.error(
      "Property ids: " + PROPERTIES.map((p) => p.id).join(", "),
    );
    process.exit(1);
  }

  const property = PROPERTIES.find((p) => p.id === args.property);
  if (!property) {
    console.error(`Unknown property id: ${args.property}`);
    console.error("Known: " + PROPERTIES.map((p) => p.id).join(", "));
    process.exit(1);
  }

  console.log("---");
  console.log(`Property    : ${property.name} (${property.id})`);
  console.log(`Site        : ${property.siteUrl}`);
  console.log(`Floorplans  : ${property.floorplansUrl}`);
  console.log("---");

  // Step 1: site map — what URLs does Firecrawl see on this site?
  const map = await mapSite(property.siteUrl);
  console.log(`Map         : ${map.urls.length} URLs ${map.ok ? "ok" : "error: " + map.error}`);
  const shown = map.urls.slice(0, 15);
  for (const u of shown) console.log(`              ${u}`);
  if (map.urls.length > shown.length) {
    console.log(`              … and ${map.urls.length - shown.length} more`);
  }

  // Step 2: optionally dump the raw markdown of the floorplans page for
  // offline parser debugging.
  if (args.raw) {
    const page = await fetchHtml(property.floorplansUrl);
    const dumpDir = join(process.cwd(), ".data", "debug");
    mkdirSync(dumpDir, { recursive: true });
    if (page.markdown) {
      const f = join(dumpDir, `${property.id}-floorplans.md`);
      writeFileSync(f, page.markdown, "utf-8");
      console.log(`Dumped MD   : ${f}`);
    }
    if (page.html) {
      const f = join(dumpDir, `${property.id}-floorplans.html`);
      writeFileSync(f, page.html, "utf-8");
      console.log(`Dumped HTML : ${f}`);
    }
  }

  // Step 3: run the actual scraper so we can see what it parses.
  const result = await scrapeBuildingSite(property);

  console.log("---");
  console.log(`Run status    : ${result.run.status}`);
  console.log(`Listings found: ${result.run.listingsFound}`);
  if (result.run.pagesScraped && result.run.pagesScraped.length > 0) {
    console.log(`Pages scraped : ${result.run.pagesScraped.length}`);
    for (const p of result.run.pagesScraped) console.log(`                ${p}`);
  }
  if (result.run.error) console.log(`Run error     : ${result.run.error}`);
  console.log("--- Parsed listings ---");
  if (result.listings.length === 0) {
    console.log("(none)");
  } else {
    for (const l of result.listings) {
      console.log(
        `  ${l.unitType.padEnd(8)}  $${String(l.rent).padStart(5)}` +
          (l.sqft ? `  ${l.sqft} sqft` : "") +
          (l.incentive ? `  [${l.incentive}]` : "") +
          (l.unitId ? `  id=${l.unitId}` : ""),
      );
    }
  }

  // Step 4: with --trace, re-fetch every scraped page, combine their
  // markdown the same way the scraper does, and run the parser's
  // diagnostic extractor to show every rent candidate it considered.
  // This is the quickest way to see why a rent number on the page didn't
  // make it into `result.listings`.
  if (args.trace) {
    console.log("--- Trace ---");
    const pageUrls =
      result.run.pagesScraped && result.run.pagesScraped.length > 0
        ? result.run.pagesScraped
        : [property.floorplansUrl];

    const chunks: string[] = [];
    for (const url of pageUrls) {
      const page = await fetchHtml(url);
      if (page.ok && page.markdown) {
        chunks.push(`<!-- page: ${url} -->\n${page.markdown}`);
      } else {
        console.log(`  (skipping ${url} — ${page.error ?? "no markdown"})`);
      }
    }
    const combined = chunks.join("\n\n---\n\n");
    const incentives = extractIncentives(combined);
    const dbg = extractListingsWithTrace(
      combined,
      property.id,
      new Date().toISOString(),
      incentives.primary,
    );

    console.log("Pages parsed:");
    for (const p of dbg.pages) {
      console.log(
        `  ${p.url.padEnd(60)}  ${p.chars.toString().padStart(6)} chars` +
          `  dominant=${p.dominantType ?? "—"}`,
      );
    }

    console.log(`Rent candidates: ${dbg.trace.length}`);
    const accepted = dbg.trace.filter((t) => t.outcome === "accepted").length;
    const rejected = dbg.trace.length - accepted;
    console.log(`  accepted: ${accepted}  rejected: ${rejected}`);

    for (const t of dbg.trace) {
      const marker = t.outcome === "accepted" ? "✓" : "✗";
      const label =
        t.outcome === "accepted"
          ? `${(t.unitType ?? "?").padEnd(8)}  $${String(t.rent).padStart(5)}` +
            (t.sqft ? `  ${t.sqft} sqft` : "") +
            `  (via ${t.typeSource})`
          : `$${String(t.rent).padStart(5)}  ${t.outcome}`;
      console.log(`  ${marker} ${label}`);
    }

    if (incentives.all.length > 0) {
      console.log(`Incentives found: ${incentives.all.length}`);
      for (const s of incentives.all.slice(0, 5)) {
        console.log(`  - ${s.slice(0, 120)}`);
      }
    }
  }

  console.log("---");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
