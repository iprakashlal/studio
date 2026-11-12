import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Which Studio build made a site: written into each site's cms/site.json, so "Push updates" can tell which
// live sites are on an older build.
const sha = (() => { try { return (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7); } catch { return "dev"; } })();
const STUDIO_BUILD = { id: sha, at: new Date().toISOString() };

// The Studio app. `base: "./"` lets it run from any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __STUDIO_BUILD__: JSON.stringify(STUDIO_BUILD) },
  build: { outDir: "dist", emptyOutDir: true },
});
