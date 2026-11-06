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
      colors: {
        ink: { 950: "#0B0F17", 900: "#0F141D", 850: "#131A25", 800: "#18202D", 700: "#222C3B", 600: "#2E3A4C", 500: "#4A5870", 400: "#7D8AA0", 300: "#A9B3C4", 200: "#D3D9E3", 100: "#EEF1F6" },
        brand: { 600: "#3F5FE0", 500: "#5B7CFF", 400: "#8099FF", 300: "#A8B9FF" },
      },
    },
  },
  plugins: [],
};
