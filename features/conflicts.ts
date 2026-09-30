import type { Listing } from "./types";

export type DataConflict = {
  field: "rent" | "availability" | "sqft" | "incentive";
  propertyId: string;
  unitId: string;
  values: Array<{ value: string | number; source?: string; timestamp?: string }>;
};

/** Only an explicit physical unit number can establish cross-source identity.
 * Legacy unitId values were generated counters; price/type/area are not identity.
 */
export function unitIdentity(listing: Listing): string | undefined {
  const unit = listing.unitNumber?.trim().toLowerCase();
  return unit ? `${listing.propertyId}|${unit}` : undefined;
}

export function detectConflicts(listings: Listing[]): DataConflict[] {
  const groups = new Map<string, Listing[]>();
  for (const listing of listings) {
    const key = unitIdentity(listing);
    if (key) groups.set(key, [...(groups.get(key) ?? []), listing]);
  }
  const conflicts: DataConflict[] = [];
  const fields = { rent: "rent", availability: "availability", sqft: "sqft", incentive: "incentive" } as const;
  for (const group of groups.values()) {
    for (const [field, key] of Object.entries(fields)) {
      const values = group.flatMap((listing) => {
        const value = listing[key];
        if (value === undefined || value === "" || (typeof value === "number" && !Number.isFinite(value))) return [];
        return [{ value, source: listing.sourceUrl ?? listing.floorplanUrl, timestamp: listing.scrapedAt }];
      });
      const distinct = new Set(values.map(({ value }) => typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : value));
      if (distinct.size > 1) conflicts.push({ field: field as DataConflict["field"], propertyId: group[0].propertyId, unitId: group[0].unitNumber!, values });
    }
  }
  return conflicts;
}
