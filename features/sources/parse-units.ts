import type { Listing, UnitType } from "../types";
import { parseUnitType } from "./parse-helpers";

/**
 * Universal unit-listing parser for building marketing sites.
 *
 * Each operator's website has a different layout — some render unit cards,
 * some use floorplan tables, some just list "Studio · 420 sqft · From
 * $2,150". We can't write 10 bespoke parsers, so this module looks at the
 * combined markdown from every page we scraped for a building and finds
 * the "tuples" that describe a unit: a rent number, a nearby bed count,
 * and (optionally) a nearby square-footage.
 *
 * Strategy (two passes):
 *   1. Slide a window over the markdown and, for every plausible rent
 *      ($1,200–$10,000), look ±450 chars for a bed descriptor and a sqft
 *      number. Within-a-line context wins over cross-line. A tuple of
 *      (unit type, rent) is enough to emit a listing; sqft is attached
 *      when present.
 *   2. For rents with no bed descriptor in the window, fall back to
 *      page-level context: if the containing page (delimited by the
 *      "<!-- page: URL -->" separator the scraper emits) mentions exactly
 *      ONE unit type anywhere on the page, assign that type to the
 *      orphan rent. This rescues dedicated "1-Bedroom Suites" pages and
 *      floorplan grids where the type header is outside the sliding
 *      window.
 *
 * After raw extraction, we dedupe: identical (unit type, rent, sqft)
 * tuples from different pages of the same building are the same unit
 * mentioned twice (once on the floorplans page, once in a promo banner,
 * etc.). We keep one copy.
 */

// Rent numbers we accept. Very tight bounds to avoid phone numbers, dates,
// and spurious four-digit figures.
const RENT_RE = /\$\s*(\d{1,2}[,.]?\d{3})(?!\s*(?:ft|sq|square))/g;

// Sqft patterns covering the common variants.
const SQFT_RE =
  /(\d{2,4})\s*(?:sq\s*\.?\s*ft|sqft|sq\s*feet|square\s*feet|ft²|ft\s*²|sf\b)/i;

// Bed descriptors — very permissive so we catch unusual phrasings.
// Covers: "Studio", "Bachelor", "Jr. 1 Bed", "1 Bedroom", "1-Bed", "1BR",
// "1 BD", "1B" (card-header shorthand), "1+0" / "1+1" / "2+1" (Toronto
// den notation — "1-bedroom plus den" is written 1+1 all over Ontario
// marketing sites), "One Bedroom" spelled out.
const BED_CONTEXT_RE =
  /\b(?:studio(?:\s+suite)?|bachelor(?:\s+suite)?|jr\.?\s*(?:one|1)\s*bed|junior\s*(?:one|1)\s*bed|(?:one|1|two|2|three|3)\s*(?:-|\s)?bed(?:room)?s?|(?:one|1|two|2|three|3)\s*br\b|(?:one|1|two|2|three|3)\s*bd\b|(?:one|1|two|2|three|3)\s*b\b|(?:1|2|3)\s*\+\s*[01]|0\s*bed)\b/i;

/** Size of the sliding window on either side of a rent match. */
const WINDOW_CHARS = 450;

/** Separator the scraper inserts between pages in combined markdown. */
const PAGE_BOUNDARY_RE = /<!--\s*page:\s*([^>]+?)\s*-->/g;

/**
 * Extract listings from the combined markdown of one building's scraped
 * pages.
 *
 * @param combinedMarkdown concatenated markdown from all scraped pages for
 *   this building. Use a separator like "\n\n---\n\n" when joining so we
 *   don't accidentally merge context across pages.
 * @param propertyId the Property.id to tag each listing with.
 * @param scrapedAt ISO timestamp to tag each listing with.
 * @param incentive optional site-wide incentive string (from
 *   `extractIncentives`) to attach to every listing.
 */
export function extractListings(
  combinedMarkdown: string,
  propertyId: string,
  scrapedAt: string,
  incentive: string | undefined,
): Listing[] {
  return extractListingsWithTrace(
    combinedMarkdown,
    propertyId,
    scrapedAt,
    incentive,
  ).listings;
}

/**
 * One rent match the parser considered while walking the markdown. Useful
 * for probe/debug output — lets us see exactly why a given "$2,500" on a
 * page was accepted or dropped.
 */
