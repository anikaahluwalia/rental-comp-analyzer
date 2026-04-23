import type { CSSProperties } from "react";

/**
 * Central palette + inline-style objects.
 *
 * Everything visual that HAS to look clay-orange or Inter-black is
 * declared here as an inline `style` object. We ship these via the
 * `style=` prop instead of Tailwind utility classes so the cascade can
 * never strip the brand color — no matter what the build system, dev
 * server, or browser cache does with compiled CSS.
 */

export const COLORS = {
  clay: "#E84A1E",
  clayDeep: "#C13A12",
  claySoft: "#F2E4DD",
  ink: "#0B0B0B",
  ash: "#6B6659",
  paper: "#FAFAF7",
  line: "#E4E1D8",
  white: "#FFFFFF",
};

/** MASSIVE display headline — Inter-Black uppercase, tight tracking. */
export const displayHeadline: CSSProperties = {
  fontFamily:
    "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  fontWeight: 900,
  fontStyle: "normal",
  textTransform: "uppercase",
  color: COLORS.ink,
  letterSpacing: "-0.02em",
  lineHeight: 0.88,
};

export const displayHeadlinePaper: CSSProperties = {
  ...displayHeadline,
  color: COLORS.paper,
  lineHeight: 0.9,
};

/** The italic Playfair label treatment — "Market Snapshot", "By Unit Type". */
export const labelItalic: CSSProperties = {
  fontFamily:
    "var(--font-playfair), ui-serif, Georgia, Cambria, serif",
  fontStyle: "italic",
  fontWeight: 400,
  color: COLORS.ash,
};

export const labelItalicPaper: CSSProperties = {
  ...labelItalic,
  color: "rgba(250, 250, 247, 0.8)",
};

/** Short horizontal clay accent bar that sits before every italic eyebrow. */
export const clayAccentBar: CSSProperties = {
  display: "inline-block",
  height: 2,
  width: 40,
  backgroundColor: COLORS.clay,
};

export const clayAccentBarShort: CSSProperties = {
  ...clayAccentBar,
  width: 32,
};

/** Thick horizontal clay stripe across the very top of every page. */
export const clayBrandStripe: CSSProperties = {
  height: 8,
  width: "100%",
  backgroundColor: COLORS.clay,
};

/** Thin clay stripe along the top edge of every KPI card. */
export const clayCardStripe: CSSProperties = {
  position: "absolute",
  insetInlineStart: 0,
  insetInlineEnd: 0,
  top: 0,
  height: 3,
  backgroundColor: COLORS.clay,
  opacity: 0.9,
};

/** Clay-colored text — used on card labels, accent numbers, last-scraped. */
export const clayText: CSSProperties = {
  color: COLORS.clay,
};

export const clayTextBold: CSSProperties = {
  color: COLORS.clay,
  fontWeight: 900,
};

/** Middle-dot separator in subtitles ("X · Y · Z") — clay + bold. */
export const clayDot: CSSProperties = {
  marginInline: 8,
  color: COLORS.clay,
  fontWeight: 900,
};

/** Clay solid-fill primary button (sign-in, scrape-now style). */
export const clayButton: CSSProperties = {
  backgroundColor: COLORS.clay,
  color: COLORS.ink,
};

/** Clay-outlined secondary button (export PDF). */
export const clayOutlineButton: CSSProperties = {
  backgroundColor: COLORS.white,
  color: COLORS.ink,
  border: `1px solid ${COLORS.ink}`,
};
