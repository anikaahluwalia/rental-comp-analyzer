import type { UnitType } from "../types";

/**
 * Small, pure helpers for turning messy scraped text into typed values.
 * Shared across the scraper so we normalize things the same way no matter
 * which page markdown we're walking.
 */

/** Parse "$2,450/month" or "$2450" or "2,450 CAD" into 2450. */
export function parseRent(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d{3,5})/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  // Sanity: Toronto rents are roughly $1200-$10000 — discard anything obviously
  // wrong (some pages put phone numbers in rent fields).
  if (n < 800 || n > 20_000) return null;
  return n;
}

/** Parse "750 sq ft", "750 sqft", "750 ft²", "~720 sq. ft.". */
export function parseSqft(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d{2,4})\s*(?:sq|ft|square|sf)/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  if (n < 250 || n > 3500) return null;
  return n;
}

/**
 * Map a raw bedroom string into our 4-way UnitType enum.
 * Handles:
 *   - "Studio", "Studio Suite", "Bachelor", "Bachelor Suite", "Jr. 1 Bed"
 *   - "0 bed", "1 bedroom", "1 bd", "1-bed", "2BR"
 *   - "1B", "2B", "3B" (standalone card-header shorthand)
 *   - "1+0", "1+1", "2+1", "2+2", "3+1" (Toronto "bed + den" notation —
 *     the first digit is always the bedroom count)
 *   - Spelled-out "one bedroom", "two bedroom", "three bedroom"
 */
export function parseUnitType(raw: string | undefined | null): UnitType | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (/\b(studio|bachelor|jr\.? 1|junior 1)\b/.test(s)) return "Bachelor";
  if (/\b0\b/.test(s) && /bed|br|bd/.test(s)) return "Bachelor";

  // Toronto "N+M" den notation: first digit is bedrooms.
  const denMatch = s.match(/\b([123])\s*\+\s*[0-9]\b/);
  if (denMatch) {
    if (denMatch[1] === "1") return "1-Bed";
    if (denMatch[1] === "2") return "2-Bed";
    if (denMatch[1] === "3") return "3-Bed";
  }

  if (/\b1\b/.test(s) && /bed|br|bd/.test(s)) return "1-Bed";
  if (/\b2\b/.test(s) && /bed|br|bd/.test(s)) return "2-Bed";
  if (/\b3\b/.test(s) && /bed|br|bd/.test(s)) return "3-Bed";

  // Standalone "1B" / "2B" / "3B" card shorthand — require word-boundary
  // on both sides to avoid matching things like "21B Baker St".
  if (/^(?:.*\s)?1\s*b\b/.test(s)) return "1-Bed";
  if (/^(?:.*\s)?2\s*b\b/.test(s)) return "2-Bed";
  if (/^(?:.*\s)?3\s*b\b/.test(s)) return "3-Bed";

  // Spelled out.
  if (/\bone\b.*\bbed/.test(s)) return "1-Bed";
  if (/\btwo\b.*\bbed/.test(s)) return "2-Bed";
  if (/\bthree\b.*\bbed/.test(s)) return "3-Bed";
  return null;
}

/** Trim + collapse all internal whitespace. */
export function clean(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}
