import type { Listing } from "./types";

/**
 * Effective-rent normalization.
 *
 * The whole point of the comp exercise isn't a list of raw rents — those
 * are misleading the moment incentives enter the picture. A unit at
 * $2,400/mo with "1 month free on a 12-month lease" is really $2,200/mo
 * when you divide the 11 months of cash into 12 months of occupancy.
 *
 * This module:
 *   1. Parses an incentive string into a structured `IncentiveDiscount`.
 *   2. Computes the effective monthly rent over a chosen lease term
 *      (default 12 months).
 *   3. Explicitly labels incentives it can't confidently parse as
 *      `needs-review` rather than silently ignoring them — careful >
 *      confident for pricing decisions.
 *
 * The parser is intentionally conservative. Better to say "manual review
 * needed" than to over-credit an ambiguous perk as a rent discount.
 */

export const DEFAULT_LEASE_TERM_MONTHS = 12;

export type IncentiveDiscount =
  | {
      kind: "months-free";
      monthsFree: number;
      /** Source-stated lease term. Falls back to default if not stated. */
      statedTerm: number;
    }
  | {
      kind: "weeks-free";
      weeksFree: number;
      statedTerm: number;
    }
  | {
      kind: "dollar-credit";
      /** One-time dollar amount, amortized across the lease term. */
      amount: number;
    }
  | {
      kind: "percent-off";
      /** Percent off monthly rent, e.g. 0.08 = 8% off. */
      pct: number;
    }
  | { kind: "none" }
  | { kind: "needs-review"; reason: string };

export type EffectiveRentResult = {
  /** What the landlord quotes on the website. */
  rawRent: number;
  /** Monthly rent after amortizing the incentive over the lease term. */
  effectiveRent: number;
  /** Dollars saved per month vs. raw rent. 0 when no parseable incentive. */
  monthlySavings: number;
  /** Percent off vs raw rent. 0 when no parseable incentive. */
  effectiveDiscountPct: number;
  /** Structured parse of the incentive string. */
  discount: IncentiveDiscount;
  /** Short human-readable calculation (for UI "how we got here" reveal). */
  explanation: string;
  /** True if we applied a real reduction (i.e. discount is not none / needs-review). */
  applied: boolean;
};

// --- Parser ----------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function parseWordOrDigit(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  if (trimmed in NUMBER_WORDS) return NUMBER_WORDS[trimmed];
  return null;
}

/**
 * Parse a free-form incentive string into a structured discount.
 *
 * Recognized patterns (case-insensitive):
 *   - "1 month free", "2 months free on a 14-month lease"
 *   - "6 weeks free"
 *   - "$500 move-in credit", "$1,000 signing bonus"
 *   - "10% off first year"
 *
 * Anything else → `{ kind: 'needs-review' }` with a short reason.
 */
