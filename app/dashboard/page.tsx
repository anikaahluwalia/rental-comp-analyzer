/**
 * The main dashboard — the page you land on after signing in.
 *
 * Three sections, top to bottom:
 *   1. A header with the market snapshot, plus the "Scrape now" and
 *      "Export PDF" buttons (only visible if your role allows).
 *   2. Four summary cards — one per unit type (Bachelor, 1-Bed, 2-Bed,
 *      3-Bed) — showing average rent, range, and the best-value
 *      building for that unit type.
 *   3. A per-building table with averages for each unit type and a
 *      link to drill into any individual building.
 *
 * Shows the latest data every time — if someone just ran a scrape, the
 * new numbers appear on the next refresh. If no scrape has ever been
 * run, the page shows a friendly "click Scrape now to get started"
 * empty state instead of a blank screen.
 */
import Link from "next/link";
import { can, getSession } from "@/features/auth";
import {
  summarizeAllUnitTypes,
  summarizeByBuilding,
} from "@/features/consolidation";
import {
  formatCAD,
  formatPricePerSqft,
  formatSqft,
  formatTimestamp,
  relativeTime,
} from "@/features/format";
import { getLastScrapedAt, getListings } from "@/features/listings";
import { PROPERTIES } from "@/features/properties";
import { UNIT_TYPES } from "@/features/types";
import { ScrapeNowButton } from "@/interface/ScrapeNowButton";
import { ExportPdfButton } from "@/interface/ExportPdfButton";
import {
  COLORS,
  clayAccentBar,
  clayAccentBarShort,
  clayCardStripe,
  clayDot,
  clayText,
  clayTextBold,
  displayHeadline,
  labelItalic,
} from "@/features/ui-style";

