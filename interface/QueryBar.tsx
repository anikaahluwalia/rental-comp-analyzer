"use client";

/**
 * The "Ask the market" question box on the Ask page.
 *
 * Type a question about the Fitzrovia portfolio — like "cheapest 2-bed
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

  function usePrompt(prompt: string) {
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
                onClick={() => usePrompt(s)}
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

      {answer ? <AnswerCard answer={answer} onFollowUp={usePrompt} /> : null}
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
        </div>
        <h2
          style={displayHeadline}
          className="headline mt-3 text-3xl sm:text-4xl"
        >
          {answer.headline}
        </h2>
        {answer.detail ? (
          <p className="mt-3 text-sm leading-relaxed text-ash">
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
