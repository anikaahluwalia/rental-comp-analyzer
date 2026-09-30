import type { Listing, Property, ScrapeRun } from "../types";
import { fetchHtml, mapSite } from "./fetch-html";
import { extractListings } from "./parse-units";
import { extractIncentives } from "./extract-incentives";

/**
 * Scrape a single building's own official marketing site.
 *
 * Source pricing from each property's own website rather than relying
 * solely on broad rental aggregators. This module does that.
 *
 * Flow:
 *   1. Ask Firecrawl /map for every URL on the site. This is one cheap
 *      call per building that returns up to ~50 URLs.
 *   2. Pick the small subset we actually need:
 *        - the building's floorplans/suites URL (primary pricing source)
 *        - the site homepage (catches banner promos)
 *        - any URL whose path looks like a promo / specials / offers page
 *   3. Scrape each selected URL in parallel. Use Promise.allSettled so
 *      one page failing (timeout, 404, bot block) doesn't kill the run.
 *   4. Concatenate every page's markdown and feed it into:
 *        - `extractListings()` to find unit × rent × sqft tuples
 *        - `extractIncentives()` to find any "N months free" / "$X credit"
 *          language published anywhere on the site
 *   5. Attach the primary incentive to every listing and return.
 *
 * Debug a single building with:
 *   npm run probe -- --property parker
 */
export async function scrapeBuildingSite(
  property: Property,
): Promise<{ listings: Listing[]; run: ScrapeRun }> {
  const startedAt = new Date().toISOString();

  // Step 1: enumerate URLs on the building's site.
  const map = await mapSite(property.siteUrl);
  const urls = pickPagesToScrape(map.urls, property);

  // Step 2: scrape the selected URLs in parallel.
  const results = await Promise.allSettled(urls.map((u) => fetchHtml(u)));

  const markdownChunks: string[] = [];
  const pagesScraped: string[] = [];
  let anyOk = false;
  const pageErrors: string[] = [];

  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    const url = urls[i];
    if (r.status === "fulfilled" && r.value.ok) {
      anyOk = true;
      pagesScraped.push(url);
      // Prefer markdown (cleaner). Fall back to HTML-as-text if the
      // transport didn't give us markdown (e.g. direct fetch with no key).
      const md = r.value.markdown ?? stripHtmlTags(r.value.html);
      if (md) {
        markdownChunks.push(`<!-- page: ${url} -->\n${md}`);
      }
    } else if (r.status === "fulfilled") {
      pageErrors.push(`${url}: ${r.value.error ?? "unknown fetch error"}`);
    } else {
      pageErrors.push(
        `${url}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      );
    }
  }

  const finishedAt = new Date().toISOString();

  if (!anyOk) {
    return {
      listings: [],
      run: {
        propertyId: property.id,
        source: "official-site",
        startedAt,
        finishedAt,
        status: "failed",
        listingsFound: 0,
        pagesScraped,
        error:
          pageErrors.join(" | ").slice(0, 500) ||
          "All page fetches failed with no error message.",
      },
    };
  }

  // Keep each page's observations and promotion text separate. A site-wide
  // promotion is evidence, but does not establish eligibility for every unit.
  const promotions = markdownChunks.flatMap((chunk) => {
    const url = chunk.match(/<!-- page: (.*?) -->/)?.[1];
    return extractIncentives(chunk).all.map((text) => ({ text, url }));
  });
  const listings = markdownChunks.flatMap((chunk) => {
    const pageUrl = chunk.match(/<!-- page: (.*?) -->/)?.[1];
    const local = promotions.filter((promo) => promo.url === pageUrl);
    const candidates = local.length ? local : promotions;
    const units = extractListings(chunk, property.id, startedAt, undefined);
    return units.flatMap((unit) => candidates.length ? candidates.map((promo) => ({
      ...unit, incentive: promo.text, incentiveSourceUrl: promo.url,
      incentiveScope: "property" as const,
    })) : [unit]);
  });

  const status: ScrapeRun["status"] =
    listings.length === 0
      ? "failed"
      : pageErrors.length > 0
        ? "partial"
        : "ok";

  return {
    listings,
    run: {
      propertyId: property.id,
      source: "official-site",
      startedAt,
      finishedAt,
      status,
      listingsFound: listings.length,
      pagesScraped,
      error:
        listings.length === 0
          ? `Scraped ${pagesScraped.length} page(s) but parser found no units.`
          : pageErrors.length > 0
            ? `Partial: ${pageErrors.length} page(s) failed — ${pageErrors[0]}`
            : undefined,
    },
  };
}

/**
 * Decide which URLs from the site map to actually scrape. We want to keep
 * this small — one building should cost ~3 Firecrawl credits, not 30.
 *
 * Always included:
 *   - The configured floorplansUrl (primary pricing source)
 *   - The configured siteUrl (catches banner promos that live on every page)
 *
 * Also included if found in the map:
 *   - Any URL whose path segment contains: promo, promotion, special,
 *     specials, offer, offers, incentive, incentives, lease-special,
 *     move-in, bonus
 *
 * The set is deduped and capped at 5 URLs per building.
 */
function pickPagesToScrape(
  discovered: string[],
  property: Property,
): string[] {
  const selected = new Set<string>();
  selected.add(property.floorplansUrl);
  selected.add(property.siteUrl);

  const promoKeywords =
    /(?:^|\/)(?:promos?|promotion|specials?|offers?|incentives?|lease-?special|move-?in|bonus)(?:\/|$|[-_])/i;

  for (const url of discovered) {
    if (selected.size >= 5) break;
    if (selected.has(url)) continue;
    try {
      const u = new URL(url);
      if (promoKeywords.test(u.pathname)) {
        selected.add(url);
      }
    } catch {
      // Ignore malformed URLs from the map.
    }
  }

  return Array.from(selected);
}

/**
 * Very lightweight HTML → text fallback. Only used when the scrape
 * transport didn't return markdown (direct fetch with no Firecrawl key).
 * The real production path always has markdown.
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
