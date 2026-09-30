"use client";

/**
 * The "Ask the market" question box on the Ask page.
 *
 * Type a question about the comp set — like "cheapest 2-bed
 * under $3500" or "which building has the biggest rent drop" — and hit
 * Ask. An answer card appears below with a headline, supporting numbers,
 * links to any buildings mentioned, and a few suggested follow-up
 * questions you can click to keep exploring.
 *
 * If you don't know where to start, the page shows some example
 * questions as clickable chips. Clicking one runs it immediately so
 * you can see the kind of answers the tool can produce.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { safeSourceUrl } from "@/features/research";
import type { Answer } from "@/features/query";
import { COLORS, clayAccentBar, displayHeadline, labelItalic } from "@/features/ui-style";

export function QueryBar({ suggestions }: { suggestions: string[] }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function ask(input: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: input }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Query failed");
      }
      const data = (await res.json()) as { answer: Answer };
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!q.trim()) return;
    await ask(q);
  }

  function askSuggestedQuestion(prompt: string) {
    setQ(prompt);
    void ask(prompt);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="relative">
        <label htmlFor="q" className="field-label">
          Ask the market
        </label>
        <div className="mt-3 flex items-stretch gap-0 border-b-2 border-ink focus-within:border-clay">
          <input
            id="q"
            autoFocus
            type="text"
            placeholder="e.g. cheapest 2-bed under $3500"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent px-1 py-3 text-lg placeholder-ash/60 focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !q.trim()}
            style={{ backgroundColor: COLORS.clay, color: COLORS.ink }}
            className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Thinking…" : <>Ask <span aria-hidden>→</span></>}
          </button>
        </div>
      </form>

      {/* Suggestions */}
      {!answer && !loading ? (
        <div>
          <div style={{ ...labelItalic, fontSize: 14 }}>Try</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => askSuggestedQuestion(s)}
                className="border border-ink bg-paper px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-sm border border-red-900/20 bg-red-900/5 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {answer ? <AnswerCard answer={answer} onFollowUp={askSuggestedQuestion} /> : null}
    </div>
  );
}

