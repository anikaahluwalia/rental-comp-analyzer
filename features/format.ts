/** Formatting helpers for rendering listings data consistently. */

export function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPricePerSqft(pricePerSqft: number): string {
  return `$${pricePerSqft.toFixed(2)}`;
}

export function formatSqft(sqft: number | undefined): string {
  if (!sqft) return "—";
  return `${Math.round(sqft).toLocaleString()} sqft`;
}

/** "2 min ago", "3 hr ago", "just now". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec} sec ago`;
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins} min ago`;
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return `${hrs} hr ago`;
  }
  const days = Math.floor(diffSec / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Timezone-aware timestamp for tooltip / detail views.
 *
 * Pinned to Toronto because this runs on the server (Render, UTC) and we
 * don't want timestamps jumping ahead by 4–5 hours on PDFs or server-rendered
 * pages.
 */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });
}
