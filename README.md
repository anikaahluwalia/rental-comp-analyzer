# Fitzrovia · Rental Comp Intelligence

A rental comp scraper and executive dashboard for Fitzrovia's asset management team. Built as the take-home for the AI & Software Development intern interview (March 2026).

This repo is a working end-to-end build: auth, mock scraper, consolidated dashboard, per-building drill-down, PDF export with executive insights, an apples-to-apples effective-rent compare view, and a natural-language query bar.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Full-stack in one repo — API routes for the scraper trigger, PDF export, and NL query; server components for secure data rendering. |
| Language | TypeScript (strict) | Normalizing ten different listing sites into one `Listing` shape is only sane with compile-time types. |
| Styling | Tailwind CSS | Ships with the project, no runtime cost. |
| Auth | scrypt-hashed passwords in a local JSON store + httpOnly cookie session | Real credential check. Swap-in slot for `iron-session` / Auth.js / Clerk — one file to change. |
| PDF | `@react-pdf/renderer` | Server-side PDF without Chromium. Deterministic, small deploy footprint, easy to regression-test. |
| Effective rent | In-repo parser (`features/effective-rent.ts`) | Normalizes incentives ("1 month free", "$500 credit", "10% off") into a monthly effective rent so you can compare apples-to-apples. Conservative by design — ambiguous perks are flagged, not silently credited. |
| NL query | Typed intent parser (drop-in for Claude tool-use) | Ships a working NL experience without an API key; same response shape as the future LLM endpoint. |
| Persistence | In-memory store (globalThis) + JSON snapshot at `.data/listings.json`; Postgres planned | Keeps the take-home self-contained while still surviving hot reloads. |
| Scraping | Per-building multi-source scraper — each building's own official site (primary) plus rentals.ca (and optionally zillow.ca / liv.rent) as secondary coverage. Firecrawl under the hood (site-map discovery + markdown-first parsing), `Promise.allSettled` fault-tolerance, dedupe across sources by (unitType, rent, sqft). | Operators' own sites are the source of truth — no aggregator lag or blind spots — but aggregators rescue us when an operator site returns zero (JS widget fail, Cloudflare block, stale marketing page). One universal markdown parser reads all layouts; a site redesign is regex tuning, not a full adapter rewrite. If every source fails, the app shows the failure honestly — no silent fallback to synthetic data. |

---

## Getting started

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

Seeded on first login. Passwords are scrypt-hashed in `.data/users.json` (git-ignored).

| Email | Password | Role |
| --- | --- | --- |
| `admin@fitzrovia.ca` | `fitzrovia-admin-2026` | admin |
| `analyst@fitzrovia.ca` | `fitzrovia-analyst-2026` | analyst |
| `viewer@example.com` | `viewer-demo-2026` | viewer |

Or **create a new account** from `/signup`. `@fitzrovia.ca` addresses are auto-promoted to `analyst`; everyone else starts as `viewer` (read-only + PDF export). Admin must be provisioned manually — in production this is a separate admin-invite flow.

Useful scripts:

```bash
npm run typecheck   # strict TS check
npm run build       # production build
npm run lint        # ESLint
```

---

## Features

### Authentication & sign-up
- `/` login, `/signup` registration — matching split-layout design.
- Passwords hashed with Node's built-in `scrypt` (no npm dep, constant-time compare).
- Local user store at `.data/users.json` (git-ignored). Swap for Postgres + managed auth in production — one file change (`features/users.ts`).
- Role-based access: admin / analyst / viewer. Policies centralized in `features/session-config.ts` so new routes gate in one line.

### Dashboard
- Market snapshot header with unit count + incentive tally.
- Unit-type rollup cards (avg rent, range, avg $/sqft, best-deal building per type).
- Per-building matrix showing avg rent per unit type + incentive flag.
- Click-through drill-down to unit-level listings per building.

### Scrape Now (analyst / admin only)
- `POST /api/scrape` runs the building-site scraper across every property in parallel (`Promise.allSettled`, batched), pulling pricing and incentives straight from each operator's own marketing site, and bumps `lastScrapedAt`.
- Each building's scrape discovers promo pages via Firecrawl's site map, then scrapes the floorplans page + homepage + any specials/offers pages it finds. One universal parser finds the unit × rent × sqft tuples across every operator's layout.
- Per-building `ScrapeRun` metadata (status, listingsFound, pagesScraped, error reason) is returned so an operator can tell whether a zero came from a 403, a timeout, or a real "no units available".
- Viewers see "read-only access" state instead of the button — clean RBAC demonstration.

