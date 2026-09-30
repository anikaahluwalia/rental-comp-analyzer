import { PROPERTIES } from "./properties";
import type { Listing, UnitType } from "./types";
import { UNIT_TYPES } from "./types";
import { formatCAD, formatPricePerSqft, formatSqft } from "./format";

/**
 * Natural-language query layer for the dashboard.
 *
 * This deterministic local parser is retained by the research layer as
 * a no-key/provider-failure fallback. Claude orchestration lives in
 * research-agent.ts; evidence and confidence are attached in research.ts.
 *
 * Supported intents today:
 *   - cheapest / most expensive X                (min/max rent)
 *   - best value X                               (min $/sqft)
 *   - average rent / avg $/sqft X
 *   - buildings with incentives
 *   - units under $X (optionally filtered by type)
 *   - total units / how many
 *   - units at <building>
 */

export type AnswerCitation = {
  propertyId: string;
  propertyName: string;
};

export type Answer = {
  confidence?: import("./research").AnswerConfidence;
  sources?: import("./research").Evidence[];
  conflicts?: import("./conflicts").DataConflict[];
  warnings?: string[];
  trace?: import("./research").ResearchTrace;
  mode?: "claude" | "deterministic";
  intent: string;
  headline: string;
  detail?: string;
  rows?: Array<{
    label: string;
    value: string;
    sublabel?: string;
    propertyId?: string;
  }>;
  citations?: AnswerCitation[];
  suggestedFollowUps?: string[];
};

const INTENT_EXAMPLES = [
  "Which 2-bedroom is actually cheapest after incentives?",
  "Which buildings have conflicting pricing information?",
  "I'm choosing between Parker and Whitney. Compare effective rent, square footage, incentives, and tell me what information is still missing.",
  "Cheapest 2-Bed",
  "Best $/sqft 1-Bed",
  "Average rent for Bachelor",
  "Which buildings have incentives",
  "2-beds under $3500",
  "How many units are available",
  "Units at Parker",
];

export const QUERY_SUGGESTIONS = INTENT_EXAMPLES;

export function detectUnitType(input: string): UnitType | null {
  const norm = input.toLowerCase();
  if (/\bbach(elor)?\b|\bstudio\b/.test(norm)) return "Bachelor";
  if (/\b3[- ]?bed(room)?s?\b|\bthree[- ]?bed(room)?s?\b/.test(norm))
    return "3-Bed";
  if (/\b2[- ]?bed(room)?s?\b|\btwo[- ]?bed(room)?s?\b/.test(norm))
    return "2-Bed";
  if (/\b1[- ]?bed(room)?s?\b|\bone[- ]?bed(room)?s?\b/.test(norm))
    return "1-Bed";
  return null;
}

export function detectDollar(input: string): number | null {
  // Accept $3500, $3,500, 3500, 3.5k
  const kMatch = input.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const dollarMatch = input.match(/\$\s*(\d[\d,]*)/);
  if (dollarMatch) return parseInt(dollarMatch[1].replace(/,/g, ""), 10);
  const bareMatch = input.match(/\b(\d{3,5})\b/);
  if (bareMatch) {
    const n = parseInt(bareMatch[1], 10);
    if (n >= 500 && n <= 50000) return n;
  }
  return null;
}

function detectProperty(input: string): {
  id: string;
  name: string;
} | null {
  const norm = input.toLowerCase();
  for (const p of PROPERTIES) {
    const needle = p.name.toLowerCase();
    if (norm.includes(needle)) return { id: p.id, name: p.name };
    // Also match against normalized id tokens
    if (norm.includes(p.id.replace(/-/g, " "))) {
      return { id: p.id, name: p.name };
    }
  }
  return null;
}

function propertyName(id: string): string {
  return PROPERTIES.find((p) => p.id === id)?.name ?? id;
}

// --- Intent handlers --------------------------------------------------

