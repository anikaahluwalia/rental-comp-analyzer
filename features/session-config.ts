/**
 * Edge-safe session constants.
 *
 * This file is imported by `middleware.ts` (Edge runtime) AND by
 * `lib/auth.ts` (Node runtime). Keeping it free of `next/headers` and Node
 * APIs so it can be used in both.
 */

export const SESSION_COOKIE = "midtown_comp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week

/**
 * Role-based access. The brief doesn't require RBAC today, but the
 * production system will — executives see the PDF report and dashboards,
 * analysts additionally see scraper internals, and admins can trigger
 * scrapes and manage users. Having the slot now means new routes can be
 * gated from day one.
 */
export type Role = "admin" | "analyst" | "viewer";

export type Session = {
  email: string;
  role: Role;
};

/** Route-level policy helper. Extend as more resources are added. */
export const ROLE_CAN: Record<Role, { triggerScrape: boolean; exportPdf: boolean; viewDashboard: boolean }> = {
  admin: { triggerScrape: true, exportPdf: true, viewDashboard: true },
  analyst: { triggerScrape: true, exportPdf: true, viewDashboard: true },
  viewer: { triggerScrape: false, exportPdf: true, viewDashboard: true },
};
