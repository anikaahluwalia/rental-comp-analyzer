import { detectConflicts, unitIdentity, type DataConflict } from "./conflicts";
import { enrichListings } from "./effective-rent";
import { summarizeByUnitType } from "./consolidation";
import { PROPERTIES } from "./properties";
import { detectDollar, detectUnitType, runQuery, type Answer } from "./query";
import { UNIT_TYPES, type Listing, type UnitType } from "./types";

export type AnswerConfidence = "SUPPORTED" | "PARTIAL" | "CONFLICTING" | "UNKNOWN";
export type Evidence = {
  id: string;
  propertyId: string;
  propertyName: string;
  unitType: UnitType;
  listingId?: string;
  unitNumber?: string;
  sourceUrl?: string;
  scrapedAt?: string;
  rawRent: number;
  effectiveRent: number | null;
  sqft: number | null;
  pricePerSqft: number | null;
  incentive?: string;
  incentiveSourceUrl?: string;
  availability?: string;
  calculation: string;
};
export type ToolAction = {
  tool: string;
  arguments: Record<string, unknown>;
  listingsInspected: number;
  evidenceIds: string[];
  summary: string;
  error?: string;
};
export type ResearchTrace = {
  question: string;
  tools: ToolAction[];
  listingsInspected: number;
  sourcesUsed: string[];
  conflictsDetected: DataConflict[];
  confidence: AnswerConfidence;
  finalAnswer: string;
};
export const TOOL_NAMES = ["search_listings", "get_property_listings", "get_cheapest_units", "get_average_rent", "get_effective_rent", "compare_properties", "get_incentives", "get_units_under_budget", "get_conflicts"] as const;
export type ToolName = typeof TOOL_NAMES[number];
export type ToolArgs = { propertyIds?: string[]; unitType?: UnitType; budget?: number; basis?: "raw" | "effective"; limit?: number };
export type ToolResult = {
  id: string;
  summary: string;
  evidence: Evidence[];
  rows: NonNullable<Answer["rows"]>;
  conflicts: DataConflict[];
  warnings: string[];
  confidence: AnswerConfidence;
  listingsInspected: number;
};
export type ResearchContext = { listings: Listing[]; previous?: Listing[]; now?: number };

export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
const nameOf = (id: string) => PROPERTIES.find((p) => p.id === id)?.name ?? id;
const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function classifyConfidence(evidenceCount: number, missing: string[], conflicts: DataConflict[], answerable = true): AnswerConfidence {
  if (conflicts.length) return "CONFLICTING";
  if (!evidenceCount || !answerable) return "UNKNOWN";
  return missing.length ? "PARTIAL" : "SUPPORTED";
}

export function validateToolArgs(name: string, input: unknown): ToolArgs {
  if (!TOOL_NAMES.includes(name as ToolName)) throw new Error("Unknown research tool.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Tool arguments must be an object.");
  const a = input as Record<string, unknown>;
  if (Object.keys(a).some((key) => !["propertyIds", "unitType", "budget", "basis", "limit"].includes(key))) throw new Error("Unexpected tool argument.");
  if (a.propertyIds !== undefined && (!Array.isArray(a.propertyIds) || a.propertyIds.length === 0 || a.propertyIds.length > PROPERTIES.length || a.propertyIds.some((id) => typeof id !== "string" || !PROPERTIES.some((p) => p.id === id)))) throw new Error("Use property IDs from the supplied catalog.");
  if (a.unitType !== undefined && !UNIT_TYPES.includes(a.unitType as UnitType)) throw new Error("Invalid unit type.");
  if (a.basis !== undefined && a.basis !== "raw" && a.basis !== "effective") throw new Error("Invalid rent basis.");
  if (a.budget !== undefined && (typeof a.budget !== "number" || !Number.isFinite(a.budget) || a.budget <= 0 || a.budget > 100000)) throw new Error("Invalid budget.");
  if (a.limit !== undefined && (typeof a.limit !== "number" || !Number.isInteger(a.limit) || a.limit < 1 || a.limit > 80)) throw new Error("Limit must be 1–80.");
  if (["get_property_listings", "compare_properties"].includes(name) && !a.propertyIds) throw new Error("propertyIds is required.");
  if (name === "compare_properties" && (a.propertyIds as string[]).length < 2) throw new Error("Choose at least two properties.");
  if (name === "get_units_under_budget" && a.budget === undefined) throw new Error("budget is required.");
  return a as ToolArgs;
}

