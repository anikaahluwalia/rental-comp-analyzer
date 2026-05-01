import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Listing, ScrapeRun } from "./types";
import { PROPERTIES } from "./properties";
import { scrapeAll } from "./sources";
import seedData from "./seed-listings.json";

/**
 * In-memory listings store, backed by a disk snapshot.
 *
 * Flow on `triggerScrape()`:
 *   1. For every property, fan out across all configured sources: the
 *      building's own marketing site (primary) plus any aggregators
 *      configured on the Property (rentals.ca, zillow.ca, liv.rent).
 *      Listings are deduped across sources by (unitType, rent, sqft).
 *   2. Store whatever comes back — real, empty, or partial — and persist
 *      a JSON snapshot to `.data/listings.json`. The snapshot lets a fresh
 *      server boot show the last-good scrape without re-hitting the network.
 *
 * We intentionally do NOT fall back to synthetic/mock data if every source
 * returns zero. An empty scrape is shown honestly as "no listings yet"
 * with the per-building, per-source `runs` explaining why each source
 * came back empty (403, timeout, parser miss, etc.). Silently swapping in
 * fake prices would mislead the user into thinking the market has
 * inventory it doesn't.
 *
 * The store also tracks ScrapeRun metadata per (building, source) so the
 * UI/PDF can render diagnostic health.
 */

type Store = {
  listings: Listing[];
  runs: ScrapeRun[];
  lastScrapedAt: string | null;
};

// Persist across module re-evaluations in Next.js dev by hanging off the
// global object. Without this, HMR would occasionally reset the store
// between requests.
declare global {
  // eslint-disable-next-line no-var
  var __rentalCompListingsStore: Store | undefined;
}

// Production (e.g. Vercel) has a read-only cwd — write to the OS temp dir.
// Dev keeps using .data/ in the repo so snapshots persist across restarts.
const SNAPSHOT_PATH =
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), ".data", "listings.json")
    : path.join(tmpdir(), "midtown-comp-data", "listings.json");

function emptyStore(): Store {
  return {
    listings: [],
    runs: [],
    lastScrapedAt: null,
  };
}

/**
 * Bundled seed snapshot — a real scrape captured locally and committed to
 * the repo. Used as a cold-start fallback on serverless hosts where /tmp is
 * per-instance and ephemeral (so every fresh Lambda would otherwise show
 * "never scraped" until someone manually re-scrapes, and then the next
 * Lambda would show different data again).
 *
 * Regenerate: run `npm run dev`, trigger a scrape, then
 *   cp .data/listings.json features/seed-listings.json
 */
function seedStore(): Store {
  const s = seedData as Partial<Store>;
  return {
    listings: s.listings ?? [],
    runs: s.runs ?? [],
    lastScrapedAt: s.lastScrapedAt ?? null,
  };
}

function loadSnapshotSync(): Store | null {
  // Sync load so ensureStore() can stay synchronous for the common hot path
  // (getListings, getLastScrapedAt). Dev-only file, tiny JSON — the sync
  // read is fine.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsSync = require("node:fs") as typeof import("node:fs");
    if (!fsSync.existsSync(SNAPSHOT_PATH)) return null;
    const raw = fsSync.readFileSync(SNAPSHOT_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Store> & {
      // Legacy snapshots may still carry this flag — tolerate and discard it.
      usingMockFallback?: boolean;
    };
    return {
      listings: parsed.listings ?? [],
      runs: parsed.runs ?? [],
      lastScrapedAt: parsed.lastScrapedAt ?? null,
    };
  } catch {
    return null;
  }
}

async function writeSnapshot(store: Store): Promise<void> {
  try {
    await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // Snapshot persistence is best-effort. A read-only FS shouldn't kill a scrape.
  }
}

function ensureStore(): Store {
  if (!globalThis.__rentalCompListingsStore) {
    // Cold-boot priority:
    //   1. on-disk snapshot (a fresher scrape written since boot)
    //   2. bundled seed    (consistent baseline across every Vercel instance)
    //   3. empty           (never — we always have a seed)
    globalThis.__rentalCompListingsStore =
      loadSnapshotSync() ?? seedStore() ?? emptyStore();
  }
  return globalThis.__rentalCompListingsStore;
}

export function getListings(): Listing[] {
  return ensureStore().listings;
}

/**
 * ISO timestamp of the most recent scrape, or null if we've never scraped
 * in this server's lifetime (and no on-disk snapshot was found on boot).
 * Callers should branch on null to render a "never scraped yet" state.
 */
export function getLastScrapedAt(): string | null {
  return ensureStore().lastScrapedAt;
}

export function getScrapeRuns(): ScrapeRun[] {
  return ensureStore().runs;
}

export function hasEverScraped(): boolean {
  return ensureStore().lastScrapedAt !== null;
}

/**
 * Run the building-site scraper across every property. Whatever comes
 * back — real, partial, or empty — is what gets stored. No synthetic
 * backfill. A zero-listings run shows as `listingsFound: 0` with the
 * per-building `runs` carrying the failure reasons, which is more useful
 * for debugging than fake data would be.
 */
export async function triggerScrape(): Promise<{
  lastScrapedAt: string;
  listingsFound: number;
  runs: ScrapeRun[];
}> {
  const { listings, runs } = await scrapeAll(PROPERTIES);
  const lastScrapedAt = new Date().toISOString();

  const store: Store = {
    listings,
    runs,
    lastScrapedAt,
  };
  globalThis.__rentalCompListingsStore = store;

  // Fire-and-forget disk write so the HTTP response doesn't wait on FS.
  void writeSnapshot(store);

  return {
    lastScrapedAt,
    listingsFound: listings.length,
    runs,
  };
}
