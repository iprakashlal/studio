// Bundles worker/shop-worker.ts (plus the shared shop code) into ONE file you can paste into the
// Cloudflare dashboard: public/templates/store/cloudflare/worker.js
import { build } from "esbuild";

await build({
  entryPoints: ["worker/shop-worker.ts"],
  outfile: "public/templates/store/cloudflare/worker.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  legalComments: "none",
  banner: { js: "// Site Studio shop backend for Cloudflare Workers. Paste this whole file into your Worker (Edit code → Deploy).\n// Setup: cloudflare/SETUP.md. Generated from worker/shop-worker.ts. Don't edit by hand.\n" },
  plugins: [{
    // The Supabase wiring in the shared file is never used on Cloudflare; stub its import.
    name: "no-npm-specifiers",
    setup(b) {
      b.onResolve({ filter: /^npm:/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const createClient = () => { throw new Error('Not available on Cloudflare'); };", loader: "js" }));
    },
  }],
});
console.log("Built public/templates/store/cloudflare/worker.js");