function answerCheapestOrMost(
  listings: Listing[],
  unitType: UnitType | null,
  mode: "cheapest" | "most",
): Answer {
  const subset = unitType
    ? listings.filter((l) => l.unitType === unitType)
    : listings;
  if (subset.length === 0) {
    return {
      intent: `${mode}-rent`,
      headline: `No ${unitType ?? "available"} units in the current snapshot.`,
    };
  }
  const sorted = [...subset].sort((a, b) =>
    mode === "cheapest" ? a.rent - b.rent : b.rent - a.rent,
  );
  const top = sorted[0];
  const runners = sorted.slice(1, 4);

  const label = unitType ?? "unit";
  const verb = mode === "cheapest" ? "cheapest" : "most expensive";

  return {
    intent: `${mode}-rent`,
    headline: `${propertyName(top.propertyId)} — ${formatCAD(top.rent)}${top.sqft ? ` / ${formatSqft(top.sqft)}` : ""}${top.incentive ? ` · ${top.incentive}` : ""}`,
    detail: `The ${verb} ${label} in the stored snapshot.`,
    rows: runners.map((l) => ({
      label: propertyName(l.propertyId),
      value: formatCAD(l.rent),
      sublabel: l.sqft ? formatSqft(l.sqft) : undefined,
      propertyId: l.propertyId,
    })),
    citations: [
      { propertyId: top.propertyId, propertyName: propertyName(top.propertyId) },
    ],
    suggestedFollowUps: unitType
      ? [
          `Average rent for ${unitType}`,
          `Best $/sqft ${unitType}`,
          `${unitType}s under $3500`,
        ]
      : ["Best $/sqft 1-Bed", "Which buildings have incentives"],
  };
}

function answerBestValue(
  listings: Listing[],
  unitType: UnitType | null,
): Answer {
  const subset = (
    unitType ? listings.filter((l) => l.unitType === unitType) : listings
  ).filter(
    (l): l is Listing & { sqft: number } => typeof l.sqft === "number",
  );
  if (subset.length === 0) {
    return {
      intent: "best-value",
      headline: `No ${unitType ?? ""} units with sqft data right now.`,
    };
  }
  const sorted = [...subset].sort(
    (a, b) => a.rent / a.sqft - b.rent / b.sqft,
  );
  const top = sorted[0];
  const pps = top.rent / top.sqft;

  return {
    intent: "best-value",
    headline: `${propertyName(top.propertyId)} — ${formatPricePerSqft(pps)} (${formatCAD(top.rent)} / ${formatSqft(top.sqft)})`,
    detail: `Lowest $/sqft${unitType ? ` in the ${unitType} cohort` : ""} · a meaningful reference point for pricing committee.`,
    rows: sorted.slice(1, 4).map((l) => ({
      label: propertyName(l.propertyId),
      value: formatPricePerSqft(l.rent / l.sqft),
      sublabel: `${formatCAD(l.rent)} · ${formatSqft(l.sqft)}`,
      propertyId: l.propertyId,
    })),
    citations: [
      { propertyId: top.propertyId, propertyName: propertyName(top.propertyId) },
    ],
  };
}

function answerAverage(
  listings: Listing[],
  unitType: UnitType | null,
  basis: "rent" | "persqft",
): Answer {
  const subset = unitType
    ? listings.filter((l) => l.unitType === unitType)
    : listings;
  if (subset.length === 0) {
    return {
      intent: `avg-${basis}`,
      headline: `No ${unitType ?? "available"} units to average.`,
    };
  }
  if (basis === "rent") {
    const avg = subset.reduce((a, l) => a + l.rent, 0) / subset.length;
    return {
      intent: "avg-rent",
      headline: `Average ${unitType ?? "unit"} rent: ${formatCAD(avg)}`,
      detail: `Across ${subset.length} available unit${subset.length === 1 ? "" : "s"}.`,
    };
  }
  const withSqft = subset.filter(
    (l): l is Listing & { sqft: number } => typeof l.sqft === "number",
  );
  if (withSqft.length === 0) {
    return {
      intent: "avg-persqft",
      headline: `No sqft data in the ${unitType ?? "available"} set.`,
    };
  }
  const avg =
    withSqft.reduce((a, l) => a + l.rent / l.sqft, 0) / withSqft.length;
  return {
    intent: "avg-persqft",
    headline: `Average ${unitType ?? "unit"} $/sqft: ${formatPricePerSqft(avg)}`,
    detail: `Across ${withSqft.length} unit${withSqft.length === 1 ? "" : "s"} with reported sqft.`,
  };
}