function evidenceFor(listings: Listing[]): Evidence[] {
  return enrichListings(listings).map((l, index) => ({
    id: `listing-${index + 1}`,
    propertyId: l.propertyId, propertyName: nameOf(l.propertyId), unitType: l.unitType,
    listingId: l.unitId, unitNumber: l.unitNumber,
    sourceUrl: safeSourceUrl(l.sourceUrl ?? l.floorplanUrl),
    scrapedAt: l.scrapedAt || undefined, rawRent: l.rent,
    // No text is not evidence of no discount. Site-wide promos are unconfirmed.
    effectiveRent: l.incentive?.trim() && l.incentiveScope !== "property" && (l.effective.applied || l.effective.discount.kind === "none") && l.effective.effectiveRent >= 0 ? l.effective.effectiveRent : null,
    sqft: l.sqft && l.sqft > 0 ? l.sqft : null,
    pricePerSqft: l.pricePerSqft,
    incentive: l.incentive, incentiveSourceUrl: safeSourceUrl(l.incentiveSourceUrl),
    availability: l.availability,
    calculation: l.incentiveScope === "property" ? "Property-wide promotion; unit eligibility needs review." : l.effective.explanation,
  }));
}

/** A request-scoped, read-only tool runner. Never imports network, keys, or the store. */
export function createResearchTools(context: ResearchContext) {
  const listings = context.listings.filter((l) => l.source !== "mock" && Number.isFinite(l.rent) && l.rent > 0);
  const evidence = evidenceFor(listings);
  const actions: ToolAction[] = [];
  const results: ToolResult[] = [];
  function execute(name: string, input: unknown): ToolResult {
    const args = validateToolArgs(name, input);
    const indices = listings.flatMap((l, i) => (!args.propertyIds || args.propertyIds.includes(l.propertyId)) && (!args.unitType || args.unitType === l.unitType) ? [i] : []);
    const selectedListings = indices.map((i) => listings[i]);
    const selectedEvidence = indices.map((i) => evidence[i]);
    const identities = new Set(selectedListings.map(unitIdentity).filter(Boolean));
    const previous = (context.previous ?? []).filter((l) => l.source !== "mock" && identities.has(unitIdentity(l)));
    const conflicts = detectConflicts([...selectedListings, ...previous]);
    const warnings: string[] = [];
    const propertyIds = args.propertyIds ?? PROPERTIES.map((p) => p.id);
    const missingProperties = propertyIds.filter((id) => !selectedListings.some((l) => l.propertyId === id));
    if (missingProperties.length) warnings.push(`No matching observations for: ${missingProperties.map(nameOf).join(", ")}.`);
    if (selectedEvidence.some((e) => !e.sourceUrl)) warnings.push("Some observations lack a captured source URL; no replacement citation is inferred.");
    if (selectedEvidence.some((e) => !e.scrapedAt || !Number.isFinite(Date.parse(e.scrapedAt)) || (context.now ?? Date.now()) - Date.parse(e.scrapedAt) > 7 * 86400000)) warnings.push("Some observations have missing timestamps or are more than seven days old; current prices and eligibility are unverified.");
    const needsEffective = ["get_effective_rent", "get_incentives", "compare_properties"].includes(name) || args.basis === "effective";
    if (needsEffective) {
      const missing = [...new Set(selectedEvidence.filter((e) => e.effectiveRent === null).map((e) => e.propertyName))];
      if (missing.length) warnings.push(`Effective rent or incentive eligibility is unknown for some observations at: ${missing.join(", ")}. Missing incentive text does not mean no incentives.`);
    }
    if (name === "compare_properties" && selectedEvidence.some((e) => e.sqft === null)) warnings.push("Square footage is missing for some observations.");
    if (name === "get_conflicts" && selectedListings.some((l) => !unitIdentity(l))) warnings.push("Some observations have no verified physical unit number, so their cross-source or snapshot conflicts cannot be assessed.");
    if (selectedListings.some((l) => !unitIdentity(l))) warnings.push("Records without physical unit numbers are listing observations, not a verified count of distinct units.");
    if (conflicts.length) warnings.push(...[...new Set(conflicts.map((c) => `Sources or snapshots disagree on ${c.field} for ${nameOf(c.propertyId)}, unit ${c.unitId}. All values are preserved; this can reflect a change over time.`))]);
    let shown = selectedEvidence;
    let summary = `Searched ${selectedEvidence.length} listing observations in the stored snapshot.`;
    let rows: ToolResult["rows"] = [];
    const effectiveBasis = args.basis === "effective" || name === "get_effective_rent";
    const value = (e: Evidence) => effectiveBasis ? e.effectiveRent : e.rawRent;
    if (["get_cheapest_units", "get_effective_rent", "get_units_under_budget"].includes(name)) {
      shown = selectedEvidence.filter((e) => value(e) !== null && (name !== "get_units_under_budget" || value(e)! <= args.budget!)).sort((a, b) => value(a)! - value(b)!);
      if (conflicts.some((c) => c.field === "rent" || (effectiveBasis && c.field === "incentive"))) {
        warnings.push("A unique cheapest unit cannot be confirmed while relevant observations disagree.");
      }
      summary = shown.length ? `Compared ${selectedEvidence.length} observations. Lowest ${effectiveBasis ? "measured effective" : "listed"} rent among eligible observations: ${money(value(shown[0])!)} at ${shown[0].propertyName}.` : "No matching observations with the requested rent measure. Missing values remain unknown.";
      if (effectiveBasis) summary += " Only observations with calculable incentives and known unit eligibility are ranked; this does not establish the cheapest building overall.";
    }
    if (name === "get_incentives") {
      shown = selectedEvidence.filter((e) => e.incentive);
      summary = `Found incentive text on ${shown.length} of ${selectedEvidence.length} observations. Unconfirmed or missing incentives are not treated as zero discounts.`;
      const measured = shown.filter((e) => e.effectiveRent !== null).sort((a, b) => (b.rawRent - b.effectiveRent!) - (a.rawRent - a.effectiveRent!));
      if (measured.length) summary += ` Among observations with calculable incentives, ${measured[0].propertyName} has the strongest measured monthly discount: ${money(measured[0].rawRent - measured[0].effectiveRent!)}. This is not an overall winner when incentive data is missing.`;
    }
    if (name === "get_average_rent") {
      // Reuse existing deterministic consolidation for raw rent by unit type.
      rows = UNIT_TYPES.filter((type) => !args.unitType || type === args.unitType).flatMap((type) => {
        const subset = selectedListings.filter((l) => l.unitType === type);
        const rollup = summarizeByUnitType(subset, type);
        if (!rollup) return [];
        const eligible = indices.filter((i) => listings[i].unitType === type).map((i) => evidence[i]).filter((e) => value(e) !== null);
        if (!eligible.length) return [{ label: type, value: "Unknown", sublabel: "No calculable effective rents" }];
        const average = effectiveBasis ? eligible.reduce((sum, e) => sum + e.effectiveRent!, 0) / eligible.length : rollup.avgRent;
        return [{ label: type, value: money(average), sublabel: `Mean ${effectiveBasis ? "effective" : "listed"} rent across ${eligible.length} observations; not deduplicated physical units.` }];
      });
      summary = "Average rents calculated deterministically by unit type from stored observations.";
      if (conflicts.length) { rows = []; summary = "Average withheld because matching unit observations conflict. Resolve or explicitly select a snapshot before averaging."; }
    }
    if (name === "get_conflicts") summary = conflicts.length ? `Found ${conflicts.length} conflicting fields for identifiable units.` : "No conflicts detected among identifiable units in the available observations. This does not prove sources agree.";
    if (name === "compare_properties") {
      // Interleave properties so a large first building cannot hide the other.
      const groups = propertyIds.map((id) => shown.filter((e) => e.propertyId === id));
      shown = Array.from({ length: Math.max(0, ...groups.map((g) => g.length)) }, (_, i) => groups.flatMap((group) => group[i] ? [group[i]] : [])).flat();
    }
    if (name === "compare_properties") summary = `Compared ${propertyIds.map(nameOf).join(" and ")} using ${selectedEvidence.length} observations. Raw rent, measured effective rent, square footage, incentives, and missing fields follow.`;
    if (!rows.length && name !== "get_average_rent") rows = shown.slice(0, args.limit ?? 12).map((e) => ({
      label: `${e.propertyName}${e.unitNumber ? ` · unit ${e.unitNumber}` : ""} [${e.id}]`,
      propertyId: e.propertyId,
      value: `Listed ${money(e.rawRent)} · effective ${e.effectiveRent === null ? "unknown" : money(e.effectiveRent)}`,
      sublabel: `${e.sqft === null ? "Sqft unknown" : `${e.sqft} sqft`} · ${e.incentive ?? "Incentive unknown"} · ${e.calculation}`,
    }));
    const limit = args.limit ?? 12;
    if (shown.length > limit && name !== "get_average_rent") warnings.push(`Supporting rows show ${limit} of ${shown.length} observations; Sources retains the full inspected cohort.`);
    const answerable = name === "get_conflicts" ? selectedListings.some((l) => unitIdentity(l)) : name === "get_average_rent" ? rows.some((r) => r.value !== "Unknown") : shown.length > 0 && (!needsEffective || shown.some((e) => e.effectiveRent !== null) || ["get_incentives", "compare_properties"].includes(name));
    const result: ToolResult = { id: `result-${results.length + 1}`, summary, evidence: selectedEvidence, rows, conflicts, warnings, confidence: classifyConfidence(selectedEvidence.length, warnings, conflicts, answerable), listingsInspected: selectedEvidence.length };
    results.push(result);
    actions.push({ tool: name, arguments: args, listingsInspected: selectedEvidence.length, evidenceIds: selectedEvidence.map((e) => e.id), summary });
    return result;
  }
  return { execute, actions, results };
}

