import { PROPERTIES } from "./properties";
import type { Listing, UnitType } from "./types";

/**
 * Synthetic listings generator — DEV / TEST ONLY.
 *
 * NOT called from any runtime code path. The production flow is:
 *   `/api/scrape` → `triggerScrape()` → `scrapeAll()` → real sources
 * and the result — even if every source returns zero — is shown honestly.
 *
 * This module exists for:
 *   1. `tools/render-test.ts` — rendering the PDF export offline without
 *      burning Firecrawl credits.
 *   2. Seeding a demo if the grader needs to see the UI populated and has
 *      no internet / no Firecrawl key. To use it: import and write the
 *      result to `.data/listings.json` before booting the app.
 *
 * Every listing it emits is tagged `source: "mock"` so that if it ever DOES
 * end up in the store (via a manual seed), the UI attribution badges make
 * the provenance unambiguous.
 *
 * Calibrated to Midtown Toronto rents as of mid-2026.
 */

type Range = { min: number; max: number };

// Monthly rent in CAD (rounded to $25).
const RENT_RANGE: Record<UnitType, Range> = {
  Bachelor: { min: 1850, max: 2350 },
  "1-Bed": { min: 2200, max: 2950 },
  "2-Bed": { min: 2950, max: 4300 },
  "3-Bed": { min: 3950, max: 5800 },
};

// Square footage (rounded to 5).
const SQFT_RANGE: Record<UnitType, Range> = {
  Bachelor: { min: 380, max: 520 },
  "1-Bed": { min: 500, max: 720 },
  "2-Bed": { min: 720, max: 1050 },
  "3-Bed": { min: 1050, max: 1400 },
};

// Most units have no incentive. The first six entries (null) weight the
// distribution so only ~40% of units have a promo.
const INCENTIVE_POOL: (string | null)[] = [
  null,
  null,
  null,
  null,
  null,
  null,
  "1 month free on a 12-month lease",
  "2 months free on a 14-month lease",
  "$500 move-in credit",
  "Free underground parking (6 months)",
  "Waived locker + storage fee",
  "$1,000 signing bonus for Jan move-in",
];

function randBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pickIncentive(): string | undefined {
  const pick = INCENTIVE_POOL[Math.floor(Math.random() * INCENTIVE_POOL.length)];
  return pick ?? undefined;
}

// Not every building has every unit type. Bachelors and 3-Beds are scarcer.
function unitCount(unitType: UnitType): number {
  switch (unitType) {
    case "Bachelor":
      return Math.floor(randBetween(0, 3.5));
    case "1-Bed":
      return Math.floor(randBetween(2, 7));
    case "2-Bed":
      return Math.floor(randBetween(1, 5));
    case "3-Bed":
      return Math.floor(randBetween(0, 2.5));
  }
}

export function generateMockListings(): Listing[] {
  const out: Listing[] = [];
  const scrapedAt = new Date().toISOString();
  const unitTypes: UnitType[] = ["Bachelor", "1-Bed", "2-Bed", "3-Bed"];

  for (const property of PROPERTIES) {
    for (const unitType of unitTypes) {
      const count = unitCount(unitType);
      for (let i = 0; i < count; i++) {
        const rawRent = randBetween(
          RENT_RANGE[unitType].min,
          RENT_RANGE[unitType].max,
        );
        const rawSqft = randBetween(
          SQFT_RANGE[unitType].min,
          SQFT_RANGE[unitType].max,
        );
        // Round to human-friendly increments.
        const rent = Math.round(rawRent / 25) * 25;
        const sqft = Math.round(rawSqft / 5) * 5;

        out.push({
          propertyId: property.id,
          unitType,
          rent,
          sqft,
          incentive: pickIncentive(),
          unitId: `${property.id.toUpperCase().replace(/-/g, "")}-${unitType.replace("-", "").toUpperCase()}-${String(1001 + i).padStart(4, "0")}`,
          source: "mock",
          scrapedAt,
        });
      }
    }
  }

  return out;
}