export function parseIncentive(raw: string | undefined): IncentiveDiscount {
  if (!raw) return { kind: "none" };
  const s = raw.toLowerCase().trim();

  // "X months/month free on a Y-month lease"
  const monthsFree = s.match(
    /(\d+|one|two|three|four|five|six)\s*months?\s*free(?:\s*on\s*(?:a\s*)?(\d+)[- ]?month\s*lease)?/i,
  );
  if (monthsFree) {
    const n = parseWordOrDigit(monthsFree[1]);
    if (n !== null && n > 0 && n < 12) {
      const statedTerm = monthsFree[2]
        ? parseInt(monthsFree[2], 10)
        : DEFAULT_LEASE_TERM_MONTHS;
      return { kind: "months-free", monthsFree: n, statedTerm };
    }
  }

  // "X weeks free"
  const weeksFree = s.match(/(\d+)\s*weeks?\s*free/i);
  if (weeksFree) {
    const n = parseInt(weeksFree[1], 10);
    if (n > 0 && n < 52) {
      return { kind: "weeks-free", weeksFree: n, statedTerm: DEFAULT_LEASE_TERM_MONTHS };
    }
  }

  // "$X [...] credit|bonus|rebate|off"
  const dollar = s.match(
    /\$\s*([\d,]+(?:\.\d+)?)(?=[^\d])?.*?(credit|bonus|rebate|off|discount|gift)/i,
  );
  if (dollar) {
    const amount = parseFloat(dollar[1].replace(/,/g, ""));
    if (amount > 0) return { kind: "dollar-credit", amount };
  }

  // "X% off"
  const pct = s.match(/(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (pct) {
    const p = parseFloat(pct[1]);
    if (p > 0 && p < 100) {
      return { kind: "percent-off", pct: p / 100 };
    }
  }

  // Known ambiguous perks we don't auto-credit (parking value, waived
  // fees that vary by building, signing bonuses tied to a move-in window).
  if (
    /parking|locker|storage|gym|amenity|move[- ]in\s*window|conditional/i.test(
      s,
    )
  ) {
    return {
      kind: "needs-review",
      reason:
        "Perk value varies by building — needs a manual $/mo credit assignment.",
    };
  }

  return {
    kind: "needs-review",
    reason: "Parser couldn't match a known incentive pattern.",
  };
}

// --- Calculator ------------------------------------------------------

export function computeEffectiveRent(
  listing: Listing,
  leaseTermMonths: number = DEFAULT_LEASE_TERM_MONTHS,
): EffectiveRentResult {
  const rawRent = listing.rent;
  const discount = parseIncentive(listing.incentive);

  let effectiveRent = rawRent;
  let explanation = "No incentive in the snapshot.";

  switch (discount.kind) {
    case "none":
      explanation = "No incentive on this unit.";
      break;

    case "months-free": {
      const term = discount.statedTerm || leaseTermMonths;
      const paidMonths = term - discount.monthsFree;
      if (paidMonths <= 0) {
        return {
          rawRent,
          effectiveRent: rawRent,
          monthlySavings: 0,
          effectiveDiscountPct: 0,
          discount: {
            kind: "needs-review",
            reason: "Incentive math would zero out — check source.",
          },
          explanation: "Incentive math doesn't resolve — flagged for review.",
          applied: false,
        };
      }
      const annualCost = paidMonths * rawRent;
      effectiveRent = annualCost / term;
      explanation =
        `${discount.monthsFree} month${discount.monthsFree === 1 ? "" : "s"} free on a ${term}-month lease: ` +
        `${paidMonths} × ${formatDollars(rawRent)} = ${formatDollars(annualCost)}, ` +
        `÷ ${term} months = ${formatDollars(effectiveRent)}/mo.`;
      break;
    }

    case "weeks-free": {
      // Convert weeks to a fractional months-free equivalent.
      const monthsFreeEquivalent = discount.weeksFree / 4.345;
      const term = discount.statedTerm;
      const annualCost = rawRent * (term - monthsFreeEquivalent);
      effectiveRent = annualCost / term;
      explanation =
        `${discount.weeksFree} weeks free ≈ ${monthsFreeEquivalent.toFixed(2)} months free on a ${term}-month lease → ${formatDollars(effectiveRent)}/mo.`;
      break;
    }

    case "dollar-credit": {
      const term = leaseTermMonths;
      effectiveRent = rawRent - discount.amount / term;
      explanation =
        `${formatDollars(discount.amount)} one-time credit amortized over ${term} months = ` +
        `${formatDollars(discount.amount / term)}/mo off → ${formatDollars(effectiveRent)}/mo.`;
      break;
    }

    case "percent-off": {
      effectiveRent = rawRent * (1 - discount.pct);
      explanation =
        `${(discount.pct * 100).toFixed(1)}% off monthly rent → ${formatDollars(effectiveRent)}/mo.`;
      break;
    }

    case "needs-review":
      explanation = `Incentive detected, manual review needed — ${discount.reason}`;
      break;
  }

  const applied =
    discount.kind !== "none" && discount.kind !== "needs-review";

  return {
    rawRent,
    effectiveRent,
    monthlySavings: applied ? rawRent - effectiveRent : 0,
    effectiveDiscountPct: applied ? 1 - effectiveRent / rawRent : 0,
    discount,
    explanation,
    applied,
  };
}

function formatDollars(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA")}`;
}

// --- Listing enrichment ---------------------------------------------

export type EnrichedListing = Listing & {
  effective: EffectiveRentResult;
  pricePerSqft: number | null;
  effectivePricePerSqft: number | null;
};

export function enrichListings(
  listings: Listing[],
  leaseTermMonths: number = DEFAULT_LEASE_TERM_MONTHS,
): EnrichedListing[] {
  return listings.map((l) => {
    const effective = computeEffectiveRent(l, leaseTermMonths);
    const pricePerSqft = l.sqft ? l.rent / l.sqft : null;
    const effectivePricePerSqft = l.sqft
      ? effective.effectiveRent / l.sqft
      : null;
    return { ...l, effective, pricePerSqft, effectivePricePerSqft };
  });
}
