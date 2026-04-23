"use client";

/**
 * The login form on the sign-in screen.
 *
 * Takes the user's email and password, sends them to the server for
 * verification, and reacts based on what comes back:
 *   - Correct credentials → send them to the dashboard.
 *   - Anything wrong → show a friendly error message.
 *
 * One intentional security choice: whether the email doesn't exist or
 * the password is wrong, we show the same "Incorrect email or password"
 * message either way. That prevents an attacker from using this form to
 * figure out which email addresses have accounts.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COLORS } from "@/features/ui-style";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Sign in failed. Please try again.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="analyst@fitzrovia.ca"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {loading ? "Signing in…" : <>Sign in <span aria-hidden>→</span></>}
      </button>

      <div className="space-y-3 border-t border-line pt-6">
        <p className="text-xs tracking-[0.1em] text-ash">
          New to Fitzrovia?{" "}
          <Link
            href="/signup"
            style={{ color: COLORS.clay, textDecorationColor: COLORS.clay }}
            className="font-semibold uppercase tracking-[0.15em] underline decoration-2 underline-offset-[5px] hover:opacity-80"
          >
            Create an account →
          </Link>
        </p>

        <details className="text-[11px] leading-relaxed text-ash/80">
          <summary className="cursor-pointer font-semibold uppercase tracking-[0.15em] text-ash hover:text-clay">
            Demo credentials
          </summary>
          <div className="mt-3 space-y-1 font-mono text-[11px]">
            <div>
              <span style={{ color: COLORS.clay }}>admin@fitzrovia.ca</span> · admin123
            </div>
          </div>
        </details>
      </div>
    </form>
  );
}
