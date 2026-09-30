# Rental Comp Analyzer

A source-grounded rental research agent that aggregates competitor listings, normalizes incentives into effective rent, and answers comparison questions while preserving provenance, conflicts, and uncertainty.

Built by Anika Ahluwalia. This is a research prototype, not a production-ready service.

## Why I built it

Comparing advertised rents is difficult when incentives have different terms, sources disagree, and important fields are missing. A lower headline rent is not necessarily a lower lease cost. The technical problem is to normalize what can be measured while making the limits of the evidence visible.

The existing Midtown Toronto dashboard, property pages, comparison table, scraping workflow, login roles, and PDF export remain available. The Ask page adds a research layer over stored observations.

## System architecture

- **Next.js / TypeScript** serves the existing dashboard and authenticated API routes.
- **Firecrawl** retrieves official and aggregator pages; direct fetch and the existing ScraperAPI path remain fallbacks.
- **Scraping and storage** retain original per-source observations separately from the dashboard's legacy consolidated view. The disk snapshot holds current observations and one previous snapshot; there is no new database.
- **Deterministic calculations** in `features/effective-rent.ts` and `features/consolidation.ts` perform financial calculations. Conditional, combined, and ambiguous incentives require review.
- **Research tools** in `features/research.ts` filter observations, calculate measures, preserve evidence, and classify uncertainty.
- **Claude orchestration** in `features/research-agent.ts` is server-only. The existing deterministic parser remains a fallback.
- **Answer UI** renders financial rows, Sources, conflict values, confidence, and an expandable execution trace.

## Agent/tool-use design

The LLM decides what information it needs and which tools to call, but deterministic code performs calculations and the final answer must remain grounded in real listing data.

With `ANTHROPIC_API_KEY` configured, Claude interprets the question, requests tools, receives their results, and submits a synthesis with validated result references. Without a key, or if the provider fails or exceeds limits, the local parser answers supported questions.

Tools: `search_listings`, `get_property_listings`, `get_cheapest_units`, `get_average_rent`, `get_effective_rent`, `compare_properties`, `get_incentives`, `get_units_under_budget`, and `get_conflicts`. Search operates on the stored dataset; it does not initiate a live web scrape.

The implementation uses the [Anthropic Messages tool-use protocol](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) directly, without an orchestration framework. It validates tool names, property IDs, filters, budgets, limits, and citation references. Each query is limited to six provider turns, one tool per turn, a 45-second overall provider deadline, and bounded output. Model-facing evidence is capped at 80 observations per tool result; full inspected cohorts remain available in Sources. Keys are read only on the server and never returned to the browser.

“How this answer was built” records the question, tools, arguments, inspected observation counts, evidence identifiers, conflicts, confidence, and final answer. It records observable actions, not chain-of-thought. Traces are returned with the answer and kept in the page's state, not persisted to a new database or provider log.

## Grounding and provenance

Evidence retains property name, observation identifier, physical unit number when explicitly observed, source URL, scrape timestamp, raw rent, measured effective rent, area, and incentive text. Incentives can have a separate source URL. Generated observation IDs are never treated as physical unit identity.

Missing data remains missing. In particular, no incentive text does **not** establish that there are no incentives. Effective rent remains unknown for unparseable offers or property-wide promotions whose unit eligibility has not been confirmed. The existing calculator's default 12-month normalization is disclosed; a source-stated term takes precedence for supported free-month offers. Effective rents exclude utilities, deposits, and other fees unless explicitly represented in the input calculation.

The server assigns `SUPPORTED`, `PARTIAL`, `CONFLICTING`, or `UNKNOWN`. Missing properties, incomplete fields, unknown provenance, and observations older than seven days produce visible limitations. Confidence is an evidence classification, not a statistical probability. Claude can downgrade certainty but cannot remove server-detected conflicts or upgrade missing data to supported evidence.

The bundled seed is an existing stored scrape, **not live market data**. Older snapshots may lack source URLs or reliable unit identity; missing provenance is displayed honestly and is not reconstructed from a configured homepage. New scrapes capture page URLs. No synthetic rental data is used in research answers; synthetic fixtures are limited to tests and the existing offline PDF tool.

## Handling conflicting data

`features/conflicts.ts` compares rent, availability, square footage, and incentive text only when records share a property and an explicit physical unit number. Price, area, floorplan, and generated row IDs are insufficient to establish identity. Missing fields are not disagreements.

Conflicting sources are surfaced rather than hidden. Every observed conflicting value retains its URL and timestamp. The previous snapshot can reveal changes over time; those are labeled as source **or snapshot** disagreement, not automatically called erroneous. The tools withhold averages when identified units conflict. Rankings retain visible conflict warnings and cannot establish a unique winner in that case.

The legacy dashboard still uses its existing consolidation behavior. The research layer reads the unmerged observations so it does not lose conflicting values. One prior snapshot is retained, not a complete historical time series.

## Try it locally

```bash
cp .env.local.example .env.local
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Add `FIRECRAWL_KEY` for the existing scrape transport. Add `ANTHROPIC_API_KEY` to enable Claude; `ANTHROPIC_MODEL` optionally overrides the default model. Never prefix these variables with `NEXT_PUBLIC_`.

Existing demo accounts:

| Email | Password | Access |
| --- | --- | --- |
| admin@midtowncomp.com | admin123 | Admin |
| analyst@midtowncomp.com | analyst-demo-2026 | Scrape, view, export |
| viewer@example.com | viewer-demo-2026 | View, export |

The existing `/signup` flow creates viewers.

Try these on the Ask page:

1. “Which 2-bedroom is actually cheapest after incentives?”
2. “Which buildings have conflicting pricing information?”
3. “I'm choosing between Parker and Whitney. Compare effective rent, square footage, incentives, and tell me what information is still missing.”

These questions also have deterministic fallback handling. With incomplete stored data, a useful answer may be PARTIAL or UNKNOWN rather than naming a winner.

## Tests and checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover free-month and dollar-credit calculations, ambiguous incentives, all four conflict fields, uncertain identity, missing evidence, provenance extraction, fallback queries, and a simulated Messages/tool-result roundtrip. Provider responses are injected fixtures; tests make no LLM calls and do not verify live model behavior or live rental sites.

## Failure modes and limitations

- Scraping is heuristic. Page changes, anti-bot responses, or nearby unrelated text can cause missing or incorrectly associated fields. Inspect source pages before making rental decisions.
- Site-wide offers are not automatically eligible for every unit. Expired, conditional, combined, or ambiguous terms require review. Historical eligibility cannot be established from a snapshot alone.
- Many pages omit physical unit numbers; conflict detection then cannot assess identity. Observation counts and means are not verified distinct-unit inventory statistics.
- An LLM can still misinterpret a question or produce unsupported prose. Validated references, deterministic displayed calculations, mandatory tool use, and conservative confidence constrain it; they are not a formal proof that every sentence is entailed by the evidence.
- The deterministic fallback supports a finite set of intents and cannot answer every open-ended question.
- A single previous snapshot supports limited comparison, not trend analysis. Local files and serverless temporary storage are not a shared durable datastore.
- Authentication remains the existing demo implementation, including unsigned session cookies. This change does not make it suitable for public production use. There is no new authentication, billing, rate limiting, or tenancy layer.
- Sources and the research trace are currently on the Ask page; the existing PDF report and other dashboard views have not been redesigned to include them.
