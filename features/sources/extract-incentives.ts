/**
 * Site-wide incentive extractor.
 *
 * Buildings advertise promotions ("1 month free", "$1,000 credit", "up to 2
 * months free on a 12-month lease") in several places on their marketing
 * site: a banner across the top of every page, a hero section on the home
 * page, a dedicated "Specials" page, and often mixed into the floorplans
 * list itself.
 *
 * This extractor runs over the combined markdown from every page we
 * scraped for a building and finds any sentence or heading that mentions
 * a promotion. It returns a short list of deduped incentive strings, plus
 * a `primary` string that represents the best single incentive to attach
 * to each listing (the longest / most specific one, usually the banner).
 *
 * We intentionally lean permissive here — a false positive (surfacing a
 * generic "move-in" phrase that isn't actually a promo) is much less bad
 * than missing a real "1 month free" banner, so borderline matches get
 * kept and surfaced to the user for judgement.
 */

const FREE_MONTHS_RE =
  /\b(?:up to\s+)?\d+\s*months?\s*free\b[^.!?\n]*/gi;

const FREE_WEEKS_RE =
  /\b(?:up to\s+)?\d+\s*weeks?\s*free\b[^.!?\n]*/gi;

const CREDIT_RE =
  /\b\$\s*[\d,]{3,}\s*(?:credit|off|bonus|rebate|gift card)\b[^.!?\n]*/gi;

const MOVE_IN_RE =
  /\bmove-?in\s+(?:bonus|credit|incentive|gift|offer)\b[^.!?\n]*/gi;

const LIMITED_TIME_RE =
  /\blimited[-\s]time\s+offer\b[^.!?\n]{0,150}/gi;

export type IncentiveExtraction = {
  all: string[];
  primary: string | undefined;
};

export function extractIncentives(
  combinedMarkdown: string,
): IncentiveExtraction {
  const hits: string[] = [];

  for (const re of [
    FREE_MONTHS_RE,
    FREE_WEEKS_RE,
    CREDIT_RE,
    MOVE_IN_RE,
    LIMITED_TIME_RE,
  ]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(combinedMarkdown)) !== null) {
      const cleaned = m[0]
        .replace(/\s+/g, " ")
        .replace(/^[-*•:#\s]+/, "") // strip list/heading prefixes
        .trim();
      if (cleaned.length >= 6 && cleaned.length <= 220) {
        hits.push(cleaned);
      }
    }
  }

  // Dedupe case-insensitively, preserving original capitalization of
  // the first seen variant.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const h of hits) {
    const key = h.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(h);
    }
  }

  // Primary = longest (most specific) hit. If nothing was found, leave
  // listings without an incentive rather than inventing one.
  const primary =
    deduped.length > 0
      ? deduped.slice().sort((a, b) => b.length - a.length)[0]
      : undefined;

  return { all: deduped, primary };
}