function AnswerCard({
  answer,
  onFollowUp,
}: {
  answer: Answer;
  onFollowUp: (prompt: string) => void;
}) {
  return (
    <article className="space-y-6 surface p-8">
      <div>
        <div className="flex items-center gap-3">
          <span style={clayAccentBar} aria-hidden />
          <span style={{ ...labelItalic, fontSize: 14 }}>Answer</span>
          {answer.confidence ? <span className="text-xs font-semibold">{answer.confidence} · {answer.mode === "claude" ? "Claude + tools" : "Deterministic"}</span> : null}
        </div>
        <h2
          style={answer.intent === "research" ? undefined : displayHeadline}
          className={answer.intent === "research" ? "mt-3 whitespace-pre-line text-xl font-semibold leading-relaxed" : "headline mt-3 text-3xl sm:text-4xl"}
        >
          {answer.headline}
        </h2>
        {answer.detail ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ash">
            {answer.detail}
          </p>
        ) : null}
      </div>

      {answer.rows && answer.rows.length > 0 ? (
        <div className="border-t border-line pt-6">
          <div style={{ ...labelItalic, fontSize: 14 }}>Supporting data</div>
          <ul className="mt-3 divide-y divide-line">
            {answer.rows.map((row, i) => (
              <li
                key={`${row.label}-${i}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-black uppercase tracking-[0.05em] text-ink">
                    {row.propertyId ? (
                      <Link
                        href={`/dashboard/buildings/${row.propertyId}`}
                        className="hover:text-clay"
                      >
                        {row.label}
                      </Link>
                    ) : (
                      row.label
                    )}
                  </div>
                  {row.sublabel ? (
                    <div style={{ ...labelItalic, fontSize: 12 }}>
                      {row.sublabel}
                    </div>
                  ) : null}
                </div>
                <div className="text-right text-sm font-semibold text-ink">
                  {row.value}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.warnings?.length ? (
        <div className="border-t border-line pt-4 text-sm" role="status">
          <strong>Evidence limitations</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">{answer.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : null}

      {answer.conflicts?.length ? (
        <section className="border-t border-line pt-4 text-sm" aria-label="Source conflicts">
          <strong>Sources disagree</strong>
          {answer.conflicts.map((conflict, i) => (
            <div key={i} className="mt-3">
              <p>{conflict.propertyId} · unit {conflict.unitId} · {conflict.field}</p>
              <ul className="list-disc pl-5">{conflict.values.map((entry, j) => (
                <li key={j}>{String(entry.value)} · {entry.timestamp ?? "Timestamp unknown"} · {safeSourceUrl(entry.source) ? <a className="underline" href={safeSourceUrl(entry.source)} target="_blank" rel="noopener noreferrer">Source</a> : "Source URL unavailable"}</li>
              ))}</ul>
            </div>
          ))}
        </section>
      ) : null}

      {answer.sources?.length ? (
        <section className="border-t border-line pt-4 text-xs" aria-label="Sources">
          <h3 style={{ ...labelItalic, fontSize: 14 }}>Sources</h3>
          <p className="mt-2">Listing observations used by the tools, including the full cohort behind comparisons and averages.</p>
          <ul className="mt-3 max-h-72 space-y-3 overflow-auto">
            {answer.sources.map((source) => (
              <li key={source.id} id={source.id}>
                <strong>[{source.id}] {source.propertyName}</strong>
                {source.listingId ? ` · observation ${source.listingId}` : ""}
                {source.sourceUrl ? <> · <a href={safeSourceUrl(source.sourceUrl)} target="_blank" rel="noopener noreferrer" className="underline">Original source</a></> : " · Source URL unavailable"}
                <p>Scraped: {source.scrapedAt ?? "unknown"} · Listed: ${source.rawRent.toFixed(2)} · Effective: {source.effectiveRent === null ? "unknown" : `$${source.effectiveRent.toFixed(2)}`}</p>
                <p>{source.incentive ?? "Incentive information missing"}{source.incentiveSourceUrl ? <> · <a href={safeSourceUrl(source.incentiveSourceUrl)} className="underline" target="_blank" rel="noopener noreferrer">Incentive source</a></> : null}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {answer.trace ? (
        <details className="border-t border-line pt-4 text-sm">
          <summary className="cursor-pointer font-semibold">How this answer was built</summary>
          <p className="mt-3">Question: {answer.trace.question}</p>
          <ol className="mt-3 space-y-3">
            {answer.trace.tools.map((action, i) => (
              <li key={i}>↓ {action.tool} · inspected {action.listingsInspected} observations
                <pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(action.arguments, null, 2)}</pre>
                <p>{action.error ?? action.summary}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3">↓ {answer.trace.listingsInspected} distinct observations inspected · {answer.trace.conflictsDetected.length} conflicting fields · {answer.trace.sourcesUsed.length} source observations used</p>
          <p>↓ {answer.trace.confidence} · final answer shown above</p>
        </details>
      ) : null}

      {answer.citations && answer.citations.length > 0 ? (
        <div className="border-t border-line pt-6">
          <div style={{ ...labelItalic, fontSize: 14 }}>
            Referenced buildings
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {answer.citations.map((c) => (
              <Link
                key={c.propertyId}
                href={`/dashboard/buildings/${c.propertyId}`}
                className="border border-ink bg-paper px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-ink hover:bg-ink hover:text-paper"
              >
                {c.propertyName} →
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {answer.suggestedFollowUps && answer.suggestedFollowUps.length > 0 ? (
        <div className="border-t border-line pt-6">
          <div style={{ ...labelItalic, fontSize: 14 }}>Try next</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {answer.suggestedFollowUps.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onFollowUp(prompt)}
                className="border border-ink/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-ash hover:border-clay hover:text-clay"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