### PDF export (all roles)
- `GET /api/export-pdf` streams a branded three-page PDF built with `@react-pdf/renderer`.
- Contents: executive insights (auto-generated from the data), $/sqft bar chart, unit-type rollup table, per-building breakdown, methodology, and provenance (generated-by + source-data-as-of).
- No Chromium dependency — faster builds and smaller deploys than a Puppeteer pipeline.

### Apples-to-apples compare (`/dashboard/compare`)
- Normalizes every listing by **raw rent**, **effective rent** (after amortizing incentives over a 12-month lease), and **effective $/sqft** so you can compare units fairly across buildings.
- Three-way basis toggle: Raw rent / Effective rent / Rent per sqft. Ranks rebuild on the fly.
- Grouped by unit type (Bachelor / 1-Bed / 2-Bed / 3-Bed) with a **Best Value** badge on the top row per cohort.
- Every row with an incentive has a **Show math** drill-down revealing the parse ("1 month free on a 12-month lease: 11 × $2,400 = $26,400 ÷ 12 = $2,200/mo") so the number is never a black box.
- Incentives that can't be cleanly parsed (parking value, waived locker fees, move-in-window bonuses) get tagged **Review needed** rather than silently credited — accuracy over confidence for pricing calls.
- Parser (`features/effective-rent.ts`) handles: `X months free`, `X weeks free`, `$X credit/bonus/rebate`, `X% off`. Everything else falls through to the review queue.

### Natural-language query (`/dashboard/query`)
- Ask in plain English: _"cheapest 2-bed"_, _"1-beds under $2800"_, _"buildings with incentives"_, _"units at Parker"_.
- Deterministic intent parser returns a typed `Answer` with headline, supporting rows, building citations, and suggested follow-ups.
- Same request/response shape as the planned Claude + tool-use implementation — swapping in the LLM is a route-handler edit.

---

## Project layout

Folders are organized by *feature*, not by layer. `features/` holds the domain logic (types, auth, scraping, consolidation, query, PDF rendering); `interface/` holds the React UI components; `app/` is the Next.js route tree; `tools/` holds offline scripts that don't ship to production.

```
app/                          Next.js App Router
  layout.tsx                  root layout + Inter / Playfair fonts
  globals.css                 Tailwind + brand component classes
  page.tsx                    login screen (redirects to /dashboard if signed in)
  signup/page.tsx             signup screen
  dashboard/
    layout.tsx                header + nav + sign-out, guarded by session
    page.tsx                  overview: unit-type cards + per-building matrix
    buildings/[id]/page.tsx   drill-down with unit-level table
    compare/page.tsx          apples-to-apples effective-rent compare
    query/page.tsx            natural-language ask bar
  api/
    auth/login/route.ts       POST: verifies scrypt hash, sets session
    auth/signup/route.ts      POST: creates user, hashes password, sets session
    auth/logout/route.ts      POST: clears session
    scrape/route.ts           POST: runs the building-site scraper (role-gated)
    export-pdf/route.ts       GET : streams the branded PDF report
    query/route.ts            POST: routes NL question to intent parser

interface/                    React UI components
  FitzroviaMark.tsx           brand SVG
  LoginForm.tsx               login client form
  SignupForm.tsx              signup client form
  SignOutButton.tsx           logout
  DashboardNav.tsx            Overview / Compare / Ask tabs
  ScrapeNowButton.tsx         role-gated scrape trigger
  ExportPdfButton.tsx         PDF download with loading + error states
  CompareTable.tsx            client compare UI: basis toggle + show-math drill-down
  QueryBar.tsx                client NL input + answer card

features/                     Domain logic
  auth.ts                     getSession / setSession / clearSession
  session-config.ts           Edge-safe session constants + ROLE_CAN policy
  users.ts                    scrypt password store (create / verify / seed)
  properties.ts               seed list of the 10 target buildings + per-building site URLs
  types.ts                    Property, Listing, UnitType, ScrapeRun, etc.
  mock-data.ts                DEV/TEST-only synthetic generator (not on runtime path)
  listings.ts                 in-memory store (globalThis-backed) + triggerScrape + snapshot
  consolidation.ts            summarizeByUnitType / summarizeByBuilding
  effective-rent.ts           incentive parser + effective-rent calculator
  pdf-report.tsx              @react-pdf/renderer Document component
  query.ts                    NL intent parser (runQuery)
  format.ts                   CAD / sqft / relative-time formatters
  ui-style.ts                 shared inline style tokens (clay accents, headlines)
  sources/                    building-site scraper
    index.ts                  scrapeAll orchestrator — batched, fault-tolerant
    fetch-html.ts             Firecrawl wrapper (markdown + HTML + /map modes)
    building-site.ts          per-building scraper: site map → pick pages → parse
    parse-units.ts            universal markdown parser for unit × rent × sqft
    extract-incentives.ts     site-wide incentive extractor
    parse-helpers.ts          shared rent / sqft / unit-type extractors

tools/                        offline scripts (not shipped)
  probe.ts                    per-building probe for debugging the scraper end-to-end
  render-test.ts              render the PDF offline against mock data (no Firecrawl credits)

middleware.ts                 guards /dashboard/*
```

