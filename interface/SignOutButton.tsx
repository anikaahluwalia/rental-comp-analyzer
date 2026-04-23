"use client";

/**
 * The "Sign out" button in the top-right of the dashboard header.
 *
 * When clicked, it tells the server to end the user's session, then
 * sends them back to the login screen. The button shows "Signing out…"
 * for the brief moment that takes, so the click always feels
 * responsive.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="inline-flex items-center gap-2 border border-ink bg-transparent px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink transition-colors hover:bg-clay hover:border-clay hover:text-ink disabled:opacity-50"
    >
      {loading ? "Signing out…" : <>Sign out <span aria-hidden>→</span></>}
    </button>
  );
}
