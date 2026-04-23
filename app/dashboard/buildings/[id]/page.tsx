/**
 * The drill-down page for a single building.
 *
 * You get here by clicking a building name on the main dashboard. The
 * page shows every available unit at that one building: rent, size,
 * price per square foot, and any promotion attached.
 *
 * At the top there's a summary strip with the building's total unit
 * count, average rent, and how many active promotions it has. The
 * unit list below is always sorted Bachelor → 1-Bed → 2-Bed → 3-Bed
 * (never alphabetical) so the layout stays predictable.
 *
 * If someone types a building name in the URL that doesn't exist,
 * they see a "not found" page instead of a crash.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatCAD,
  formatPricePerSqft,
  formatSqft,
  formatTimestamp,
  relativeTime,
} from "@/features/format";
import { getLastScrapedAt, getListings } from "@/features/listings";
import { getProperty } from "@/features/properties";
import { UNIT_TYPES } from "@/features/types";
import {
  COLORS,
  clayAccentBar,
  clayAccentBarShort,
  clayCardStripe,
  clayText,
  displayHeadline,
  labelItalic,
} from "@/features/ui-style";

export const dynamic = "force-dynamic";

export default async function BuildingDrillDown({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = getProperty(id);
  if (!property) notFound();

  const allListings = getListings();
  const listings = allListings
    .filter((l) => l.propertyId === id)
    .sort((a, b) => {
      const typeOrder =
        UNIT_TYPES.indexOf(a.unitType) - UNIT_TYPES.indexOf(b.unitType);
      if (typeOrder !== 0) return typeOrder;
      return a.rent - b.rent;
    });

  const lastScrapedAt = getLastScrapedAt();

  const totalRent = listings.reduce((a, l) => a + l.rent, 0);
  const avgRent = listings.length ? totalRent / listings.length : 0;
  const incentiveCount = listings.filter((l) => l.incentive).length;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/dashboard"
          className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ash hover:text-clay"
        >
          ← Back to overview
        </Link>
        <div className="mt-6 flex flex-col gap-3 border-b border-line pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span style={clayAccentBar} aria-hidden />
              <span style={{ ...labelItalic, fontSize: 14 }}>
                Building Detail
              </span>
            </div>
            <h1
              style={displayHeadline}
              className="headline mt-4 text-[4rem] sm:text-[5.5rem]"
            >
              {property.name}<span style={clayText}>.</span>
            </h1>
            <p style={{ ...labelItalic, fontSize: 16 }} className="mt-3">
              {property.address}
            </p>
          </div>
          <div
            className="text-right"
            title={lastScrapedAt ? formatTimestamp(lastScrapedAt) : "No scrape has been run yet"}
          >
            <div style={{ ...labelItalic, fontSize: 11 }}>
              Last scraped
            </div>
            <div
              style={{ color: COLORS.clay }}
              className="mt-1 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {lastScrapedAt ? relativeTime(lastScrapedAt) : "Never"}
            </div>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <section className="grid gap-5 sm:grid-cols-3">
        <div className="surface relative overflow-hidden p-7">
          <span style={clayCardStripe} aria-hidden />
          <div
            style={{ color: COLORS.clay }}
            className="text-xs font-black uppercase tracking-[0.2em]"
          >
            Available Units
          </div>
          <div className="mt-5 text-4xl font-black tracking-tight text-ink">
            {listings.length}
          </div>
        </div>
        <div className="surface relative overflow-hidden p-7">
          <span style={clayCardStripe} aria-hidden />
          <div
            style={{ color: COLORS.clay }}
            className="text-xs font-black uppercase tracking-[0.2em]"
          >
            Avg Monthly Rent
          </div>
          <div className="mt-5 text-4xl font-black tracking-tight text-ink">
            {listings.length ? formatCAD(avgRent) : "—"}
          </div>
        </div>
        <div className="surface relative overflow-hidden p-7">
          <span style={clayCardStripe} aria-hidden />
          <div
            style={{ color: COLORS.clay }}
            className="text-xs font-black uppercase tracking-[0.2em]"
          >
            Active Incentives
          </div>
          <div
            style={{ color: COLORS.clay }}
            className="mt-5 text-4xl font-black tracking-tight"
          >
            {incentiveCount}
          </div>
        </div>
      </section>

      {/* Unit list */}
      {listings.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-sm text-ash">
            No units available at {property.name} as of the last scrape.
          </p>
        </div>
      ) : (
        <section>
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span style={clayAccentBarShort} aria-hidden />
                <span style={{ ...labelItalic, fontSize: 14 }}>Listings</span>
              </div>
              <h2
                style={displayHeadline}
                className="headline mt-3 text-3xl sm:text-4xl"
              >
                Unit-level detail<span style={clayText}>.</span>
              </h2>
            </div>
            <p style={{ ...labelItalic, fontSize: 14 }}>
              Sorted by unit type · then rent
            </p>
          </div>

          <div className="overflow-x-auto surface">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-[0.18em]">
                <tr>
                  <th className="px-5 py-4 font-black text-ink">Unit ID</th>
                  <th className="px-5 py-4 font-black text-ink">Type</th>
                  <th className="px-5 py-4 text-right font-black text-ink">
                    Rent
                  </th>
                  <th className="px-5 py-4 text-right font-black text-ink">
                    Sqft
                  </th>
                  <th className="px-5 py-4 text-right font-black text-ink">
                    $/sqft
                  </th>
                  <th className="px-5 py-4 font-black text-ink">Incentive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {listings.map((l, i) => (
                  <tr
                    key={l.unitId ?? `${l.propertyId}-${l.unitType}-${i}`}
                    className="transition-colors hover:bg-clay-soft/40"
                  >
                    <td className="px-5 py-5 font-mono text-[11px] text-ash">
                      {l.unitId ?? "—"}
                    </td>
                    <td className="px-5 py-5 font-black uppercase tracking-[0.05em] text-ink">
                      {l.unitType}
                    </td>
                    <td className="px-5 py-5 text-right font-semibold text-ink">
                      {formatCAD(l.rent)}
                    </td>
                    <td className="px-5 py-5 text-right text-ink">
                      {formatSqft(l.sqft)}
                    </td>
                    <td className="px-5 py-5 text-right text-ink">
                      {l.sqft
                        ? formatPricePerSqft(l.rent / l.sqft)
                        : "—"}
                    </td>
                    <td className="px-5 py-5 text-xs text-ash">
                      {l.incentive ? (
                        <span
                          style={{
                            backgroundColor: "rgba(232, 74, 30, 0.12)",
                            color: COLORS.clayDeep,
                          }}
                          className="inline-flex items-center px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
                        >
                          {l.incentive}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
