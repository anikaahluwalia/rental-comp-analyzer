"use client";

/**
 * The signup form on the create-an-account screen.
 *
 * Takes an email and password (entered twice, to avoid typos), sends
 * them to the server, and if everything checks out the user is created
 * and signed in in one step — they go straight to the dashboard
 * without needing to log in separately.
 *
 * The form checks that the two password fields match before sending,
 * so mismatches fail instantly rather than round-tripping to the
 * server. The server re-checks everything as well; this is just a
 * polish for the user experience.
 */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COLORS } from "@/features/ui-style";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Sign up failed. Please try again.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="email" className="field-label">
          Work Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
          disabled={loading}
        />
        <p className="text-[11px] leading-relaxed text-ash/80">
          A{" "}
          <span style={{ color: COLORS.clay, fontWeight: 700 }}>@fitzrovia.ca</span>{" "}
          address is auto-promoted to{" "}
          <span style={{ color: COLORS.clay, fontWeight: 700 }}>analyst</span>.
          Others start as read-only viewers.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="field-label">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="field-input"
          disabled={loading}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-sm border border-red-900/20 bg-red-900/5 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        style={{ backgroundColor: COLORS.clay, color: COLORS.ink }}
        className="inline-flex w-full items-center justify-center gap-3 px-6 py-4 text-sm font-semibold uppercase tracking-[0.25em] transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating account…" : <>Create account <span aria-hidden>→</span></>}
      </button>
    </form>
  );
}
