"use client";

/**
 * The "Scrape now" button in the dashboard header.
 *
 * Clicking it starts a fresh check of all the rental websites for
 * every Fitzrovia building. A real scrape takes about 2–3 minutes,
 * so the button shows "Scraping…" and stays disabled the whole time.
 * When it finishes, the dashboard numbers update automatically
 * without a page reload.
 *
 * Only analysts and admins see this button — read-only viewers
 * can't trigger scrapes. The role check happens both here (to hide
 * the button) and on the server (to make sure nobody can work
 * around it).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COLORS } from "@/features/ui-style";

export function ScrapeNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onScrape() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Scrape failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={onScrape}
        disabled={loading}
        style={{ backgroundColor: COLORS.clay, color: COLORS.ink }}
        className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Scraping…" : "Scrape now"}
        {!loading && <span aria-hidden>→</span>}
      </button>
      {error ? <p className="text-xs text-red-900">{error}</p> : null}
    </div>
  );
}
