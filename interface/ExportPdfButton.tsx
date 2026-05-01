"use client";

import { useState } from "react";
import { COLORS } from "@/features/ui-style";

/**
 * Download the PDF report. Uses a blob fetch (rather than a raw <a href>)
 * so we can show a loading state while @react-pdf renders server-side
 * (which takes ~1–2s on a cold start).
 */
export function ExportPdfButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/export-pdf", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `midtown-rental-comp-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={onExport}
        disabled={loading}
        style={{
          backgroundColor: COLORS.white,
          color: COLORS.ink,
          border: `1px solid ${COLORS.ink}`,
        }}
        className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {loading ? "Rendering…" : "Export PDF"}
        {!loading && <span aria-hidden>↓</span>}
      </button>
      {error ? <p className="text-xs text-red-900">{error}</p> : null}
    </div>
  );
}
