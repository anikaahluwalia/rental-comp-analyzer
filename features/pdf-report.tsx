/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  BuildingRow,
  UnitTypeSummary,
} from "./consolidation";
import { UNIT_TYPES, type Listing, type UnitType } from "./types";
import { formatCAD, formatPricePerSqft, formatSqft } from "./format";
import { enrichListings, type EnrichedListing } from "./effective-rent";
import { PROPERTIES } from "./properties";

/**
 * Rental Comp PDF report.
 *
 * Rendered server-side via `@react-pdf/renderer`, which doesn't need
 * Chromium — smaller deploy footprint than a Puppeteer-based pipeline and
 * it renders deterministically (good for regression testing).
 *
 * Layout:
 *   Page 1 — Executive insights (headline KPIs + numbered observations)
 *   Page 2 — Consolidated view (avg $/sqft chart + per-unit-type rollup +
 *            per-building breakdown)
 *   Page 3 — Next Steps: per-unit-type pricing recommendations (what to
 *            charge, with reasoning drawn from the effective-rent comp set)
 *
 * Deliberately no "about the project / methodology" page — the report
 * should read like a pricing deliverable, not a tool writeup.
 */

// --- Brand palette — matched against the Fitzrovia Intern Case Study PDF.
// Navy is the structural primary (H1, H2, table headers, wordmark); the
// coral "clay" is used sparingly for sub-heading accents, the F-mark bottom
// band, and chart highlights. White canvas, striped table rows.

const BRAND = {
  paper: "#FFFFFF",
  navy: "#1E3A52",
  navyDeep: "#12283A",
  clay: "#E84A1E",
  clayDeep: "#C13A12",
  ink: "#1A1A1A",
  ash: "#6B6B6B",
  line: "#D9DCE0",
  stripe: "#F0F4F7",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingHorizontal: 54,
    paddingBottom: 44,
    backgroundColor: BRAND.paper,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.ink,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 1.5,
    color: BRAND.navy,
  },
  // "Eyebrow" above the title — italic serif grey, matches
  // "AI & Software Development | Rental Comp Scraper" in the case study.
  eyebrow: {
    fontFamily: "Times-Italic",
    fontSize: 10,
    color: BRAND.ash,
    marginTop: 4,
  },
  // Big navy H1 — matches "Intern Case Study" treatment.
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 30,
    color: BRAND.navy,
    letterSpacing: -0.5,
  },
  // Thin navy rule that sits under the subtitle on the cover.
  titleRule: {
    height: 1.2,
    backgroundColor: BRAND.navy,
    marginTop: 8,
    marginBottom: 18,
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: BRAND.navy,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  // Sub-section heading — clay/coral, matches "Target Properties",
  // "What to Scrape", "What to Build" in the case study.
  sectionLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: BRAND.clay,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: BRAND.ash,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.55,
    color: BRAND.ink,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND.line,
    padding: 12,
    backgroundColor: BRAND.paper,
  },
  kpiLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: BRAND.navy,
  },
  kpiValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: BRAND.navy,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  kpiFoot: {
    fontFamily: "Times-Italic",
    fontSize: 9,
    color: BRAND.ash,
    marginTop: 4,
  },
  insightList: {
    marginBottom: 14,
  },
  insightItem: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.line,
  },
  insightBullet: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: BRAND.clay,
    width: 22,
  },
  insightText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: BRAND.ink,
  },
  section: { marginBottom: 16 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: BRAND.navy,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeadText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.6,
    color: BRAND.paper,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tableRowAlt: {
    backgroundColor: BRAND.stripe,
  },
  tableCell: { fontSize: 9, color: BRAND.ink },
  footerBar: {
    position: "absolute",
    bottom: 20,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: BRAND.ash,
  },
});

// --- Fitzrovia F-mark ------------------------------------------------
//
// Drawn using primitive Views to approximate the logo from the case study:
// a chunky navy "F" whose bottom bar is coral clay. Not pixel-perfect,
// but carries the brand signal on every page.

