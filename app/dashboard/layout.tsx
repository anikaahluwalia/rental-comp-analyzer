/**
 * The shared wrapper used by every dashboard page.
 *
 * Builds the top header — Fitzrovia logo on the left, tab navigation
 * in the middle (Overview / Compare / Ask), and the current user's
 * email + sign-out button on the right.
 *
 * Before showing anything, it checks whether the user is signed in.
 * If they aren't, they're sent back to the login screen immediately —
 * no part of the dashboard ever flashes on screen for someone who
 * shouldn't see it.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth";
import { FitzroviaMark } from "@/interface/FitzroviaMark";
import { SignOutButton } from "@/interface/SignOutButton";
import { DashboardNav } from "@/interface/DashboardNav";
import { clayBrandStripe, COLORS, labelItalic } from "@/features/ui-style";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-paper">
      {/* Clay brand stripe — anchors the page to the Fitzrovia accent color. */}
      <div style={clayBrandStripe} />
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 text-ink"
          >
            <FitzroviaMark className="h-8 w-8" />
            <div className="text-sm">
              <div className="font-black tracking-[0.08em] text-ink">
                FITZROVIA
              </div>
              <div
                style={{ ...labelItalic, fontSize: 11 }}
              >
                Rental Comp
              </div>
            </div>
          </Link>

          <DashboardNav />

          <div className="flex items-center gap-6">
            <div className="hidden text-right sm:block">
              <div className="text-[11px] uppercase tracking-[0.2em] text-ash">
                {session.email}
              </div>
              <div
                style={{ ...labelItalic, color: COLORS.clay, fontSize: 11 }}
                className="mt-0.5"
              >
                {session.role}
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-14 sm:px-10">{children}</main>
    </div>
  );
}
