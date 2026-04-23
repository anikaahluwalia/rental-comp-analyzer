/**
 * Shared HTTP helper for scrapers.
 *
 * Transport is chosen at runtime based on which API key is configured, in
 * this priority order:
 *
 *   1. FIRECRAWL_KEY    → route through Firecrawl's anti-bot gateway. Best
 *                         for Cloudflare-gated and bot-protected targets.
 *                         Also exposes a /map endpoint we use to discover
 *                         promo pages without hard-coding URLs.
 *   2. SCRAPERAPI_KEY   → route through ScraperAPI. Kept as a fallback, but
 *                         note: their free tier does NOT include the premium
 *                         proxy pools needed to beat Cloudflare, so this
 *                         path only actually works on their paid plan.
 *   3. (no key set)     → direct fetch. Fast + free but will 403 on any site
 *                         behind Cloudflare. Fine for unprotected sites.
 *
 * The rest of the scraper code is unchanged regardless of which transport
 * is used — every path returns the same `FetchedPage` shape.
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";
const FIRECRAWL_MAP_ENDPOINT = "https://api.firecrawl.dev/v1/map";
const SCRAPERAPI_ENDPOINT = "http://api.scraperapi.com/";

export type FetchedPage = {
  ok: boolean;
  status: number;
  finalUrl: string;
  html: string;
  /**
   * Markdown rendering of the page. Only populated when the transport is
   * Firecrawl — it's what their extractor produces alongside the HTML.
   * For rentals.ca especially, markdown is dramatically easier to parse
   * than the raw DOM (headings like `### 1 Bedroom 25 Units` followed by
   * list items like `- $2,475 - 1 Bath - 509 ft² - Jun 8th 2026`).
   */
  markdown?: string;
  /** True if we went through a scraping proxy service. */
  viaProxy: boolean;
  /** Which transport actually served this response. */
  transport: "direct" | "firecrawl" | "scraperapi";
  /** Populated when ok=false. */
  error?: string;
};

export async function fetchHtml(
  url: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<FetchedPage> {
  if (process.env.FIRECRAWL_KEY) {
    return fetchViaFirecrawl(url, process.env.FIRECRAWL_KEY, opts);
  }
  if (process.env.SCRAPERAPI_KEY) {
    return fetchViaScraperApi(url, process.env.SCRAPERAPI_KEY, opts);
  }
  return fetchDirect(url, opts);
}

// ---------------------------------------------------------------------------
// Direct fetch (no proxy). Fails on protected domains; fine for everything else.
// ---------------------------------------------------------------------------

async function fetchDirect(
  url: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<FetchedPage> {
  const { timeoutMs = 10_000, userAgent = DEFAULT_UA } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9," +
          "image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
      },
    });
    const html = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      html,
      viaProxy: false,
      transport: "direct",
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: "",
      viaProxy: false,
      transport: "direct",
      error: err instanceof Error ? err.message : "unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Firecrawl. POST JSON with { url, formats }. Response has the HTML nested
// under `data.rawHtml` (or `data.html` for the cleaned-up version — we want
// raw, since cheerio selectors rely on the actual page markup).
// ---------------------------------------------------------------------------

async function fetchViaFirecrawl(
  url: string,
  key: string,
  opts: { timeoutMs?: number } = {},
): Promise<FetchedPage> {
  // Firecrawl runs a real browser on their side and handles Cloudflare;
  // expect 10-30s per request.
  const { timeoutMs = 90_000 } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        // Request both formats:
        //  - rawHtml: unmodified DOM, needed for Zillow's __NEXT_DATA__ blob
        //    (used when we need the native DOM for structured extraction).
        //  - markdown: Firecrawl's cleaned-up markdown rendering, which is
        //    dramatically easier to parse than HTML — the visible copy
        //    + headings survive site redesigns that CSS selectors do not.
        formats: ["rawHtml", "markdown"],
        // Give the page a moment for any critical client-side hydration
        // to finish before the snapshot.
        waitFor: 2500,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        status: res.status,
        finalUrl: url,
        html: "",
        viaProxy: true,
        transport: "firecrawl",
        error: `Firecrawl HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: { html?: string; rawHtml?: string; markdown?: string };
      error?: string;
    };

    if (!json.success || !json.data) {
      return {
        ok: false,
        status: 0,
        finalUrl: url,
        html: "",
        viaProxy: true,
        transport: "firecrawl",
        error: `Firecrawl returned unsuccessful: ${json.error ?? "no data"}`,
      };
    }

    const html = json.data.rawHtml ?? json.data.html ?? "";
    const markdown = json.data.markdown;
    if (!html && !markdown) {
      return {
        ok: false,
        status: 0,
        finalUrl: url,
        html: "",
        viaProxy: true,
        transport: "firecrawl",
        error: "Firecrawl success but no HTML or markdown in response body",
      };
    }

    return {
      ok: true,
      status: 200,
      finalUrl: url,
      html,
      markdown,
      viaProxy: true,
      transport: "firecrawl",
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: "",
      viaProxy: true,
      transport: "firecrawl",
      error: `Firecrawl: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// ScraperAPI. Kept as a fallback path — useful if Firecrawl rate-limits or
// if a future paid plan gives us access to ultra_premium proxies.
// ---------------------------------------------------------------------------

async function fetchViaScraperApi(
  url: string,
  key: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<FetchedPage> {
  const { timeoutMs = 60_000, userAgent = DEFAULT_UA } = opts;
  const params = new URLSearchParams({
    api_key: key,
    url,
    ultra_premium: "true",
    country_code: "ca",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SCRAPERAPI_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9," +
          "image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-CA,en;q=0.9",
      },
    });
    const html = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: url,
      html,
      viaProxy: true,
      transport: "scraperapi",
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: "",
      viaProxy: true,
      transport: "scraperapi",
      error: err instanceof Error ? err.message : "unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Site mapping. Firecrawl's /map endpoint returns every URL Firecrawl can
// discover on a site, in one cheap call. We use it to find promo / specials
// pages on each building's marketing site without having to hard-code them.
// Falls back to returning `[url]` alone if no Firecrawl key is configured
// or the call fails, so downstream logic can still proceed with just the
// seed URL.
// ---------------------------------------------------------------------------

export type SiteMap = {
  ok: boolean;
  urls: string[];
  error?: string;
};

export async function mapSite(
  url: string,
  opts: { timeoutMs?: number; limit?: number } = {},
): Promise<SiteMap> {
  if (!process.env.FIRECRAWL_KEY) {
    return { ok: true, urls: [url] };
  }
  const { timeoutMs = 30_000, limit = 50 } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(FIRECRAWL_MAP_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        // Keep the scope tight — we only need the handful of pages that
        // actually have pricing or promo copy, not every blog post.
        limit,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        urls: [url],
        error: `Firecrawl /map HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      success?: boolean;
      links?: string[];
      error?: string;
    };
    if (!json.success || !Array.isArray(json.links)) {
      return {
        ok: false,
        urls: [url],
        error: `Firecrawl /map unsuccessful: ${json.error ?? "no links array"}`,
      };
    }
    // Always include the seed URL itself — sometimes it's not in the map.
    const seen = new Set<string>([url]);
    const urls = [url];
    for (const u of json.links) {
      if (typeof u === "string" && !seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }
    return { ok: true, urls };
  } catch (err) {
    return {
      ok: false,
      urls: [url],
      error: err instanceof Error ? err.message : "unknown /map error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
