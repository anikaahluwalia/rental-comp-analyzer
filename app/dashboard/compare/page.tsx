/**
 * The apples-to-apples comparison page.
 *
 * Most rental listings advertise a headline price, but buildings
 * competing for tenants often offer promotions like "1 month free" or
 * "$500 credit". This page does the math for you: every listing is
 * adjusted to show its real monthly cost after the promotion is spread
 * across a 12-month lease.
 *
 * That way, a unit advertised at $2,400/month with one month free
 * (real cost: $2,200) ranks above a unit advertised at $2,300/month
 * with no promotion — even though it looks more expensive at first
 * glance.
 *
 * The page shows three summary stats at the top (how many promotions
 * we could parse, the average discount, and the biggest single
 * monthly saving), then hands the unit-by-unit data to the interactive
 * comparison table below.
 */
import { enrichListings, type EnrichedListing } from "@/features/effective-rent";
import { formatCAD, formatTimestamp, relativeTime } from "@/features/format";
import { getLastScrapedAt, getListings } from "@/features/listings";
import { PROPERTIES } from "@/features/properties";
import { UNIT_TYPES, type UnitType } from "@/features/types";
import { CompareTable } from "@/interface/CompareTable";
import {
  COLORS,
  clayCardStripe,
  clayText,
  displayHeadline,
  labelItalic,
} from "@/features/ui-style";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const listings = getListings();
  const enriched = enrichListings(listings);
  const lastScrapedAt = getLastScrapedAt();

  // Headline stats: total incentives parsed vs. flagged
  const withIncentive = enriched.filter((l) => !!l.incentive);
  const parsed = withIncentive.filter((l) => l.effective.applied);
  const needsReview = withIncentive.filter(
    (l) => l.effective.discount.kind === "needs-review",
  );

  const avgEffectiveDiscount =
    parsed.length > 0
      ? parsed.reduce((a, l) => a + l.effective.effectiveDiscountPct, 0) /
        parsed.length
      : 0;

  // Biggest single gap between raw and effective rent.
  const biggestSwing = [...parsed].sort(
    (a, b) => b.effective.monthlySavings - a.effective.monthlySavings,
  )[0];

  // Build rowsByType
  const propertyName = (id: string) =>
    PROPERTIES.find((p) => p.id === id)?.name ?? id;

  const rowsByType: Partial<
    Record<UnitType, Array<EnrichedListing & { propertyName: string }>>
  > = {};
  for (const t of UNIT_TYPES) {
    const rows = enriched
      .filter((l) => l.unitType === t)
      .map((l) => ({ ...l, propertyName: propertyName(l.propertyId) }));
    if (rows.length > 0) rowsByType[t] = rows;
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-4 border-b border-line pb-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            style={displayHeadline}
            className="headline text-[4rem] sm:text-[5.5rem]"
          >
            Effective
            <br />
            rent<span style={clayText}>.</span>
          </h1>
        </div>
        <div
          className="text-right"
          title={lastScrapedAt ? formatTimestamp(lastScrapedAt) : "No scrape has been run yet"}
        >
          <div style={{ ...labelItalic, fontSize: 11 }}>Last scraped</div>
          <div
            style={{ color: COLORS.clay }}
            className="mt-1 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {lastScrapedAt ? relativeTime(lastScrapedAt) : "Never"}
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
            Incentives parsed
          </div>
          <div className="mt-5 text-4xl font-black tracking-tight text-ink">
            {parsed.length}
            <span className="text-xl text-ash">
              {withIncentive.length > 0
                ? ` / ${withIncentive.length}`
                : ""}
            </span>
          </div>
          <div style={{ ...labelItalic, fontSize: 12 }} className="mt-2">
            {needsReview.length > 0
              ? `${needsReview.length} flagged for manual review`
              : "No ambiguous incentives in this snapshot"}
          </div>
        </div>
        <div className="surface relative overflow-hidden p-7">
          <span style={clayCardStripe} aria-hidden />
          <div
            style={{ color: COLORS.clay }}
            className="text-xs font-black uppercase tracking-[0.2em]"
          >
            Avg effective discount
          </div>
          <div
            style={{ color: COLORS.clay }}
            className="mt-5 text-4xl font-black tracking-tight"
          >
            {parsed.length > 0
              ? `${(avgEffectiveDiscount * 100).toFixed(1)}%`
              : "—"}
          </div>
          <div style={{ ...labelItalic, fontSize: 12 }} className="mt-2">
            Across units with parseable promos
          </div>
        </div>
        <div className="surface relative overflow-hidden p-7">
          <span style={clayCardStripe} aria-hidden />
          <div
            style={{ color: COLORS.clay }}
            className="text-xs font-black uppercase tracking-[0.2em]"
          >
            Biggest monthly swing
          </div>
          <div
            style={{ color: COLORS.clay }}
            className="mt-5 text-4xl font-black tracking-tight"
          >
            {biggestSwing
              ? `−${formatCAD(biggestSwing.effective.monthlySavings)}`
              : "—"}
          </div>
          <div style={{ ...labelItalic, fontSize: 12 }} className="mt-2">
            {biggestSwing
              ? `${propertyName(biggestSwing.propertyId)} · ${biggestSwing.unitType}`
              : "—"}
          </div>
        </div>
      </section>

      {/* Plain-English explainer of how the real monthly cost is figured out */}
      <aside
        style={{ borderLeft: `4px solid ${COLORS.clay}` }}
        className="bg-white p-6 text-sm leading-relaxed text-ink"
      >
        <div className="text-xs font-black uppercase tracking-[0.2em] text-ink">
          How we normalize
        </div>
        <p
          style={{ ...labelItalic, color: COLORS.ink, fontSize: 16 }}
          className="mt-3 leading-relaxed"
        >
          Landlords often sweeten the sticker price with perks like &ldquo;1
          month free&rdquo; or &ldquo;$500 off.&rdquo; The real monthly cost
          isn&apos;t what&apos;s on the ad.
        </p>
        <p className="mt-3">
          Take a $2,400/month unit with 1 month free — you only actually pay
          for 11 months of the year, which works out to about $2,200/month
          when you spread it across the full lease. We do that math on every
          listing so you can compare real cost to real cost.
        </p>
        <p className="mt-3">
          Perks that are hard to put a dollar amount on — parking, waived
          locker fees, move-in bonuses — get flagged{" "}
          <span style={{ color: COLORS.clay, fontWeight: 700 }}>
            review needed
          </span>{" "}
          instead of being counted as a discount, so we don&apos;t promise
          savings we can&apos;t actually prove.
        </p>
      </aside>

      <CompareTable rowsByType={rowsByType} />
    </div>
  );
}
