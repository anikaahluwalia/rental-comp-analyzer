import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./interface/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fitzrovia brand palette — matched against fitzrovia.ca. Near-white
        // paper canvas, near-black ink, tomato-red "clay" as the single
        // chromatic accent (CTAs, active underlines). Forest + bronze are
        // retained as tertiary accents for data surfaces (chart bars, etc.)
        // but no longer carry UI state.
        paper: "#FAFAF7",
        bone: "#F4F0E8",
        "bone-soft": "#EDE9DF",
        clay: {
          DEFAULT: "#E84A1E",
          deep: "#C13A12",
          soft: "#F2E4DD",
        },
        forest: {
          DEFAULT: "#253825",
          deep: "#182316",
          ink: "#0F1A10",
        },
        bronze: {
          DEFAULT: "#9C7E3E",
          soft: "#B89A5B",
        },
        ink: "#0B0B0B",
        ash: "#6B6659",
        line: "#E4E1D8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        serif: [
          "var(--font-playfair)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "serif",
        ],
      },
      letterSpacing: {
        widest: "0.25em",
        widestx: "0.3em",
      },
    },
  },
  plugins: [],
};

export default config;
