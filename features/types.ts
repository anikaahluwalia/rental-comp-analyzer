/**
 * Domain types for the rental comp scraper.
 *
 * These are the types shared across the scraper, consolidation layer, PDF
 * export, and natural-language query — keeping them strict + explicit so
 * that adding a new view doesn't silently break anything.
 */

export type UnitType = "Bachelor" | "1-Bed" | "2-Bed" | "3-Bed";

export const UNIT_TYPES: UnitType[] = ["Bachelor", "1-Bed", "2-Bed", "3-Bed"];

/**
 * Where a listing came from. Tagged on every Listing for audit + UI labelling.
 *
 *  - "official-site" the building's own marketing website (primary source
 *                    of truth — use the operator's page, not aggregators)
 *  - "rentals-ca"    rentals.ca listing for the same building (secondary
 *                    coverage — catches inventory the building site may not
 *                    publish, and is useful when the operator site returns
 *                    zero for whatever reason)
 *  - "zillow-ca"     zillow.ca listing (secondary coverage)
 *  - "liv-rent"      liv.rent listing (secondary coverage)
 *  - "mock"          synthetic data from `features/mock-data.ts`, only used
 *                    by the offline PDF render test
 */
export type ScrapeSource =
  | "official-site"
  | "rentals-ca"
  | "zillow-ca"
  | "liv-rent"
  | "mock";

export const REAL_SOURCES: ScrapeSource[] = [
  "official-site",
  "rentals-ca",
  "zillow-ca",
  "liv-rent",
];

/** A building we scrape. Static-config per the brief. */
export type Property = {
  id: string;
  name: string;
  address: string;
  /** Hardcoded — we only have 10 buildings, so no need for a geocoder. */
  lat: number;
  lng: number;
  /**
   * The building's own marketing site root (e.g. https://www.parkerlife.ca).
   * Scraped to catch banner promotions and to discover promo pages the
   * operator hasn't linked from their floorplans page.
   */
  siteUrl: string;
  /**
   * The specific page that lists available units with rent + sqft (usually
   * `/floorplans`, `/suites`, or `/availability`). Scraped as the primary
   * source of unit pricing data.
   */
  floorplansUrl: string;
  /**
   * Optional third-party aggregator URLs. When configured, the scraper
   * pulls pricing from these in addition to the building's own site, then
   * merges + dedupes the results. Treat the official site as source of
   * truth; aggregators as secondary coverage.
   */
  rentalsCaUrl?: string;
  zillowUrl?: string;
  livRentUrl?: string;
};

/** A single unit listing captured during a scrape. */
export type Listing = {
  propertyId: string;
  unitType: UnitType;
  rent: number; // CAD / month
  sqft?: number; // may be missing on some sites
  incentive?: string; // e.g. "1 month free on 12-month lease"
  unitId?: string; // source-provided ID if any
  floorplanUrl?: string;
  /** Exact page observed, never inferred from the property configuration. */
  sourceUrl?: string;
  /** Explicit physical unit number, not a generated ID or floorplan name. */
  unitNumber?: string;
  availability?: string;
  incentiveSourceUrl?: string;
  /** Site-wide promotions are not confirmed to apply to individual units. */
  incentiveScope?: "unit" | "property";
  /** Where this specific unit was scraped from. */
  source: ScrapeSource;
  scrapedAt: string; // ISO timestamp
};

/** Metadata about a single scrape run for a single property. */
export type ScrapeRun = {
  propertyId: string;
  source: ScrapeSource;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "partial" | "failed" | "skipped";
  listingsFound: number;
  /** URLs actually scraped for this run (floorplans + homepage + promo pages). */
  pagesScraped?: string[];
  error?: string;
};

/** Rolled-up view by unit type across all properties. */
export type ConsolidatedRow = {
  unitType: UnitType;
  propertyId: string;
  propertyName: string;
  availableCount: number;
  avgRent: number;
  minRent: number;
  maxRent: number;
  avgSqft?: number;
  avgPricePerSqft?: number;
  activeIncentives: string[];
};
