"use client";

/**
 * The comparison table on the Compare page.
 *
 * Shows every unit in the portfolio grouped by size (studio, 1-bed,
 * 2-bed, and so on) and ranked cheapest-first. You can flip between
 * three ways of ranking:
 *   • Raw rent — the headline price on the listing.
 *   • Effective rent — what you actually pay per month after the
 *     promotion is spread over a year. This is usually what matters.
 *   • Rent per square foot — useful when units aren't the same size
 *     and you want to compare on price-per-space rather than total.
 *
 * Whichever ranking you pick, the #1 unit in each size category gets a
 * "Best value" badge. Switching the ranking can move the badge around,
 * and that's the whole point — different ways of looking at the data
 * can promote different winners.
 *
 * If a unit has a promotion, you'll see a "Show math" link next to it.
 * Clicking that drops down a breakdown explaining exactly how we got
 * from the headline price to the effective price.
 */
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { EnrichedListing } from "@/features/effective-rent";
import { UNIT_TYPES, type UnitType } from "@/features/types";
import {
  formatCAD,
  formatPricePerSqft,
  formatSqft,
} from "@/features/format";
import {
  COLORS,
  clayAccentBarShort,
  clayText,
  displayHeadline,
  labelItalic,
} from "@/features/ui-style";

type Basis = "raw" | "effective" | "persqft";

const BASIS_LABEL: Record<Basis, string> = {
  raw: "Raw rent",
  effective: "Effective rent",
  persqft: "Rent / sqft",
};

const BASIS_DESCRIPTION: Record<Basis, string> = {
  raw: "Headline monthly rent before incentives.",
  effective:
    "Monthly rent after amortizing the incentive over the lease term.",
  persqft: "Effective $/sqft — apples-to-apples across unit sizes.",
};

type Row = EnrichedListing & {
  propertyName: string;
};

export type CompareTableProps = {
  rowsByType: Partial<Record<UnitType, Row[]>>;
};

export function CompareTable({ rowsByType }: CompareTableProps) {
  const [basis, setBasis] = useState<Basis>("effective");
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  const typesWithData = useMemo(
    () => UNIT_TYPES.filter((t) => (rowsByType[t]?.length ?? 0) > 0),
    [rowsByType],
  );

  return (
    <div className="space-y-12">
      {/* Basis toggle */}
      <div className="flex flex-col gap-4 surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-ink">
            Compare on
          </div>
          <p
            style={{ ...labelItalic, color: COLORS.ink, fontSize: 16 }}
            className="mt-2 leading-relaxed"
          >
            {BASIS_DESCRIPTION[basis]}
          </p>
        </div>
        <div className="flex border border-ink">
          {(Object.keys(BASIS_LABEL) as Basis[]).map((b) => {
            const active = b === basis;
            return (
              <button
                key={b}
                onClick={() => setBasis(b)}
                style={
                  active
                    ? { backgroundColor: COLORS.clay, color: COLORS.ink }
                    : undefined
                }
                className={[
                  "px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors",
                  active
                    ? ""
                    : "bg-transparent text-ink hover:bg-ink hover:text-paper",
                ].join(" ")}
              >
                {BASIS_LABEL[b]}
              </button>
            );
          })}
        </div>
      </div>

      {typesWithData.map((unitType) => (
        <UnitTypeSection
          key={unitType}
          unitType={unitType}
          rows={rowsByType[unitType] ?? []}
          basis={basis}
          openRowKey={openRowKey}
          onToggle={(key) =>
            setOpenRowKey((curr) => (curr === key ? null : key))
          }
        />
      ))}
    </div>
  );
}