function FitzroviaLogoMark({ size = 32 }: { size?: number }) {
  const stem = Math.max(5, Math.round(size * 0.19));
  const bar = Math.max(5, Math.round(size * 0.17));
  const topBarW = Math.round(size * 0.82);
  const midBarW = Math.round(size * 0.62);
  const bottomBarW = Math.round(size * 0.68);

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      {/* Vertical stem */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: stem,
          height: size,
          backgroundColor: BRAND.navy,
        }}
      />
      {/* Top bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: topBarW,
          height: bar,
          backgroundColor: BRAND.navy,
        }}
      />
      {/* Middle bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: Math.round(size * 0.42),
          width: midBarW,
          height: bar,
          backgroundColor: BRAND.navy,
        }}
      />
      {/* Signature clay bottom band */}
      <View
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: bottomBarW,
          height: bar,
          backgroundColor: BRAND.clay,
        }}
      />
    </View>
  );
}

function BrandHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <FitzroviaLogoMark size={26} />
        <Text style={styles.brandMark}>FITZROVIA</Text>
      </View>
      {rightSlot}
    </View>
  );
}

// --- Helpers -----------------------------------------------------------

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function computeInsights(
  unitSummaries: UnitTypeSummary[],
  byBuilding: BuildingRow[],
  listings: Listing[],
): string[] {
  const insights: string[] = [];

  // Insight 1: Tightest spread unit type
  const spreads = unitSummaries.map((s) => ({
    unitType: s.unitType,
    spreadPct: s.minRent > 0 ? ((s.maxRent - s.minRent) / s.minRent) * 100 : 0,
    min: s.minRent,
    max: s.maxRent,
  }));
  const widest = [...spreads].sort((a, b) => b.spreadPct - a.spreadPct)[0];
  if (widest) {
    insights.push(
      `${widest.unitType} pricing spans ${formatCAD(widest.min)}–${formatCAD(widest.max)} — a ${widest.spreadPct.toFixed(0)}% spread, the widest of any unit type and a signal that positioning within this cohort matters most.`,
    );
  }

  // Insight 2: Best per-sqft value
  const perSqftByType = unitSummaries
    .filter((s) => s.bestPricePerSqft)
    .sort(
      (a, b) =>
        (a.bestPricePerSqft!.pricePerSqft) -
        (b.bestPricePerSqft!.pricePerSqft),
    );
  const bestValue = perSqftByType[0];
  if (bestValue?.bestPricePerSqft) {
    insights.push(
      `${bestValue.bestPricePerSqft.propertyName} leads on $/sqft efficiency in the ${bestValue.unitType} category at ${formatPricePerSqft(bestValue.bestPricePerSqft.pricePerSqft)} — a reference point for our own pricing committee.`,
    );
  }

  // Insight 3: Biggest effective-rent gap (headline vs. incentive-adjusted)
  const enriched = enrichListings(listings);
  const appliedOnly = enriched.filter((l) => l.effective.applied);
  const biggestSwing = [...appliedOnly].sort(
    (a, b) => b.effective.monthlySavings - a.effective.monthlySavings,
  )[0];
  if (biggestSwing) {
    const bldg =
      PROPERTIES.find((p) => p.id === biggestSwing.propertyId)?.name ??
      biggestSwing.propertyId;
    insights.push(
      `Effective rent opens the widest gap at ${bldg}: a ${biggestSwing.unitType} posts at ${formatCAD(biggestSwing.rent)} but lands at ${formatCAD(biggestSwing.effective.effectiveRent)}/mo once "${biggestSwing.incentive}" is amortized over 12 months — a ${(biggestSwing.effective.effectiveDiscountPct * 100).toFixed(1)}% effective discount vs. the headline number.`,
    );
  }

  // Insight 4: Incentive pressure
  const totalIncentives = listings.filter((l) => l.incentive).length;
  const incentiveRate = listings.length
    ? (totalIncentives / listings.length) * 100
    : 0;
  const topIncentiveBldg = [...byBuilding].sort(
    (a, b) => b.activeIncentiveCount - a.activeIncentiveCount,
  )[0];
  if (totalIncentives > 0) {
    insights.push(
      `${totalIncentives} active incentive${totalIncentives === 1 ? "" : "s"} across ${byBuilding.length} buildings (${incentiveRate.toFixed(0)}% of available units)${topIncentiveBldg && topIncentiveBldg.activeIncentiveCount > 0 ? `, concentrated at ${topIncentiveBldg.propertyName}` : ""}. Watch this as a leading indicator for headline-rent compression.`,
    );
  } else {
    insights.push(
      "No active incentives detected — pricing is holding on headline rent. Expect this to break first in the 2-Bed cohort where days-on-market is typically longest.",
    );
  }

  // Insight 5: Inventory concentration
  const inventoryLeader = [...byBuilding].sort(
    (a, b) => b.totalUnits - a.totalUnits,
  )[0];
  if (inventoryLeader) {
    insights.push(
      `${inventoryLeader.propertyName} is the largest single source of current supply with ${inventoryLeader.totalUnits} available units — worth a dedicated deep-dive on absorption rate.`,
    );
  }

  return insights;
}

