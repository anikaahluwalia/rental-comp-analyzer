/**
 * The scraper coordinator.
 *
 * For each property, we pull pricing from up to four sources:
 *   1. The building's own official marketing site (primary — source of
 *      truth).
 *   2. rentals.ca        (if `property.rentalsCaUrl` is configured)
 *   3. zillow.ca         (if `property.zillowUrl` is configured)
 *   4. liv.rent          (if `property.livRentUrl` is configured)
 *
 * Why multiple sources: operator sites sometimes return zero listings —
 * the page is behind a JS widget, a Cloudflare block, a parser regression,
 * or the operator just hasn't updated their marketing site that week.
 * Aggregators give us a secondary read so a building still shows pricing
 * even when its own site is dark.
 *
 * Merge rules (see `mergeListingsAcrossSources` below):
 *   - Dedupe across sources by `(unitType, rent, sqft ?? null)`. The same
 *     unit listed on both the operator site and rentals.ca should show
 *     once.
 *   - When duplicates are found, keep the one from the higher-priority
 *     source — official-site > rentals-ca > zillow-ca > liv-rent.
 *
 * Two entry points:
 *   - scrapeProperty() — scrape one building across all its configured sources.
 *   - scrapeAll()      — scrape every building on the list, in batches.
 *
 * Built to keep going when things go wrong. If one source (or one whole
 * building) fails, the others still finish and the dashboard shows a per
 * -source ScrapeRun explaining why.
 *
 * Runs buildings in small batches so we don't hammer Firecrawl or the
 * sites' origins all at once — that reliability win costs us a couple of
 * minutes on a full run, but it avoids silent failures.
 */
import type { Listing, Property, ScrapeRun, ScrapeSource } from "../types";
import { scrapeBuildingSite } from "./building-site";
import { scrapeAggregator } from "./aggregator";

/**
 * Scrape one property across every configured source.
 *
 * Returns merged + deduped listings plus one ScrapeRun per source so the
 * UI can explain exactly which sources contributed + which failed.
 * Never throws — every failure path is converted into a failed ScrapeRun.
 */
export async function scrapeProperty(
  property: Property,
): Promise<{ listings: Listing[]; observations: Listing[]; runs: ScrapeRun[] }> {
  // Fire every configured source in parallel for this property. We
  // capture each as a settled promise so one source exploding doesn't
  // take out the others.
  const tasks: Promise<{ listings: Listing[]; run: ScrapeRun }>[] = [];

  tasks.push(
    scrapeBuildingSite(property).catch((err) => ({
      listings: [],
      run: syntheticFailedRun(property.id, "official-site", err),
    })),
  );

  tasks.push(
    scrapeAggregator(property, "rentals-ca", property.rentalsCaUrl).catch(
      (err) => ({
        listings: [],
        run: syntheticFailedRun(property.id, "rentals-ca", err),
      }),
    ),
  );

  tasks.push(
    scrapeAggregator(property, "zillow-ca", property.zillowUrl).catch((err) => ({
      listings: [],
      run: syntheticFailedRun(property.id, "zillow-ca", err),
    })),
  );

  tasks.push(
    scrapeAggregator(property, "liv-rent", property.livRentUrl).catch((err) => ({
      listings: [],
      run: syntheticFailedRun(property.id, "liv-rent", err),
    })),
  );

  const settled = await Promise.all(tasks);
  const runs = settled.map((s) => s.run);
  const listings = mergeListingsAcrossSources(settled.map((s) => s.listings));

  return { listings, observations: settled.flatMap((s) => s.listings), runs };
}

/**
 * Scrape every property in the list.
 *
 * Runs buildings in small batches rather than all-at-once. Each building
 * scrape now involves more Firecrawl calls (site map + 2–5 official pages
 * + one per configured aggregator), so firing all 10 at once would
 * saturate Firecrawl's free-tier concurrency limit and some requests
 * would fail silently. Batching to 2 buildings at a time keeps the
 * in-flight call count predictable.
 *
 * Trade-off: total runtime is ~3–4 minutes for 10 buildings with 3-4
 * sources each, vs. ~30s if everything fired at once. Reliability wins.
 */
export async function scrapeAll(
  properties: Property[],
): Promise<{ listings: Listing[]; observations: Listing[]; runs: ScrapeRun[] }> {
  const BATCH_SIZE = 2;
  const allListings: Listing[] = [];
  const allObservations: Listing[] = [];
  const allRuns: ScrapeRun[] = [];

  for (let i = 0; i < properties.length; i += BATCH_SIZE) {
    const batch = properties.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((p) => scrapeProperty(p)));
    for (const r of results) {
      allListings.push(...r.listings);
      allObservations.push(...r.observations);
      allRuns.push(...r.runs);
    }
  }

  return {
    listings: allListings,
    observations: allObservations,
    runs: allRuns,
  };
}

/**
 * Priority order when the same unit shows up on multiple sources.
 * Lower index = higher priority (kept; others dropped).
 */
const SOURCE_PRIORITY: ScrapeSource[] = [
  "official-site",
  "rentals-ca",
  "zillow-ca",
  "liv-rent",
  "mock",
];

/**
 * Combine per-source listing arrays into one deduped array. Two listings
 * are considered the same unit if they share (unitType, rent, sqft ?? null).
 * When duplicates collide we keep the one from the highest-priority source.
 *
 * Original observation IDs are retained. Research uses the separate, unmerged
 * observations collection so disagreements are not hidden by this legacy view.
 */
function mergeListingsAcrossSources(perSource: Listing[][]): Listing[] {
  const byKey = new Map<string, Listing>();

  for (const group of perSource) {
    for (const listing of group) {
      const key = `${listing.unitType}|${listing.rent}|${listing.sqft ?? "nosqft"}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, listing);
        continue;
      }
      const existingRank = SOURCE_PRIORITY.indexOf(existing.source);
      const incomingRank = SOURCE_PRIORITY.indexOf(listing.source);
      if (incomingRank >= 0 && incomingRank < existingRank) {
        byKey.set(key, listing);
      }
    }
  }

  // Dashboard compatibility view only; research retains all original observations.
  return [...byKey.values()];
}

function syntheticFailedRun(
  propertyId: string,
  source: ScrapeSource,
  err: unknown,
): ScrapeRun {
  const now = new Date().toISOString();
  return {
    propertyId,
    source,
    startedAt: now,
    finishedAt: now,
    status: "failed",
    listingsFound: 0,
    error: err instanceof Error ? err.message : String(err),
  };
}