---

## Authentication — real, not a placeholder

Passwords are hashed with Node's `scrypt` (16-byte salt, 64-byte key) and verified with `timingSafeEqual` to prevent timing attacks. The user file is stored locally at `.data/users.json` and git-ignored. The login route returns a single generic "Incorrect email or password." for both wrong-password and no-such-user so attackers can't enumerate accounts.

For production:

- **Move the user store to Postgres.** `features/users.ts` is a one-file swap — same `createUser` / `verifyUser` signatures backed by a `users` table + a SQL query.
- **Consider a managed provider** — Clerk or Auth.js if speed matters more than cost.
- **Add MFA** on admin accounts.
- **Add rate limiting** on `/api/auth/login` via middleware or Upstash so brute-force attempts get throttled.

The session layer (`features/auth.ts`) and policy layer (`features/session-config.ts`) don't need to change.

---

## How this project maps to the AI & Software Development Intern role

The brief is a rental-comp scraper, but it's really a miniature version of the day-job. Each feature maps to a specific JD responsibility:

| JD responsibility | What in this project demonstrates it |
| --- | --- |
| **LLM-powered internal tools (Claude / OpenAI API)** | The NL-query bar ships a typed intent parser today and is wired as a drop-in for Claude with structured tool-use — same request/response shape, one route-handler edit. |
| **Multi-step AI pipelines for data extraction** | The scrape pipeline is a clean multi-stage flow: fetch → parse → (LLM-fallback extract) → normalize → persist → serve. Mock generator stands in for per-site scrapers. |
| **RAG over internal documents** | Roadmap item: embed scrape history + incentive copy, query via retrieval. Same pattern as RAG over deal memos. |
| **React + Tailwind + TypeScript / Node full-stack** | Exactly this stack — Next.js 16 App Router, TypeScript strict mode, Tailwind, server + client components. |
| **Automated data pipelines feeding dashboards** | Scrape → consolidation → dashboard + PDF + effective-rent compare + NL query. "Market intelligence into internal dashboards" in the literal sense. |
| **n8n / workflow automation** | Roadmap: daily scrape schedule, Slack alert on >5% price moves, email digest for asset management. Each is a natural n8n workflow. |
| **Relational DBs + SQL** | Postgres planned (Supabase / Neon) for listings + scrape-run metadata; historical `scraped_at` column enables trend queries. |
| **Secure development: authn/authz, input validation, secrets management** | scrypt-hashed auth + signup flow, role-based policy, validated inputs on every API route, secrets via `.env.local`. See the Security table below. |
| **Role-based access control** | `features/session-config.ts` defines admin / analyst / viewer and a `ROLE_CAN` policy map. `can(session, 'triggerScrape' \| 'exportPdf')` gates every privileged action. |
| **Cloud deployment** | Vercel (web) + Railway/Render (scraper worker, needs Playwright) + managed Postgres. |
| **Clean, well-documented code + code review** | Strict TS, per-module doc comments, a real README, typed domain model, explicit "known limitations" section. |
| **Evaluating new AI tooling** | The LLM-fallback extractor is a natural fit for an eval harness: a fixture set of HTML pages with known-correct output, scored across prompt/model variants. |

---

## Security

