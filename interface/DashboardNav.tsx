"use client";

/**
 * The tab navigation in the dashboard header.
 *
 * Three tabs — Overview, Compare, Ask — each linking to its page.
 * The tab matching whichever page you're currently on gets highlighted
 * in the clay accent colour with an underline, so you always know
 * where you are.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLORS } from "@/features/ui-style";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/compare", label: "Compare" },
  { href: "/dashboard/query", label: "Ask" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav className="order-last flex w-full items-center gap-6 sm:order-none sm:w-auto">
      {LINKS.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            style={
              active
                ? {
                    color: COLORS.clay,
                    borderBottom: `2px solid ${COLORS.clay}`,
                  }
                : { borderBottom: "2px solid transparent" }
            }
            className={[
              "text-[11px] font-semibold uppercase tracking-[0.25em] pb-1 transition-colors",
              active ? "" : "text-ink/70 hover:text-ink",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