// --- $/sqft bar chart via @react-pdf View primitives -------------------
//
// We used to render this as <Svg> with absolutely-positioned <Text> labels.
// Inside <Svg>, @react-pdf expects SVG-native x/y attributes; CSS
// positioning silently collapses every label onto (0,0), producing a
// pile of stacked characters. Rebuilding with plain <View>/<Text> +
// flexbox is more reliable and renders deterministically across platforms.

type ChartDatum = { label: string; value: number };

function BarChart({
  data,
  maxValue,
}: {
  data: ChartDatum[];
  maxValue: number;
}) {
  const plotHeight = 100;
  const yTicks = 4;

  // Gridline values, top-to-bottom.
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    return maxValue - (maxValue * i) / yTicks;
  });

  return (
    <View style={{ flexDirection: "row" }} wrap={false}>
      {/* Y-axis labels — flex column so they align with gridlines. */}
      <View
        style={{
          width: 42,
          height: plotHeight,
          justifyContent: "space-between",
          paddingRight: 6,
        }}
      >
        {ticks.map((v, i) => (
          <Text
            key={`tick-${i}`}
            style={{
              fontSize: 7,
              color: BRAND.ash,
              textAlign: "right",
            }}
          >
            ${v.toFixed(2)}
          </Text>
        ))}
      </View>

      {/* Plot area */}
      <View style={{ flex: 1 }}>
        {/* Gridlines + bars in the same absolute-positioned container. */}
        <View
          style={{
            position: "relative",
            height: plotHeight,
            borderLeftWidth: 1,
            borderLeftColor: BRAND.ink,
            borderBottomWidth: 1,
            borderBottomColor: BRAND.ink,
          }}
        >
          {/* Gridlines (skip the bottom one — the border draws it). */}
          {ticks.slice(0, -1).map((_, i) => (
            <View
              key={`grid-${i}`}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: (plotHeight * i) / yTicks,
                height: 0.5,
                backgroundColor: BRAND.line,
              }}
            />
          ))}

          {/* Bars — flex row, bottom-aligned. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-around",
              height: plotHeight,
              paddingHorizontal: 8,
            }}
          >
            {data.map((d) => {
              const h = maxValue > 0 ? (d.value / maxValue) * plotHeight : 0;
              return (
                <View
                  key={d.label}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    marginHorizontal: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 7,
                      color: BRAND.navy,
                      fontFamily: "Helvetica-Bold",
                      marginBottom: 3,
                    }}
                  >
                    ${d.value.toFixed(2)}
                  </Text>
                  <View
                    style={{
                      width: "100%",
                      height: h,
                      backgroundColor: BRAND.navy,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* X-axis labels */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: 8,
            paddingTop: 6,
          }}
        >
          {data.map((d) => (
            <View
              key={`label-${d.label}`}
              style={{ flex: 1, marginHorizontal: 6 }}
            >
              <Text
                style={{
                  fontSize: 8,
                  color: BRAND.ink,
                  textAlign: "center",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {d.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// --- Pricing recommendations -----------------------------------------
//
// Turns the comp-set into a "what should we charge?" answer. For each
// unit type with comps, we compute percentiles over *effective* rents
// (post-incentive amortization) and surface three tiers:
//
//   - Aggressive  → p25 of effective rents. Undercut market to win the
//                   lease-up race. Makes sense when days-on-market is
//                   trending up or when the operator cares more about
//                   velocity than top-line.
//   - Market      → median effective rent. Default landing point — mirror
//                   what the competitive set is actually transacting at
//                   after incentives.
//   - Premium     → p75 of effective rents. Tests the top of the stack.
//                   Only defensible with a unit-level quality edge
//                   (newer finishes, better view, bigger sqft, etc.).
//
// All three are rounded to the nearest $25 so the recommendation looks
// like a pricing decision, not a statistics output.

type PricingRec = {
  unitType: UnitType;
  sampleSize: number;
  medianHeadline: number;
  medianEffective: number;
  p25Effective: number;
  p75Effective: number;
  aggressive: number;
  market: number;
  premium: number;
  rationale: string;
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const w = idx - lo;
  return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}

function roundTo25(n: number): number {
  return Math.round(n / 25) * 25;
}

function buildRationale(
  unitType: UnitType,
  forType: EnrichedListing[],
  medianHeadline: number,
  medianEffective: number,
  minRent: number,
  maxRent: number,
): string {
  const gap = medianHeadline - medianEffective;
  const gapPct = medianHeadline > 0 ? (gap / medianHeadline) * 100 : 0;
  const spreadPct = minRent > 0 ? ((maxRent - minRent) / minRent) * 100 : 0;
  const incentiveCount = forType.filter((l) => l.incentive).length;
  const incentiveRate = forType.length
    ? (incentiveCount / forType.length) * 100
    : 0;

  if (forType.length < 3) {
    return `Thin ${unitType} sample (${forType.length} comp${forType.length === 1 ? "" : "s"}) — treat these tiers as directional and re-price once the comp set deepens.`;
  }
  if (gapPct > 3) {
    return `${incentiveRate.toFixed(0)}% of ${unitType} comps carry incentives; effective rents sit ${gapPct.toFixed(1)}% below headline. Post the Market tier as headline and match the comp-set's effective economics on the incentive side.`;
  }
  if (spreadPct > 25) {
    return `Wide ${unitType} spread (${spreadPct.toFixed(0)}% between low and high comps) — positioning matters more than the average. Push toward Premium only with a defensible unit-quality story.`;
  }
  return `Tight ${unitType} cohort (${spreadPct.toFixed(0)}% spread, ${incentiveRate.toFixed(0)}% incentive rate) — stable pricing environment. Market tier is the safest landing.`;
}

function computePricingRecommendations(
  unitSummaries: UnitTypeSummary[],
  listings: Listing[],
): PricingRec[] {
  const enriched = enrichListings(listings);

  return unitSummaries
    .filter((s) => s.availableCount > 0)
    .map((s) => {
      const forType = enriched.filter((l) => l.unitType === s.unitType);
      const effectives = forType
        .map((l) => l.effective.effectiveRent)
        .sort((a, b) => a - b);
      const headlines = forType.map((l) => l.rent).sort((a, b) => a - b);

      const medianHeadline = percentile(headlines, 0.5);
      const medianEffective = percentile(effectives, 0.5);
      const p25Effective = percentile(effectives, 0.25);
      const p75Effective = percentile(effectives, 0.75);

      return {
        unitType: s.unitType,
        sampleSize: s.availableCount,
        medianHeadline,
        medianEffective,
        p25Effective,
        p75Effective,
        aggressive: roundTo25(p25Effective),
        market: roundTo25(medianEffective),
        premium: roundTo25(p75Effective),
        rationale: buildRationale(
          s.unitType,
          forType,
          medianHeadline,
          medianEffective,
          s.minRent,
          s.maxRent,
        ),
      };
    });
}

// --- Report document ---------------------------------------------------

export type RentalCompReportProps = {
  listings: Listing[];
  unitSummaries: UnitTypeSummary[];
  byBuilding: BuildingRow[];
  generatedAt: Date;
  lastScrapedAt: string;
};

export function RentalCompReport({
  listings,
  unitSummaries,
  byBuilding,
  generatedAt,
  lastScrapedAt,
}: RentalCompReportProps) {
  const totalUnits = listings.length;
  const totalBuildings = byBuilding.filter((b) => b.totalUnits > 0).length;
  const avgMonthlyRent =
    totalUnits > 0
      ? listings.reduce((a, l) => a + l.rent, 0) / totalUnits
      : 0;
  const insights = computeInsights(unitSummaries, byBuilding, listings);

  const chartData: ChartDatum[] = unitSummaries.map((s) => ({
    label: s.unitType,
    value: Number(s.avgPricePerSqft.toFixed(2)),
  }));
  const maxChart = chartData.length
    ? Math.ceil(Math.max(...chartData.map((d) => d.value)) * 1.15 * 10) / 10
    : 5;

  const pricingRecs = computePricingRecommendations(unitSummaries, listings);

  return (
    <Document
      title={`Fitzrovia Rental Comp — ${formatDateLong(generatedAt)}`}
      author="Fitzrovia Asset Management"
      subject="Midtown Toronto competitive set"
    >
      {/* --- Page 1: Cover + executive summary ------------------------ */}
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          rightSlot={
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{ fontSize: 7, color: BRAND.ash, letterSpacing: 1.2 }}
              >
                REPORT DATE
              </Text>
              <Text
                style={{
                  fontFamily: "Helvetica-Bold",
                  fontSize: 10,
                  color: BRAND.navy,
                  marginTop: 2,
                }}
              >
                {formatDateLong(generatedAt)}
              </Text>
            </View>
          }
        />

        <View>
          <Text style={styles.eyebrow}>Asset Management | Rental Comp</Text>
          <Text style={styles.title}>Midtown Toronto</Text>
          <Text style={[styles.subtitle, { marginTop: 6 }]}>
            Competitive-set pricing across {totalBuildings} building
            {totalBuildings === 1 ? "" : "s"} · {totalUnits} available units ·
            data scraped{" "}
            {new Date(lastScrapedAt).toLocaleString("en-CA", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>
          <View style={styles.titleRule} />
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Available Units</Text>
            <Text style={styles.kpiValue}>{totalUnits}</Text>
            <Text style={styles.kpiFoot}>
              across {totalBuildings} buildings
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Monthly Rent</Text>
            <Text style={styles.kpiValue}>{formatCAD(avgMonthlyRent)}</Text>
            <Text style={styles.kpiFoot}>weighted across all unit types</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Incentives</Text>
            <Text style={styles.kpiValue}>
              {listings.filter((l) => l.incentive).length}
            </Text>
            <Text style={styles.kpiFoot}>
              {listings.length > 0
                ? `${Math.round((listings.filter((l) => l.incentive).length / listings.length) * 100)}% of units`
                : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Executive Insights</Text>
        <View style={styles.insightList}>
          {insights.map((msg, i) => (
            <View key={i} style={styles.insightItem}>
              <Text style={styles.insightBullet}>
                0{i + 1}
              </Text>
              <Text style={styles.insightText}>{msg}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerBar} fixed>
          <Text>Fitzrovia Rental Comp · Confidential</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* --- Page 2: Chart + per-unit-type + per-building breakdown -- */}
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          rightSlot={
            <Text
              style={{ fontSize: 7, color: BRAND.ash, letterSpacing: 1.2 }}
            >
              UNIT-TYPE & BUILDING ROLLUP
            </Text>
          }
        />

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionLabel}>Avg $/Sqft by Unit Type</Text>
          <Text style={styles.h2}>Price-Efficiency Curve</Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: BRAND.line,
              backgroundColor: "#FFFFFF",
              padding: 14,
            }}
          >
            <BarChart data={chartData} maxValue={maxChart} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Unit-Type Performance</Text>
          <Text style={styles.h2}>Consolidated Rollup</Text>

          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadText, { flex: 1.2 }]}>Type</Text>
            <Text
              style={[styles.tableHeadText, { flex: 0.8, textAlign: "right" }]}
            >
              Units
            </Text>
            <Text
              style={[styles.tableHeadText, { flex: 1.2, textAlign: "right" }]}
            >
              Avg Rent
            </Text>
            <Text
              style={[styles.tableHeadText, { flex: 1.3, textAlign: "right" }]}
            >
              Range
            </Text>
            <Text
              style={[styles.tableHeadText, { flex: 1, textAlign: "right" }]}
            >
              Avg $/sqft
            </Text>
            <Text
              style={[styles.tableHeadText, { flex: 1, textAlign: "right" }]}
            >
              Avg sqft
            </Text>
          </View>
          {unitSummaries.map((s, i) => (
            <View
              key={s.unitType}
              style={[
                styles.tableRow,
                i % 2 === 1 ? styles.tableRowAlt : {},
              ]}
            >
              <Text
                style={[
                  styles.tableCell,
                  {
                    flex: 1.2,
                    fontFamily: "Helvetica-Bold",
                    color: BRAND.navy,
                  },
                ]}
              >
                {s.unitType}
              </Text>
              <Text
                style={[styles.tableCell, { flex: 0.8, textAlign: "right" }]}
              >
                {s.availableCount}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  {
                    flex: 1.2,
                    textAlign: "right",
                    fontFamily: "Helvetica-Bold",
                  },
                ]}
              >
                {formatCAD(s.avgRent)}
              </Text>
              <Text
                style={[styles.tableCell, { flex: 1.3, textAlign: "right" }]}
              >
                {formatCAD(s.minRent)} – {formatCAD(s.maxRent)}
              </Text>
              <Text
                style={[styles.tableCell, { flex: 1, textAlign: "right" }]}
              >
                {formatPricePerSqft(s.avgPricePerSqft)}
              </Text>
              <Text
                style={[styles.tableCell, { flex: 1, textAlign: "right" }]}
              >
                {formatSqft(s.avgSqft)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Per-Building Breakdown</Text>
          <Text style={styles.h2}>Average Rent by Unit Type</Text>

          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadText, { flex: 2 }]}>Building</Text>
            <Text
              style={[styles.tableHeadText, { flex: 0.8, textAlign: "right" }]}
            >
              Units
            </Text>
            {UNIT_TYPES.map((t) => (
              <Text
                key={t}
                style={[styles.tableHeadText, { flex: 1.1, textAlign: "right" }]}
              >
                {t}
              </Text>
            ))}
            <Text
              style={[styles.tableHeadText, { flex: 1, textAlign: "right" }]}
            >
              Incentives
            </Text>
          </View>

          {byBuilding
            .filter((b) => b.totalUnits > 0)
            .map((row, i) => (
              <View
                key={row.propertyId}
                style={[
                  styles.tableRow,
                  i % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 2,
                      fontFamily: "Helvetica-Bold",
                      color: BRAND.navy,
                    },
                  ]}
                >
                  {row.propertyName}
                </Text>
                <Text
                  style={[styles.tableCell, { flex: 0.8, textAlign: "right" }]}
                >
                  {row.totalUnits}
                </Text>
                {UNIT_TYPES.map((t: UnitType) => {
                  const cell = row.byUnitType[t];
                  return (
                    <Text
                      key={t}
                      style={[
                        styles.tableCell,
                        { flex: 1.1, textAlign: "right" },
                      ]}
                    >
                      {cell ? formatCAD(cell.avgRent) : "—"}
                    </Text>
                  );
                })}
                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1,
                      textAlign: "right",
                      color:
                        row.activeIncentiveCount > 0
                          ? BRAND.clay
                          : BRAND.ash,
                      fontFamily:
                        row.activeIncentiveCount > 0
                          ? "Helvetica-Bold"
                          : "Helvetica",
                    },
                  ]}
                >
                  {row.activeIncentiveCount > 0
                    ? `${row.activeIncentiveCount} active`
                    : "—"}
                </Text>
              </View>
            ))}
        </View>

        <View style={styles.footerBar} fixed>
          <Text>Fitzrovia Rental Comp · Confidential</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* --- Page 3: Next Steps — pricing recommendations ------------- */}
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          rightSlot={
            <Text
              style={{ fontSize: 7, color: BRAND.ash, letterSpacing: 1.2 }}
            >
              NEXT STEPS · PRICING PLAYBOOK
            </Text>
          }
        />

        <Text style={styles.sectionLabel}>Next steps</Text>
        <Text style={styles.h2}>What to charge for your beds</Text>
        <Text
          style={{
            fontSize: 10,
            lineHeight: 1.55,
            marginBottom: 14,
            color: BRAND.ink,
          }}
        >
          Three pricing tiers per unit type, anchored in the competitive
          set&apos;s current effective rents (post-incentive, 12-month
          amortization). Round figures to the nearest $25. Pair the
          recommendation with a signed-off unit-quality read before posting.
        </Text>

        {/* Tier legend */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              flex: 1,
              borderLeftWidth: 3,
              borderLeftColor: BRAND.ash,
              paddingLeft: 8,
            }}
          >
            <Text
              style={{
                fontSize: 8,
                fontFamily: "Helvetica-Bold",
                letterSpacing: 1.2,
                color: BRAND.navy,
              }}
            >
              AGGRESSIVE
            </Text>
            <Text
              style={{
                fontSize: 8.5,
                color: BRAND.ash,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              p25 of effective rents. Use for fast lease-up when velocity
              beats top-line.
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              borderLeftWidth: 3,
              borderLeftColor: BRAND.navy,
              paddingLeft: 8,
            }}
          >
            <Text
              style={{
                fontSize: 8,
                fontFamily: "Helvetica-Bold",
                letterSpacing: 1.2,
                color: BRAND.navy,
              }}
            >
              MARKET
            </Text>
            <Text
              style={{
                fontSize: 8.5,
                color: BRAND.ash,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Median effective rent. Default landing — match what comps are
              transacting at.
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              borderLeftWidth: 3,
              borderLeftColor: BRAND.clay,
              paddingLeft: 8,
            }}
          >
            <Text
              style={{
                fontSize: 8,
                fontFamily: "Helvetica-Bold",
                letterSpacing: 1.2,
                color: BRAND.clay,
              }}
            >
              PREMIUM
            </Text>
            <Text
              style={{
                fontSize: 8.5,
                color: BRAND.ash,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              p75 of effective rents. Defensible only with a unit-level
              quality edge.
            </Text>
          </View>
        </View>

        {/* One card per unit type with the three rec tiers + rationale */}
        {pricingRecs.map((rec) => (
          <View
            key={rec.unitType}
            wrap={false}
            style={{
              borderWidth: 1,
              borderColor: BRAND.line,
              backgroundColor: BRAND.paper,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "Helvetica-Bold",
                  fontSize: 12,
                  color: BRAND.navy,
                  letterSpacing: 0.5,
                }}
              >
                {rec.unitType}
              </Text>
              <Text
                style={{
                  fontFamily: "Times-Italic",
                  fontSize: 9,
                  color: BRAND.ash,
                }}
              >
                {rec.sampleSize} comp{rec.sampleSize === 1 ? "" : "s"}
                {"  ·  "}median headline {formatCAD(rec.medianHeadline)}
                {"  ·  "}median effective {formatCAD(rec.medianEffective)}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: BRAND.line,
                  backgroundColor: BRAND.stripe,
                  padding: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    letterSpacing: 1.2,
                    color: BRAND.ash,
                  }}
                >
                  AGGRESSIVE
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Helvetica-Bold",
                    color: BRAND.navy,
                    marginTop: 4,
                    letterSpacing: -0.3,
                  }}
                >
                  {formatCAD(rec.aggressive)}
                </Text>
                <Text
                  style={{
                    fontSize: 7.5,
                    color: BRAND.ash,
                    marginTop: 3,
                    fontFamily: "Times-Italic",
                  }}
                >
                  /mo · fast lease-up
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: BRAND.navy,
                  backgroundColor: BRAND.paper,
                  padding: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    letterSpacing: 1.2,
                    color: BRAND.navy,
                  }}
                >
                  MARKET ·  RECOMMENDED
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: "Helvetica-Bold",
                    color: BRAND.navy,
                    marginTop: 4,
                    letterSpacing: -0.3,
                  }}
                >
                  {formatCAD(rec.market)}
                </Text>
                <Text
                  style={{
                    fontSize: 7.5,
                    color: BRAND.ash,
                    marginTop: 3,
                    fontFamily: "Times-Italic",
                  }}
                >
                  /mo · match median effective
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: BRAND.line,
                  backgroundColor: BRAND.stripe,
                  padding: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    letterSpacing: 1.2,
                    color: BRAND.clay,
                  }}
                >
                  PREMIUM
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Helvetica-Bold",
                    color: BRAND.clay,
                    marginTop: 4,
                    letterSpacing: -0.3,
                  }}
                >
                  {formatCAD(rec.premium)}
                </Text>
                <Text
                  style={{
                    fontSize: 7.5,
                    color: BRAND.ash,
                    marginTop: 3,
                    fontFamily: "Times-Italic",
                  }}
                >
                  /mo · top-of-stack test
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 8.5,
                lineHeight: 1.45,
                color: BRAND.ink,
                paddingTop: 6,
                borderTopWidth: 0.5,
                borderTopColor: BRAND.line,
              }}
            >
              <Text
                style={{
                  fontFamily: "Helvetica-Bold",
                  color: BRAND.clay,
                }}
              >
                Why:{" "}
              </Text>
              {rec.rationale}
            </Text>
          </View>
        ))}

        <View style={styles.footerBar} fixed>
          <Text>Fitzrovia Rental Comp · Confidential</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