function answerIncentives(listings: Listing[]): Answer {
  const withIncentive = listings.filter((l) => !!l.incentive);
  if (withIncentive.length === 0) {
    return {
      intent: "incentives",
      headline: "No incentive information in the current snapshot.",
      detail:
        "Missing incentive text does not establish that a building offers no incentives.",
    };
  }

  // Group by property
  const byProperty = new Map<string, Listing[]>();
  for (const l of withIncentive) {
    const arr = byProperty.get(l.propertyId) ?? [];
    arr.push(l);
    byProperty.set(l.propertyId, arr);
  }

  const rows = Array.from(byProperty.entries())
    .map(([propertyId, items]) => ({
      propertyId,
      label: propertyName(propertyId),
      value: `${items.length} unit${items.length === 1 ? "" : "s"}`,
      sublabel: Array.from(new Set(items.map((i) => i.incentive!)))
        .slice(0, 2)
        .join(" · "),
    }))
    .sort((a, b) => parseInt(b.value) - parseInt(a.value));

  return {
    intent: "incentives",
    headline: `${withIncentive.length} active incentive${withIncentive.length === 1 ? "" : "s"} across ${byProperty.size} building${byProperty.size === 1 ? "" : "s"}`,
    detail: `${Math.round((withIncentive.length / listings.length) * 100)}% of available units currently carry a promo.`,
    rows,
    citations: rows.map((r) => ({
      propertyId: r.propertyId,
      propertyName: r.label,
    })),
  };
}

function answerUnderBudget(
  listings: Listing[],
  unitType: UnitType | null,
  budget: number,
): Answer {
  const subset = (
    unitType ? listings.filter((l) => l.unitType === unitType) : listings
  ).filter((l) => l.rent <= budget);

  if (subset.length === 0) {
    return {
      intent: "under-budget",
      headline: `No ${unitType ?? "units"} available at ${formatCAD(budget)} or below.`,
      detail: "Try raising the budget or widening the unit-type filter.",
    };
  }

  // Group by property, keep cheapest listing per property
  const cheapestByProperty = new Map<string, Listing>();
  for (const l of subset) {
    const existing = cheapestByProperty.get(l.propertyId);
    if (!existing || l.rent < existing.rent) {
      cheapestByProperty.set(l.propertyId, l);
    }
  }

  const rows = Array.from(cheapestByProperty.values())
    .sort((a, b) => a.rent - b.rent)
    .map((l) => ({
      propertyId: l.propertyId,
      label: propertyName(l.propertyId),
      value: formatCAD(l.rent),
      sublabel: `${l.unitType}${l.sqft ? ` · ${formatSqft(l.sqft)}` : ""}${l.incentive ? ` · ${l.incentive}` : ""}`,
    }));

  return {
    intent: "under-budget",
    headline: `${subset.length} ${unitType ?? "unit"}${subset.length === 1 ? "" : "s"} at or below ${formatCAD(budget)}`,
    detail: `Across ${cheapestByProperty.size} building${cheapestByProperty.size === 1 ? "" : "s"}. Showing the cheapest match per building.`,
    rows,
    citations: rows.map((r) => ({
      propertyId: r.propertyId,
      propertyName: r.label,
    })),
  };
}

function answerCount(
  listings: Listing[],
  unitType: UnitType | null,
): Answer {
  const subset = unitType
    ? listings.filter((l) => l.unitType === unitType)
    : listings;
  const byProperty = new Set(subset.map((l) => l.propertyId));

  return {
    intent: "count",
    headline: `${subset.length} ${unitType ?? "total"} unit${subset.length === 1 ? "" : "s"} available`,
    detail: `Across ${byProperty.size} building${byProperty.size === 1 ? "" : "s"} in the competitive set.`,
  };
}