export type RentMatchTrace = {
  rent: number;
  /** Character offset in the (cleaned) combined markdown. */
  charIndex: number;
  page: string;
  outcome:
    | "accepted"
    | "out-of-range"
    | "no-bed-context-and-no-page-fallback"
    | "bed-context-unparseable";
  unitType?: UnitType;
  sqft?: number;
  /** Source of the unit type decision when outcome = accepted. */
  typeSource?: "local-window" | "page-fallback";
  snippet: string;
};

export type ExtractResult = {
  listings: Listing[];
  trace: RentMatchTrace[];
  /** The per-page ranges the parser saw, with dominant unit type per page. */
  pages: Array<{ url: string; dominantType: UnitType | null; chars: number }>;
};

/**
 * Same extraction logic as `extractListings` but also returns a per-rent
 * trace and per-page summary. Used by the probe script to show exactly
 * which rents were accepted or rejected and why.
 */
export function extractListingsWithTrace(
  combinedMarkdown: string,
  propertyId: string,
  scrapedAt: string,
  incentive: string | undefined,
): ExtractResult {
  const md = combinedMarkdown
    .replace(/\r\n/g, "\n")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/!\[[^\]]*\]/g, "")
    .replace(/https?:\/\/\S+/g, " ");

  const pageRanges = findPageRanges(md);

  type Raw = {
    unitType: UnitType;
    rent: number;
    sqft?: number;
  };
  const raws: Raw[] = [];
  const trace: RentMatchTrace[] = [];

  RENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RENT_RE.exec(md)) !== null) {
    const rawRent = match[1].replace(/[,.]/g, "");
    const rent = Number(rawRent);
    const page = pageRanges.find(
      (p) => match!.index >= p.start && match!.index < p.end,
    );
    const pageUrl = page?.url ?? "(whole-document)";

    const windowStart = Math.max(0, match.index - WINDOW_CHARS);
    const windowEnd = Math.min(md.length, match.index + WINDOW_CHARS);
    const snippet = md.slice(windowStart, windowEnd);

    if (!Number.isFinite(rent) || rent < 1200 || rent > 10_000) {
      trace.push({
        rent,
        charIndex: match.index,
        page: pageUrl,
        outcome: "out-of-range",
        snippet,
      });
      continue;
    }

    let unitType: UnitType | null = null;
    let typeSource: "local-window" | "page-fallback" | undefined;
    // Find the bed-context match CLOSEST to the rent match. `.match()`
    // returns the first alternative in the string, which is wrong when
    // two floorplan sections sit within 450 chars of each other — the
    // earlier section's label wins over the actual one. Collecting every
    // match and picking by absolute distance solves this cleanly.
    const nearestBed = findNearestBedMatch(snippet, match.index - windowStart);
    if (nearestBed) {
      const parsed = parseUnitType(nearestBed.text);
      if (parsed) {
        unitType = parsed;
        typeSource = "local-window";
      } else {
        trace.push({
          rent,
          charIndex: match.index,
          page: pageUrl,
          outcome: "bed-context-unparseable",
          snippet,
        });
        continue;
      }
    }

    if (!unitType && page && page.dominantType) {
      unitType = page.dominantType;
      typeSource = "page-fallback";
    }

    if (!unitType) {
      trace.push({
        rent,
        charIndex: match.index,
        page: pageUrl,
        outcome: "no-bed-context-and-no-page-fallback",
        snippet,
      });
      continue;
    }

    const sqftMatch = snippet.match(SQFT_RE);
    const sqft =
      sqftMatch && Number.isFinite(Number(sqftMatch[1]))
        ? clampSqft(Number(sqftMatch[1]))
        : undefined;

    raws.push({ unitType, rent, sqft });
    trace.push({
      rent,
      charIndex: match.index,
      page: pageUrl,
      outcome: "accepted",
      unitType,
      sqft,
      typeSource,
      snippet,
    });
  }

  // Dedupe: same (unitType, rent, sqft ?? null) across different pages of
  // the same building is one unit mentioned twice. Preserve first-seen order.
  const seen = new Set<string>();
  const out: Listing[] = [];
  let counter = 0;
  for (const r of raws) {
    const key = `${r.unitType}|${r.rent}|${r.sqft ?? "nosqft"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counter += 1;
    out.push({
      propertyId,
      unitType: r.unitType,
      rent: r.rent,
      sqft: r.sqft,
      incentive,
      unitId: `${propertyId.toUpperCase().replace(/-/g, "")}-${String(counter).padStart(4, "0")}`,
      source: "official-site",
      scrapedAt,
    });
  }

  return {
    listings: out,
    trace,
    pages: pageRanges.map((p) => ({
      url: p.url,
      dominantType: p.dominantType,
      chars: p.end - p.start,
    })),
  };
}

function clampSqft(n: number): number | undefined {
  if (!Number.isFinite(n)) return undefined;
  if (n < 250 || n > 3500) return undefined;
  return n;
}

type PageRange = {
  url: string;
  start: number;
  end: number;
  /**
   * The single unit type mentioned on this page, or null if zero or
   * multiple types were mentioned. Used as a fallback for orphan rents
   * whose local ±450-char window had no bed descriptor.
   */
  dominantType: UnitType | null;
};

/**
 * Split the combined markdown into per-page ranges using the
 * "<!-- page: URL -->" markers the scraper emits. For each page, scan
 * for every bed descriptor it contains and record the "dominant" unit
 * type — meaning: exactly one distinct UnitType was mentioned on that
 * page. Zero mentions → null. Two+ distinct types → null (too ambiguous
 * for a safe fallback).
 *
 * If the markdown has no page markers (e.g. single-page scrape), the
 * whole string is treated as one range.
 */
function findPageRanges(md: string): PageRange[] {
  const markers: { url: string; start: number }[] = [];
  PAGE_BOUNDARY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PAGE_BOUNDARY_RE.exec(md)) !== null) {
    markers.push({ url: m[1], start: m.index });
  }

  if (markers.length === 0) {
    return [
      {
        url: "(whole-document)",
        start: 0,
        end: md.length,
        dominantType: dominantUnitTypeIn(md),
      },
    ];
  }

  const ranges: PageRange[] = [];
  for (let i = 0; i < markers.length; i += 1) {
    const start = markers[i].start;
    const end = i + 1 < markers.length ? markers[i + 1].start : md.length;
    ranges.push({
      url: markers[i].url,
      start,
      end,
      dominantType: dominantUnitTypeIn(md.slice(start, end)),
    });
  }
  return ranges;
}

/**
 * Within a ±450-char snippet around a rent match, pick the right
 * bed-context match for this rent.
 *
 * Strategy: prefer the NEAREST bed match that appears BEFORE the rent.
 * Floorplan pages conventionally put a section header ("1 Bedroom", or a
 * card title like "Plan 1B") first, then the price text below. Without
 * that bias we misfile rents under the *next* section's header — e.g.,
 * a Studio's price snaps to the "1 Bedroom" header below it because the
 * next section happens to sit closer than the current one.
 *
 * Only fall back to a forward-direction match if there's nothing
 * backward. That covers odd layouts like "From $2,495 — 1 Bedroom plan".
 */
function findNearestBedMatch(
  snippet: string,
  rentIndexInSnippet: number,
): { text: string; index: number } | null {
  const re = new RegExp(BED_CONTEXT_RE.source, "gi");
  let backward: { text: string; index: number; distance: number } | null = null;
  let forward: { text: string; index: number; distance: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(snippet)) !== null) {
    const distance = Math.abs(m.index - rentIndexInSnippet);
    if (m.index <= rentIndexInSnippet) {
      if (!backward || distance < backward.distance) {
        backward = { text: m[0], index: m.index, distance };
      }
    } else {
      if (!forward || distance < forward.distance) {
        forward = { text: m[0], index: m.index, distance };
      }
    }
  }
  const best = backward ?? forward;
  return best ? { text: best.text, index: best.index } : null;
}

/**
 * Scan a chunk of markdown for every bed descriptor. If exactly one
 * distinct UnitType shows up, return it. Otherwise return null.
 */
function dominantUnitTypeIn(chunk: string): UnitType | null {
  const seen = new Set<UnitType>();
  const re = new RegExp(BED_CONTEXT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const type = parseUnitType(m[0]);
    if (type) seen.add(type);
    if (seen.size > 1) return null; // ambiguous
  }
  return seen.size === 1 ? [...seen][0] : null;
}