// Force dynamic rendering so the in-memory store is read fresh on each
// request (otherwise Next's caching can serve stale data after a scrape).
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getSession();
  const listings = getListings();
  const lastScrapedAt = getLastScrapedAt();
  const neverScraped = lastScrapedAt === null;

  const unitSummaries = summarizeAllUnitTypes(listings);
  const byBuilding = summarizeByBuilding(listings);

  const totalIncentives = listings.filter((l) => l.incentive).length;

  return (
    <div className="space-y-14">
      {/* Header + scrape trigger */}
      <section className="flex flex-col gap-8 border-b border-line pb-12 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span style={clayAccentBar} aria-hidden />
            <span style={{ ...labelItalic, fontSize: 14 }}>
              Market Snapshot
            </span>
          </div>
          <h1
            style={displayHeadline}
            className="headline mt-4 text-[4.5rem] sm:text-[6rem]"
          >
            Midtown
            <br />
            Toronto<span style={clayText}>.</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-ash">
            <span className="font-semibold text-ink">{listings.length}</span>{" "}
            available units
            <span style={clayDot}>·</span>
            <span className="font-semibold text-ink">
              {PROPERTIES.length}
            </span>{" "}
            competing buildings
            <span style={clayDot}>·</span>
            <span style={clayTextBold}>{totalIncentives}</span>{" "}
            active incentive{totalIncentives === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
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
          <div className="flex flex-col items-end gap-3">
            {can(session, "exportPdf") ? <ExportPdfButton /> : null}
            {can(session, "triggerScrape") ? (
              <ScrapeNowButton />
            ) : (
              <div className="max-w-xs text-right text-xs text-ash/80">
                Read-only access — analyst role required to trigger scrapes.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Empty state — shown when there's no data to summarize yet */}
      {listings.length === 0 ? (
        <section className="surface p-10">
          <span style={clayCardStripe} aria-hidden />
          <div className="flex items-center gap-3">
            <span style={clayAccentBarShort} aria-hidden />
            <span style={{ ...labelItalic, fontSize: 14 }}>
              {neverScraped ? "No data yet" : "Last scrape returned no listings"}
            </span>
          </div>
          <h2
            style={displayHeadline}
            className="headline mt-4 text-3xl sm:text-4xl"
          >
            {neverScraped
              ? "Run your first scrape."
              : "Sources returned nothing."}
            <span style={clayText}>.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ash">
            {neverScraped ? (
              <>
                This server has no snapshot on disk yet. Click{" "}
                <span style={clayTextBold}>Scrape now</span> above to pull
                pricing from each building's own official marketing site
                plus rentals.ca for secondary coverage. A scrape typically
                takes 3–4 minutes and uses ~40 Firecrawl credits across
                all {PROPERTIES.length} buildings.
              </>
            ) : (
              <>
                The most recent scrape completed but every building returned
                zero listings — likely an upstream block, rate limit, or
                parser regression. Check the per-building runs below and
                click <span style={clayTextBold}>Scrape now</span> to retry.
                The app intentionally does not fall back to synthetic data
                so you can see the failure honestly.
              </>
            )}
          </p>
        </section>
      ) : null}

      {/* Unit-type summary cards */}
      <section>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span style={clayAccentBarShort} aria-hidden />
              <span style={{ ...labelItalic, fontSize: 14 }}>By Unit Type</span>
            </div>
            <h2
              style={displayHeadline}
              className="headline mt-3 text-4xl sm:text-5xl"
            >
              Consolidated performance<span style={clayText}>.</span>
            </h2>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {unitSummaries.map((s) => (
            <article
              key={s.unitType}
              className="group surface relative overflow-hidden p-7 transition-all hover:border-clay"
            >
              {/* Clay accent strip along the top */}
              <span style={clayCardStripe} aria-hidden />
              <div className="flex items-center justify-between">
                <div
                  style={{ color: COLORS.clay }}
                  className="text-xs font-black uppercase tracking-[0.2em]"
                >
                  {s.unitType}
                </div>
                <div style={{ ...labelItalic, fontSize: 12 }}>
                  {s.availableCount} unit{s.availableCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="mt-6 text-4xl font-black tracking-tight text-ink">
                {formatCAD(s.avgRent)}
              </div>
              <div style={{ ...labelItalic, fontSize: 12 }} className="mt-1">
                Avg monthly rent
              </div>

              <dl className="mt-6 space-y-2 border-t border-line pt-4 text-xs">
                <div className="flex justify-between">
                  <dt style={labelItalic}>Avg $/sqft</dt>
                  <dd className="font-semibold text-ink">
                    {formatPricePerSqft(s.avgPricePerSqft)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={labelItalic}>Range</dt>
                  <dd className="font-semibold text-ink">
                    {formatCAD(s.minRent)} – {formatCAD(s.maxRent)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={labelItalic}>Avg sqft</dt>
                  <dd className="font-semibold text-ink">
                    {formatSqft(s.avgSqft)}
                  </dd>
                </div>
              </dl>

              {s.bestPricePerSqft ? (
                <div className="mt-4 border-t border-line pt-4">
                  <div
                    style={{ ...labelItalic, color: COLORS.clay, fontSize: 11 }}
                  >
                    Best $/sqft
                  </div>
                  <Link
                    href={`/dashboard/buildings/${s.bestPricePerSqft.propertyId}`}
                    className="mt-1 block text-xs text-ink hover:text-clay"
                  >
                    <span className="font-semibold uppercase tracking-[0.05em]">
                      {s.bestPricePerSqft.propertyName}
                    </span>{" "}
                    <span className="text-ash">
                      — {formatCAD(s.bestPricePerSqft.rent)} ·{" "}
                      {formatPricePerSqft(s.bestPricePerSqft.pricePerSqft)}
                    </span>
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* Buildings × unit types matrix */}
      <section>
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <span style={clayAccentBarShort} aria-hidden />
            <span style={{ ...labelItalic, fontSize: 14 }}>By Building</span>
          </div>
          <h2
            style={displayHeadline}
            className="headline mt-3 text-4xl sm:text-5xl"
          >
            Per-property breakdown<span style={clayText}>.</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ash">
            Click any building to drill down to unit-level listings.
          </p>
        </div>

        <div className="overflow-x-auto surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.18em] text-ash">
              <tr>
                <th className="px-5 py-4 font-black text-ink">Building</th>
                <th className="px-5 py-4 text-right font-black text-ink">
                  Units
                </th>
                {UNIT_TYPES.map((t) => (
                  <th
                    key={t}
                    className="px-5 py-4 text-right font-black text-ink"
                  >
                    {t}
                  </th>
                ))}
                <th className="px-5 py-4 text-right font-black text-ink">
                  Incentives
                </th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byBuilding.map((row) => (
                <tr
                  key={row.propertyId}
                  className="transition-colors hover:bg-clay-soft/40"
                >
                  <td className="px-5 py-5 font-black uppercase tracking-[0.05em] text-ink">
                    {row.propertyName}
                  </td>
                  <td className="px-5 py-5 text-right text-ink">
                    {row.totalUnits}
                  </td>
                  {UNIT_TYPES.map((t) => {
                    const cell = row.byUnitType[t];
                    return (
                      <td key={t} className="px-5 py-5 text-right text-ink">
                        {cell ? (
                          <div>
                            <div className="font-semibold">
                              {formatCAD(cell.avgRent)}
                            </div>
                            <div style={{ ...labelItalic, fontSize: 11 }}>
                              ×{cell.count}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ash/40">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-5 py-5 text-right text-ink">
                    {row.activeIncentiveCount > 0 ? (
                      <span
                        style={{
                          backgroundColor: "rgba(232, 74, 30, 0.12)",
                          color: COLORS.clayDeep,
                        }}
                        className="inline-flex items-center px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
                      >
                        {row.activeIncentiveCount} active
                      </span>
                    ) : (
                      <span className="text-ash/40">—</span>
                    )}
                  </td>
                  <td className="px-5 py-5 text-right">
                    <Link
                      href={`/dashboard/buildings/${row.propertyId}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink underline decoration-clay decoration-2 underline-offset-[5px] hover:text-clay"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