export function buildResearchAnswer(question: string, results: ToolResult[], actions: ToolAction[], summary?: string, mode: "claude" | "deterministic" = "deterministic", requestedConfidence?: AnswerConfidence): Answer {
  const sources = [...new Map(results.flatMap((r) => r.evidence).map((e) => [e.id, e])).values()];
  const conflicts = [...new Map(results.flatMap((r) => r.conflicts).map((c) => [JSON.stringify(c), c])).values()];
  const warnings = [...new Set(results.flatMap((r) => r.warnings))];
  let confidence = classifyConfidence(sources.length, warnings, conflicts, results.some((r) => r.confidence !== "UNKNOWN"));
  if (!conflicts.length && requestedConfidence === "UNKNOWN") confidence = "UNKNOWN";
  if (confidence === "SUPPORTED" && (requestedConfidence === "PARTIAL" || results.some((r) => r.confidence === "UNKNOWN"))) confidence = "PARTIAL";
  const headline = summary ?? (results.map((r) => r.summary).join("\n") || "The available evidence cannot answer this question.");
  const rows = results.flatMap((r) => r.rows);
  const detail = "Based on stored listing observations, not a live availability check. Financial values below are calculated by code. Default normalization uses 12 months unless the incentive states a lease term; confirm the actual lease before relying on it.";
  const finalAnswer = [headline, detail, ...rows.map((r) => `${r.label}: ${r.value}. ${r.sublabel ?? ""}`), ...warnings].join("\n");
  return { intent: "research", headline, detail, rows, sources, conflicts, warnings, confidence, mode,
    trace: { question, tools: actions, listingsInspected: new Set(actions.flatMap((a) => a.evidenceIds)).size, sourcesUsed: sources.map((e) => e.id), conflictsDetected: conflicts, confidence, finalAnswer } };
}

