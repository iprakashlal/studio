import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Studio app. `base: "./"` lets it run from any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
