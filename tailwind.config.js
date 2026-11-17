/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "Manrope", "ui-sans-serif", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
      },
      // Both families read CSS variables, so a tint (src/lib/tint.ts) can recolour the interface; the numbers are the standard colours.
      colors: {
        ink: { 950: "rgb(var(--ink-950, 11 15 23) / <alpha-value>)", 900: "rgb(var(--ink-900, 15 20 29) / <alpha-value>)", 850: "rgb(var(--ink-850, 19 26 37) / <alpha-value>)", 800: "rgb(var(--ink-800, 24 32 45) / <alpha-value>)", 700: "rgb(var(--ink-700, 34 44 59) / <alpha-value>)", 600: "rgb(var(--ink-600, 46 58 76) / <alpha-value>)", 500: "rgb(var(--ink-500, 74 88 112) / <alpha-value>)", 400: "rgb(var(--ink-400, 125 138 160) / <alpha-value>)", 300: "rgb(var(--ink-300, 169 179 196) / <alpha-value>)", 200: "rgb(var(--ink-200, 211 217 227) / <alpha-value>)", 100: "rgb(var(--ink-100, 238 241 246) / <alpha-value>)" },
        brand: { 600: "rgb(var(--brand-600, 63 95 224) / <alpha-value>)", 500: "rgb(var(--brand-500, 91 124 255) / <alpha-value>)", 400: "rgb(var(--brand-400, 128 153 255) / <alpha-value>)", 300: "rgb(var(--brand-300, 168 185 255) / <alpha-value>)" },
      },
    },
  },
  plugins: [],
};