function UnitTypeSection({
  unitType,
  rows,
  basis,
  openRowKey,
  onToggle,
}: {
  unitType: UnitType;
  rows: Row[];
  basis: Basis;
  openRowKey: string | null;
  onToggle: (key: string) => void;
}) {
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => sortValue(a, basis) - sortValue(b, basis));
    return copy;
  }, [rows, basis]);

  const bestKey =
    sorted.length > 0 ? `${sorted[0].propertyId}-${sorted[0].unitId}` : null;

  return (
    <section>
      <header className="mb-6 flex items-end justify-between border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span style={clayAccentBarShort} aria-hidden />
            <span style={{ ...labelItalic, fontSize: 14 }}>{unitType}</span>
          </div>
          <h2
            style={displayHeadline}
            className="headline mt-2 text-3xl sm:text-4xl"
          >
            Best value — {unitType}<span style={clayText}>.</span>
          </h2>
        </div>
        <p style={{ ...labelItalic, fontSize: 14 }}>
          Ranked by {BASIS_LABEL[basis]} ·{" "}
          {sorted.length} unit{sorted.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="overflow-x-auto surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-[0.18em]">
            <tr>
              <th className="px-5 py-4 font-black text-ink">Rank</th>
              <th className="px-5 py-4 font-black text-ink">Building</th>
              <th className="px-5 py-4 text-right font-black text-ink">
                Raw rent
              </th>
              <th className="px-5 py-4 text-right font-black text-ink">
                Effective
              </th>
              <th className="px-5 py-4 text-right font-black text-ink">
                Sqft
              </th>
              <th className="px-5 py-4 text-right font-black text-ink">
                Eff. $/sqft
              </th>
              <th className="px-5 py-4 font-black text-ink">Incentive</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((row, i) => {
              const key = `${row.propertyId}-${row.unitId}`;
              const isBest = key === bestKey;
              const isOpen = openRowKey === key;
              const eff = row.effective;

              return (
                <Fragment key={key}>
                  <tr
                    className={
                      isBest
                        ? "bg-clay-soft/60 transition-colors"
                        : "transition-colors hover:bg-clay-soft/40"
                    }
                  >
                    <td className="px-5 py-5 font-mono text-xs text-ash">
                      #{i + 1}
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <div>
                          <Link
                            href={`/dashboard/buildings/${row.propertyId}`}
                            className="font-black uppercase tracking-[0.05em] text-ink hover:text-clay"
                          >
                            {row.propertyName}
                          </Link>
                          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ash">
                            {row.unitId ?? "—"}
                          </div>
                        </div>
                        {isBest ? (
                          <span
                            style={{
                              backgroundColor: COLORS.clay,
                              color: COLORS.ink,
                            }}
                            className="inline-flex items-center px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em]"
                          >
                            Best value
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-5 text-right text-ink">
                      {formatCAD(row.rent)}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <div
                        style={eff.applied ? { color: COLORS.clayDeep } : undefined}
                        className="font-semibold text-ink"
                      >
                        {formatCAD(eff.effectiveRent)}
                      </div>
                      {eff.applied ? (
                        <div
                          style={{ color: COLORS.clayDeep }}
                          className="text-[10px] uppercase tracking-[0.1em]"
                        >
                          −{formatCAD(eff.monthlySavings)} ·{" "}
                          {(eff.effectiveDiscountPct * 100).toFixed(1)}%
                        </div>
                      ) : eff.discount.kind === "needs-review" ? (
                        <div
                          style={{ color: COLORS.clay }}
                          className="text-[10px] uppercase tracking-[0.1em]"
                        >
                          Review needed
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-right text-ink">
                      {formatSqft(row.sqft)}
                    </td>
                    <td className="px-5 py-5 text-right text-ink">
                      {row.effectivePricePerSqft !== null
                        ? formatPricePerSqft(row.effectivePricePerSqft)
                        : "—"}
                    </td>
                    <td className="px-5 py-5 text-xs text-ash">
                      {row.incentive ? (
                        <span
                          style={{
                            backgroundColor: "rgba(232, 74, 30, 0.12)",
                            color: COLORS.clayDeep,
                          }}
                          className="inline-flex items-center px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
                        >
                          {row.incentive}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-5 text-right">
                      {row.incentive ? (
                        <button
                          onClick={() => onToggle(key)}
                          className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink underline decoration-clay decoration-2 underline-offset-[5px] hover:text-clay"
                        >
                          {isOpen ? "Hide math" : "Show math"}
                        </button>
                      ) : null}
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr className="bg-paper">
                      <td colSpan={8} className="px-5 py-6">
                        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-start sm:gap-6">
                          <div className="flex-1">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-ink">
                              How we calculated
                            </div>
                            <p
                              style={{ ...labelItalic, color: COLORS.ink }}
                              className="mt-2 leading-relaxed"
                            >
                              {eff.explanation}
                            </p>
                          </div>
                          <dl className="grid w-full max-w-md grid-cols-2 gap-x-4 gap-y-1 border-l border-line pl-6 text-xs sm:w-auto">
                            <dt style={labelItalic}>Raw rent</dt>
                            <dd className="text-right font-semibold">
                              {formatCAD(eff.rawRent)}
                            </dd>
                            <dt style={labelItalic}>Effective rent</dt>
                            <dd
                              style={{ color: COLORS.clayDeep }}
                              className="text-right font-semibold"
                            >
                              {formatCAD(eff.effectiveRent)}
                            </dd>
                            <dt style={labelItalic}>Savings / month</dt>
                            <dd className="text-right font-semibold">
                              {eff.applied
                                ? `−${formatCAD(eff.monthlySavings)}`
                                : "—"}
                            </dd>
                            <dt style={labelItalic}>Effective discount</dt>
                            <dd className="text-right font-semibold">
                              {eff.applied
                                ? `${(eff.effectiveDiscountPct * 100).toFixed(1)}%`
                                : "—"}
                            </dd>
                          </dl>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Returns the number to sort a row by, based on the currently selected
 * ranking (raw rent, effective rent, or rent per square foot).
 *
 * When ranking by rent-per-square-foot, some listings don't publish
 * a size so we can't calculate their $/sqft. Instead of crashing the
 * sort or pretending those units are "free" (which would wrongly put
 * them at the top), we push them to the very bottom of the list.
 */
function sortValue(r: Row, basis: Basis): number {
  switch (basis) {
    case "raw":
      return r.rent;
    case "effective":
      return r.effective.effectiveRent;
    case "persqft":
      return r.effectivePricePerSqft ?? Number.POSITIVE_INFINITY;
  }
}