/** Extend the old parser for the demo questions; retain all its original intents. */
export function runDeterministicResearch(question: string, context: ResearchContext): Answer {
  const tools = createResearchTools(context);
  const lower = question.toLowerCase();
  const propertyIds = PROPERTIES.filter((p) => lower.includes(p.name.toLowerCase().replace(/^the /, "")) || lower.includes(p.id)).map((p) => p.id);
  const unitType = detectUnitType(question) ?? undefined;
  const args: ToolArgs = { unitType, ...(propertyIds.length ? { propertyIds } : {}) };
  let tool: ToolName | undefined;
  if (/conflict|disagree/.test(lower)) tool = "get_conflicts";
  else if (propertyIds.length >= 2 && /compar|choos|between/.test(lower)) tool = "compare_properties";
  else if (/under|below|less than/.test(lower) && detectDollar(question)) { tool = "get_units_under_budget"; args.budget = detectDollar(question)!; args.basis = /effective|after incentives/.test(lower) ? "effective" : "raw"; }
  else if (/effective|after incentives/.test(lower)) { tool = /average|avg|mean/.test(lower) ? "get_average_rent" : "get_cheapest_units"; args.basis = "effective"; }
  else if (/incentive|promo|deal|special/.test(lower)) tool = "get_incentives";

  if (tool) return buildResearchAnswer(question, [tools.execute(tool, args)], tools.actions);

  const subset = context.listings.filter((l) => l.source !== "mock" && (!args.propertyIds || args.propertyIds.includes(l.propertyId)) && (!unitType || l.unitType === unitType));
  const legacy = runQuery(question, subset);
  if (["empty", "unclear"].includes(legacy.intent)) return { ...buildResearchAnswer(question, [], [], legacy.headline), suggestedFollowUps: legacy.suggestedFollowUps };
  const result = tools.execute("search_listings", args);
  if (/best-value|persqft/.test(legacy.intent) && subset.some((l) => !l.sqft)) result.warnings.push("Square footage is missing for some observations; only known areas can be compared.");
  if (/best-value|persqft/.test(legacy.intent) && !subset.some((l) => l.sqft && l.sqft > 0)) result.confidence = "UNKNOWN";
  const answer = buildResearchAnswer(question, [result], tools.actions, legacy.headline);
  answer.rows = legacy.rows;
  answer.detail = `${legacy.detail ?? ""} Based on the stored snapshot; observation counts are not confirmed live unit availability.`;
  answer.suggestedFollowUps = legacy.suggestedFollowUps;
  answer.trace!.finalAnswer = [answer.headline, answer.detail, ...(answer.rows ?? []).map((r) => `${r.label}: ${r.value}. ${r.sublabel ?? ""}`), ...(answer.warnings ?? [])].join("\n");
  return answer;
}