| Concern | Implementation |
| --- | --- |
| **Authentication** | Scrypt-hashed passwords, timing-safe compare, httpOnly + SameSite=Lax cookie, secure in production. Generic error messages prevent email enumeration. |
| **Authorization** | `session.role` + `ROLE_CAN` policy map. `can(session, 'action')` check on every privileged route. |
| **Input validation** | Every API route validates body shape before touching state. `/api/auth/signup` enforces 8-char password minimum + email regex. |
| **Secrets management** | Nothing in git. `.env.local` for dev, platform env vars for deployment. `.data/` is gitignored. |
| **API key protection** | Anthropic key (when the LLM query lands) is server-only. The client never sees it. |
| **CSRF** | SameSite=Lax + same-origin API calls give a baseline; upgrade to a CSRF token if we add third-party origins. |
| **Rate limiting** | Planned on login/signup via middleware + Upstash. NL-query endpoint: per-session cap. |
| **Data handling** | Scraped listings are public marketing data. Scrape logs are internal-only; no PII is collected. |

---

## Known limitations / honest notes

- **Brief says "nine properties", lists ten.** Flagged — we scrape all ten listed.
- **Primary source per building: its own official site. Secondary: rentals.ca.** Per Fitzrovia's guidance, the building's own marketing page is the source of truth. We also pull from rentals.ca (and optionally zillow.ca / liv.rent if configured in `features/properties.ts`) as secondary coverage, so a building still shows pricing when its own site is dark — JS widget fail, Cloudflare block, operator hasn't updated, etc. Duplicates across sources are deduped by `(unitType, rent, sqft)` with official-site preferred. Nine of the ten buildings run dedicated sites (Parker, Story of Midtown, eCentral, The Montgomery, The Whitney, The Hampton, Corner on Broadway, Akoya, plus The Selby on Tricon's operator site). E18HTEEN publishes availability on Realstar's myrental.ca instead, so we pull from there.
- **In-memory store + JSON snapshot.** Listings live in `globalThis` and are snapshotted to `.data/listings.json` between restarts. A production build moves this to Postgres so we can query scrape history (trend view, alerts). The consolidation layer currently re-computes in-process on each request — trivial at 10 buildings, would become a SQL `GROUP BY` at scale.
- **No silent fallback to mock data.** If a scrape returns zero (block, rate limit, parser regression), the dashboard shows the failure and the per-building `ScrapeRun` reasons — rather than quietly serving synthetic data that looks real. The mock generator lives in `features/mock-data.ts` for offline PDF rendering only (`tools/render-test.ts`).
- **Next 16 middleware deprecation warning.** Current `middleware.ts` works; Next is asking for a `proxy.ts` rename in a future version.
- **NL query is deterministic, not LLM-backed yet.** The `Answer` shape is designed so swapping in Claude + tool-use is a route-handler edit. See `features/query.ts` for the intents it covers.
- **Effective-rent parser is intentionally narrow.** It handles `X months free`, `X weeks free`, `$X credit`, and `X% off`. Anything fuzzier gets tagged for manual review rather than auto-credited — better to be conservative on a number that drives pricing decisions.
- **Hero image is an Unsplash placeholder.** Swap for a licensed Fitzrovia photo for the real submission.

---

## What I'd build next if given more time

1. **Scrape history in Postgres.** Per-run metadata (status, listings-found, pages-scraped, error) already exists in memory + a JSON snapshot — next step is persisting every run so we can diff week-over-week and see which buildings went dark.
2. **Claude-backed NL query.** Swap the deterministic `runQuery` for an Anthropic API call with a structured filter tool. Same `Answer` shape.
3. **LLM-fallback extractor.** The universal regex parser handles the ten current sites, but a site redesign can silently drop listings. Fall back to Claude with a typed schema when the regex returns zero on a page that clearly has rent text — parser resilience + a tool-use story.
4. **Trend view.** Once we have two weeks of scrape history, plot per-unit-type rent over time so leasing teams can react within a day, not a month.
5. **Anomaly alerts via n8n.** "The Whitney dropped their 2-bed by 8% overnight" → Slack + email. Exactly the n8n pattern the JD describes.
6. **RAG index of scrape history.** Embed listings + incentive language, query in natural language.
7. **LLM-fallback for fuzzy incentives.** Today the parser flags anything it can't cleanly match as "review needed." A production build would hand those strings to Claude with a typed schema (monthsFree / weeksFree / dollarCredit / percentOff) and surface the result with a confidence score — the same tool-use pattern the JD describes.
8. **LLM-extraction eval harness.** Fixture set of HTML snapshots with known-good output, scored across prompt/model variants. R&D artifact worth presenting at Fitzrovia's quarterly pipeline review.
