import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1b1d1a",
        paper: "#f6f5ef",
        cream: "#efeee5",
        line: "#d8d9cf",
        moss: "#68715f",
        orange: "#d65a2e",
        sage: "#dfe7d9",
      },
      boxShadow: {
        card: "0 12px 40px rgba(28, 33, 24, 0.06)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