function answerAtProperty(
  listings: Listing[],
  prop: { id: string; name: string },
): Answer {
  const subset = listings.filter((l) => l.propertyId === prop.id);
  if (subset.length === 0) {
    return {
      intent: "at-building",
      headline: `No available units at ${prop.name} in the stored snapshot.`,
      citations: [{ propertyId: prop.id, propertyName: prop.name }],
    };
  }

  const byType = new Map<UnitType, Listing[]>();
  for (const l of subset) {
    const arr = byType.get(l.unitType) ?? [];
    arr.push(l);
    byType.set(l.unitType, arr);
  }

  const rows = UNIT_TYPES.filter((t) => byType.has(t)).map((t) => {
    const items = byType.get(t)!;
    const avg = items.reduce((a, l) => a + l.rent, 0) / items.length;
    const min = Math.min(...items.map((l) => l.rent));
    return {
      label: t,
      value: formatCAD(avg),
      sublabel: `${items.length} unit${items.length === 1 ? "" : "s"} · from ${formatCAD(min)}`,
      propertyId: prop.id,
    };
  });

  return {
    intent: "at-building",
    headline: `${subset.length} unit${subset.length === 1 ? "" : "s"} available at ${prop.name}`,
    detail: `${subset.filter((l) => l.incentive).length} currently carry an incentive.`,
    rows,
    citations: [{ propertyId: prop.id, propertyName: prop.name }],
  };
}

// --- Dispatch ---------------------------------------------------------

export function runQuery(input: string, listings: Listing[]): Answer {
  const raw = input.trim();
  if (!raw) {
    return {
      intent: "empty",
      headline: "Ask about rent, $/sqft, incentives, or a specific building.",
      suggestedFollowUps: QUERY_SUGGESTIONS,
    };
  }

  const lower = raw.toLowerCase();
  const unitType = detectUnitType(lower);
  const dollar = detectDollar(lower);
  const prop = detectProperty(lower);

  // 1. Budget filter: "under $X" / "below X" / "less than X"
  if (dollar && /\b(under|below|less\s+than|beneath)\b/.test(lower)) {
    return answerUnderBudget(listings, unitType, dollar);
  }

  // 2. Incentives
  if (
    /\b(incentives?|promos?|free\s+month|specials?|deals?)\b/.test(lower)
  ) {
    return answerIncentives(listings);
  }

  // 3. Cheapest / most expensive
  if (/\bchea?pest|lowest|min(imum)?\b/.test(lower)) {
    return answerCheapestOrMost(listings, unitType, "cheapest");
  }
  if (/\bmost\s+expensive|highest|max(imum)?|priciest\b/.test(lower)) {
    return answerCheapestOrMost(listings, unitType, "most");
  }

  // 4. Best value
  if (
    /\bbest\s+(value|deal|\$?\s*\/?\s*sqft)|best\s+per\s+sqft\b/.test(
      lower,
    )
  ) {
    return answerBestValue(listings, unitType);
  }

  // 5. Average
  if (/\b(average|avg|mean)\b/.test(lower)) {
    const basis = /\$?\s*\/?\s*sqft|per\s+sqft/.test(lower)
      ? "persqft"
      : "rent";
    return answerAverage(listings, unitType, basis);
  }

  // 6. Count
  if (
    /\b(how\s+many|total|count|number\s+of)\b/.test(lower) ||
    /^\s*\d+\s*\?\s*$/.test(lower)
  ) {
    return answerCount(listings, unitType);
  }

  // 7. At specific building
  if (prop) {
    return answerAtProperty(listings, prop);
  }

  // Fallback
  return {
    intent: "unclear",
    headline: "I'm not sure how to answer that yet.",
    detail:
      "I can answer questions about rent, $/sqft, incentives, unit counts, and specific buildings. Try one of the examples below.",
    suggestedFollowUps: QUERY_SUGGESTIONS,
  };
}
