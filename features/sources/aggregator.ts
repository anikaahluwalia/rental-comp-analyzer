import type { Listing, Property, ScrapeRun, ScrapeSource } from "../types";
import { fetchHtml } from "./fetch-html";
import { extractIncentives } from "./extract-incentives";
import { extractListings } from "./parse-units";

/**
 * Generic "scrape one URL and parse it" module used for third-party
 * aggregators like rentals.ca, zillow.ca, and liv.rent.
 *
 * Why one module for all aggregators: each aggregator renders a listing
 * page with rent + bed-count + sqft somewhere in the markdown. The
 * universal parser in `parse-units.ts` can read all of them without
 * per-site CSS selectors — a site redesign on any aggregator now just
 * tweaks regexes in one place, not a per-aggregator adapter.
 *
 * Flow per aggregator URL:
 *   1. `fetchHtml(url)` (routes through Firecrawl if a key is set).
 *   2. Run the universal markdown parser over the result.
 *   3. Attach the aggregator's source label to each listing.
 *   4. Return the listings + a ScrapeRun recording what happened.
 *
 * If `url` is undefined (the property config doesn't have an entry for
 * this aggregator), the run returns "skipped" with zero listings.
 */
export async function scrapeAggregator(
  property: Property,
  source: Exclude<ScrapeSource, "mock" | "official-site">,
  url: string | undefined,
): Promise<{ listings: Listing[]; run: ScrapeRun }> {
  const startedAt = new Date().toISOString();

  if (!url) {
    const finishedAt = new Date().toISOString();
    return {
      listings: [],
      run: {
        propertyId: property.id,
        source,
        startedAt,
        finishedAt,
        status: "skipped",
        listingsFound: 0,
        error: `No ${source} URL configured for ${property.id}.`,
      },
    };
  }

  const page = await fetchHtml(url);
  const finishedAt = new Date().toISOString();

  if (!page.ok) {
    return {
      listings: [],
      run: {
        propertyId: property.id,
        source,
        startedAt,
        finishedAt,
        status: "failed",
        listingsFound: 0,
        pagesScraped: [],
        error: page.error ?? `${source} fetch failed.`,
      },
    };
  }

  const md = page.markdown ?? stripHtmlTags(page.html);
  const combined = `<!-- page: ${url} -->\n${md}`;
  const incentives = extractIncentives(combined);
  const rawListings = extractListings(
    combined,
    property.id,
    startedAt,
    incentives.primary,
  );

  // extractListings stamps source="official-site" — override with the
  // aggregator's label so the audit trail in the UI / PDF is correct.
  const listings: Listing[] = rawListings.map((l) => ({ ...l, source }));

  return {
    listings,
    run: {
      propertyId: property.id,
      source,
      startedAt,
      finishedAt,
      status: listings.length === 0 ? "failed" : "ok",
      listingsFound: listings.length,
      pagesScraped: [url],
      error:
        listings.length === 0
          ? `Scraped ${source} page but parser found no units.`
          : undefined,
    },
  };
}

/**
 * Very lightweight HTML → text fallback, same shape as the one in
 * building-site.ts. Only used when the scrape transport didn't return
 * markdown (direct fetch with no Firecrawl key).
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
