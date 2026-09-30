import assert from "node:assert/strict";
import test from "node:test";
import { computeEffectiveRent, parseIncentive } from "../features/effective-rent";
import { detectConflicts } from "../features/conflicts";
import { createResearchTools, runDeterministicResearch, safeSourceUrl } from "../features/research";
import { runResearchAgent } from "../features/research-agent";
import { extractListingsWithTrace } from "../features/sources/parse-units";
import type { Listing } from "../features/types";

// Synthetic fixtures for tests only; never loaded by the app or scraper.
const base: Listing = { propertyId: "parker", unitType: "2-Bed", rent: 2400, sqft: 800, unitNumber: "101", unitId: "source-101", source: "official-site", sourceUrl: "https://example.test/units/101", scrapedAt: "2026-09-29T12:00:00Z", incentive: "1 month free on a 12-month lease", incentiveScope: "unit", availability: "available" };
const now = Date.parse("2026-09-29T13:00:00Z");
const context = (listings: Listing[]) => ({ listings, now });

test("one month free reuses deterministic effective rent", () => {
  const result = computeEffectiveRent(base);
  assert.equal(result.effectiveRent, 2200);
  assert.equal(result.monthlySavings, 200);
});
test("dollar credit is amortized", () => {
  assert.equal(computeEffectiveRent({ ...base, incentive: "$1,200 move-in credit" }).effectiveRent, 2300);
});
test("ambiguous, conditional, combined, and time-limited incentives need review", () => {
  for (const incentive of ["Free parking", "Up to 2 months free", "1 month free & $500 bonus", "1 month free before August 31st", "10% off first month", "$500 gift card", "Ask about our specials"]) assert.equal(parseIncentive(incentive).kind, "needs-review", incentive);
});
test("rent conflicts preserve every source and timestamp", () => {
  const conflicts = detectConflicts([base, { ...base, rent: 2600, source: "rentals-ca", sourceUrl: "https://example.test/aggregator", scrapedAt: "2026-09-28T12:00:00Z" }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, "rent");
  assert.deepEqual(conflicts[0].values.map((v) => v.value), [2400, 2600]);
  assert.equal(conflicts[0].values[1].source, "https://example.test/aggregator");
});
test("availability, area and incentives conflicts; absent values are not disagreement", () => {
  assert.deepEqual(detectConflicts([base, { ...base, sqft: 900, availability: "leased", incentive: "$1200 credit" }]).map((c) => c.field), ["availability", "sqft", "incentive"]);
  assert.deepEqual(detectConflicts([base, { ...base, sqft: undefined, availability: undefined, incentive: undefined }]), []);
});
test("generated IDs, equal rent/area and different physical units do not imply identity", () => {
  assert.deepEqual(detectConflicts([{ ...base, unitNumber: undefined }, { ...base, unitNumber: undefined, rent: 2600 }]), []);
  assert.deepEqual(detectConflicts([base, { ...base, unitNumber: "102", rent: 2600 }]), []);
  assert.deepEqual(detectConflicts([base, { ...base, propertyId: "the-whitney", rent: 2600 }]), []);
});
test("known evidence supports raw rent; missing effective rent stays unknown", () => {
  assert.equal(createResearchTools(context([base])).execute("get_cheapest_units", { propertyIds: ["parker"] }).confidence, "SUPPORTED");
  const result = createResearchTools(context([{ ...base, incentive: undefined }])).execute("get_effective_rent", { propertyIds: ["parker"] });
  assert.equal(result.confidence, "UNKNOWN");
  assert.equal(result.evidence[0].effectiveRent, null);
  assert.equal(result.rows.length, 0);
});
test("partial comparison reports missing data and retains both buildings", () => {
  const answer = runDeterministicResearch("I'm choosing between Parker and Whitney. Compare effective rent, square footage, incentives, and tell me what information is still missing.", context([base, { ...base, propertyId: "the-whitney", incentive: undefined, sqft: undefined }]));
  assert.equal(answer.confidence, "PARTIAL");
  assert.equal(answer.sources?.length, 2);
  assert.match(answer.warnings!.join(" "), /The Whitney/);
  assert.equal(answer.sources![1].effectiveRent, null);
});
test("empty data is UNKNOWN and has no invented citations", () => {
  const answer = runDeterministicResearch("Which 2-bedroom is actually cheapest after incentives?", context([]));
  assert.equal(answer.confidence, "UNKNOWN");
  assert.deepEqual(answer.sources, []);
});
test("effective cheapest demo ranks measured rent before headline rent", () => {
  const result = runDeterministicResearch("Which 2-bedroom is actually cheapest after incentives?", context([base, { ...base, propertyId: "the-whitney", rent: 2300, incentive: "$120 credit" }]));
  assert.match(result.headline, /Parker/);
  assert.match(result.headline, /2,200.00/);
});
test("property-wide incentive is not assumed to apply to a unit", () => {
  const result = createResearchTools(context([{ ...base, incentiveScope: "property" }])).execute("get_effective_rent", {});
  assert.equal(result.evidence[0].effectiveRent, null);
  assert.equal(result.confidence, "UNKNOWN");
});
test("conflict demo compares current and previous observations without resolving", () => {
  const answer = runDeterministicResearch("Which buildings have conflicting pricing information?", { ...context([base]), previous: [{ ...base, rent: 2600 }] });
  assert.equal(answer.confidence, "CONFLICTING");
  assert.equal(answer.conflicts?.length, 1);
  assert.equal(answer.trace?.conflictsDetected.length, 1);
});
test("unidentifiable records cannot establish source agreement", () => {
  assert.equal(runDeterministicResearch("Which buildings have conflicting pricing information?", context([{ ...base, unitNumber: undefined }])).confidence, "UNKNOWN");
});
test("averages reuse deterministic rollups and are withheld on conflicts", () => {
  const tool = createResearchTools(context([base, { ...base, unitNumber: "102", rent: 2600 }]));
  assert.equal(tool.execute("get_average_rent", { propertyIds: ["parker"] }).rows[0].value, "$2,500.00");
  assert.equal(createResearchTools(context([base, { ...base, rent: 2600 }])).execute("get_average_rent", {}).rows.length, 0);
});
test("tool validation rejects arbitrary tools, properties, and invalid numbers", () => {
  const tool = createResearchTools(context([base]));
  for (const [name, args] of [["shell", {}], ["compare_properties", {}], ["search_listings", { propertyIds: ["invented"] }], ["get_units_under_budget", { budget: -1 }], ["search_listings", { limit: Infinity }]] as const) assert.throws(() => tool.execute(name, args));
});
test("legacy cheapest, average, count, and building queries remain available", () => {
  for (const q of ["Cheapest 2-Bed", "Average rent for 2-Bed", "How many units", "Units at Parker", "Best $/sqft 2-Bed"]) {
    const answer = runDeterministicResearch(q, context([base]));
    assert.equal(answer.sources?.length, 1, q);
    assert.ok(answer.trace?.tools.length, q);
  }
});
test("real source URLs are preserved; unknown and unsafe ones stay absent", () => {
  assert.equal(safeSourceUrl("javascript:alert(1)"), undefined);
  assert.equal(createResearchTools(context([{ ...base, sourceUrl: undefined }])).execute("search_listings", {}).evidence[0].sourceUrl, undefined);
});
test("scraper preserves source pages, explicit unit numbers and availability", () => {
  const result = extractListingsWithTrace("<!-- page: https://example.test/a -->\nUnit 101 2-Bed $2400 800 sqft available\n<!-- page: https://example.test/b -->\nUnit 101 2-Bed $2600 800 sqft leased", "parker", base.scrapedAt, undefined);
  assert.equal(result.listings.length, 2);
  assert.equal(result.listings[0].sourceUrl, "https://example.test/a");
  assert.equal(result.listings[1].sourceUrl, "https://example.test/b");
  assert.equal(result.listings[0].unitNumber, "101");
  assert.equal(detectConflicts(result.listings).length, 2);
});
test("mock observations are excluded from research", () => {
  assert.equal(createResearchTools(context([{ ...base, source: "mock" }])).execute("search_listings", {}).evidence.length, 0);
});

function fakeProvider(steps: Array<{ name: string; input: unknown }>, capture: unknown[] = []): typeof fetch {
  let n = 0;
  return (async (_url, init) => {
    capture.push(JSON.parse(String(init?.body)));
    const step = steps[n++];
    if (!step) return new Response("unavailable", { status: 503 });
    return Response.json({ stop_reason: "tool_use", content: [{ type: "tool_use", id: `call-${n}`, ...step }] });
  }) as typeof fetch;
}
test("Claude tool roundtrip uses observations and captures only observable actions", async () => {
  const requests: unknown[] = [];
  const answer = await runResearchAgent("Cheapest at Parker?", context([base]), { apiKey: "test-not-a-real-key", fetch: fakeProvider([
    { name: "get_cheapest_units", input: { propertyIds: ["parker"], basis: "effective" } },
    { name: "answer_question", input: { summary: "Parker has the lowest measured effective rent in this cohort [listing-1].", resultIds: ["result-1"], confidence: "SUPPORTED" } },
  ], requests) });
  assert.equal(answer.mode, "claude");
  assert.equal(answer.sources?.[0].effectiveRent, 2200);
  assert.equal(answer.trace?.tools[0].tool, "get_cheapest_units");
  assert.equal(requests.length, 2);
  assert.doesNotMatch(JSON.stringify(answer), /test-not-a-real-key|thinking/);
});
test("provider failure and excessive loops fall back without leaking error bodies", async () => {
  const failing = (async () => new Response("secret provider error", { status: 500 })) as typeof fetch;
  const answer = await runResearchAgent("Cheapest 2-Bed", context([base]), { apiKey: "test", fetch: failing });
  assert.equal(answer.mode, "deterministic");
  assert.match(answer.warnings!.join(" "), /fallback/);
  assert.doesNotMatch(JSON.stringify(answer), /secret provider/);
  const requests: unknown[] = [];
  await runResearchAgent("Cheapest 2-Bed", context([base]), { apiKey: "test", fetch: fakeProvider(Array.from({ length: 10 }, () => ({ name: "search_listings", input: {} })), requests) });
  assert.equal(requests.length, 6);
});
test("invented citations are rejected and cannot render as sources", async () => {
  const answer = await runResearchAgent("Cheapest 2-Bed", context([base]), { apiKey: "test", fetch: fakeProvider([
    { name: "search_listings", input: {} },
    { name: "answer_question", input: { summary: "Fake [listing-999]", resultIds: ["result-1"], confidence: "SUPPORTED" } },
  ]) });
  assert.equal(answer.mode, "deterministic");
  assert.ok(answer.trace?.tools.some((t) => t.error));
  assert.ok(answer.sources?.every((s) => s.id !== "listing-999"));
});
test("model cannot upgrade missing data or omit detected conflicts", async () => {
  const answer = await runResearchAgent("Compare", context([base, { ...base, rent: 2600 }]), { apiKey: "test", fetch: fakeProvider([
    { name: "search_listings", input: {} },
    { name: "answer_question", input: { summary: "The observations disagree.", resultIds: ["result-1"], confidence: "SUPPORTED" } },
  ]) });
  assert.equal(answer.confidence, "CONFLICTING");
  assert.equal(answer.conflicts?.length, 1);
});

test("explicit no-incentive statement is distinguished from missing incentive text", () => {
  const result = createResearchTools(context([{ ...base, incentive: "No incentives" }])).execute("get_effective_rent", { propertyIds: ["parker"] });
  assert.equal(result.evidence[0].effectiveRent, 2400);
});
test("fractional months and explicit week lease terms are not misparsed", () => {
  assert.equal(computeEffectiveRent({ ...base, incentive: "1.5 months free on a 12-month lease" }).effectiveRent, 2100);
  assert.deepEqual(parseIncentive("6 weeks free on a 14-month lease"), { kind: "weeks-free", weeksFree: 6, statedTerm: 14 });
});
test("large property comparison shows both properties", () => {
  const listings = [...Array.from({ length: 100 }, (_, i) => ({ ...base, unitNumber: String(i) })), { ...base, propertyId: "the-whitney" }];
  const result = createResearchTools(context(listings)).execute("compare_properties", { propertyIds: ["parker", "the-whitney"] });
  assert.ok(result.rows.some((r) => r.propertyId === "the-whitney"));
});
test("fallback effective budgets and averages use the requested measure", () => {
  const budget = runDeterministicResearch("2-beds under $2250 effective rent", context([base]));
  assert.equal(budget.rows?.length, 1);
  const average = runDeterministicResearch("Average effective rent at Parker", context([base]));
  assert.equal(average.rows?.[0].value, "$2,200.00");
});
test("unknown area cannot produce a supported price-per-square-foot answer", () => {
  assert.equal(runDeterministicResearch("Best $/sqft 2-Bed", context([{ ...base, sqft: undefined }])).confidence, "UNKNOWN");
});
test("model-supplied monetary amounts must exist in deterministic results", async () => {
  const answer = await runResearchAgent("Cheapest 2-Bed", context([base]), { apiKey: "test", fetch: fakeProvider([
    { name: "search_listings", input: {} },
    { name: "answer_question", input: { summary: "Rent is $123.45", resultIds: ["result-1"], confidence: "SUPPORTED" } },
  ]) });
  assert.equal(answer.mode, "deterministic");
  assert.doesNotMatch(answer.headline, /123.45/);
});
