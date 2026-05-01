/**
 * The outer wrapper for every page in the app.
 *
 * Loads the two brand fonts (Inter and Playfair Display) and sets the
 * browser tab title. Also tells search engines not to list this app in
 * their results — it's an internal tool, not a public website.
 */
import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Midtown Rental Comp",
  description:
    "Internal portal for tracking competitive rental pricing across Midtown Toronto.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
