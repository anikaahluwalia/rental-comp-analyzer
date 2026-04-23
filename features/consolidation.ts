import { PROPERTIES } from "./properties";
import { UNIT_TYPES, type Listing, type UnitType } from "./types";

/**
 * Rollup logic over raw listings. These are pure functions — no I/O,
 * no state — so they're easy to unit-test.
 */

export type UnitTypeSummary = {
  unitType: UnitType;
  availableCount: number;
  avgRent: number;
  minRent: number;
  maxRent: number;
  avgSqft: number;
  avgPricePerSqft: number;
  bestPricePerSqft?: {
    propertyId: string;
    propertyName: string;
    rent: number;
    sqft: number;
    pricePerSqft: number;
  };
  activeIncentiveCount: number;
};

export type BuildingRow = {
  propertyId: string;
  propertyName: string;
  totalUnits: number;
  byUnitType: Partial<
    Record<
      UnitType,
      {
        count: number;
        avgRent: number;
        minRent: number;
        avgSqft: number;
      }
    >
  >;
  activeIncentiveCount: number;
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeByUnitType(
  listings: Listing[],
  unitType: UnitType,
): UnitTypeSummary | null {
  const subset = listings.filter((l) => l.unitType === unitType);
  if (subset.length === 0) return null;

  const rents = subset.map((l) => l.rent);
  const withSqft = subset.filter(
    (l): l is Listing & { sqft: number } => typeof l.sqft === "number",
  );
  const sqftValues = withSqft.map((l) => l.sqft);
  const perSqft = withSqft.map((l) => l.rent / l.sqft);

  const bestIdx = perSqft.length
    ? perSqft.reduce(
        (bestI, v, i, arr) => (v < arr[bestI] ? i : bestI),
        0,
      )
    : -1;

  const bestListing = bestIdx >= 0 ? withSqft[bestIdx] : undefined;
  const bestProperty = bestListing
    ? PROPERTIES.find((p) => p.id === bestListing.propertyId)
    : undefined;

  return {
    unitType,
    availableCount: subset.length,
    avgRent: mean(rents),
    minRent: Math.min(...rents),
    maxRent: Math.max(...rents),
    avgSqft: mean(sqftValues),
    avgPricePerSqft: mean(perSqft),
    bestPricePerSqft:
      bestListing && bestProperty
        ? {
            propertyId: bestListing.propertyId,
            propertyName: bestProperty.name,
            rent: bestListing.rent,
            sqft: bestListing.sqft,
            pricePerSqft: bestListing.rent / bestListing.sqft,
          }
        : undefined,
    activeIncentiveCount: subset.filter((l) => l.incentive).length,
  };
}

export function summarizeAllUnitTypes(
  listings: Listing[],
): UnitTypeSummary[] {
  return UNIT_TYPES.map((t) => summarizeByUnitType(listings, t)).filter(
    (s): s is UnitTypeSummary => s !== null,
  );
}

export function summarizeByBuilding(listings: Listing[]): BuildingRow[] {
  const byProperty = new Map<string, Listing[]>();
  for (const l of listings) {
    const arr = byProperty.get(l.propertyId) ?? [];
    arr.push(l);
    byProperty.set(l.propertyId, arr);
  }

  return PROPERTIES.map((property) => {
    const propListings = byProperty.get(property.id) ?? [];
    const byUnitType: BuildingRow["byUnitType"] = {};

    for (const unitType of UNIT_TYPES) {
      const sub = propListings.filter((l) => l.unitType === unitType);
      if (sub.length === 0) continue;
      byUnitType[unitType] = {
        count: sub.length,
        avgRent: mean(sub.map((l) => l.rent)),
        minRent: Math.min(...sub.map((l) => l.rent)),
        avgSqft: mean(
          sub
            .filter((l): l is Listing & { sqft: number } => !!l.sqft)
            .map((l) => l.sqft),
        ),
      };
    }

    return {
      propertyId: property.id,
      propertyName: property.name,
      totalUnits: propListings.length,
      byUnitType,
      activeIncentiveCount: propListings.filter((l) => l.incentive).length,
    };
  });
}
