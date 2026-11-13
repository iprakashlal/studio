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

// The Site Studio database (Settings → Migration / Studio Partners / Host outside GitHub on Cloudflare).
await build({
  entryPoints: ["worker/db-worker.ts"],
  outfile: "public/templates/cfdb/worker.js",
  bundle: true, format: "esm", target: "es2022", platform: "neutral", legalComments: "none",
  banner: { js: "// Site Studio database for Cloudflare Workers (D1). Set up and updated from the Studio. Generated from worker/db-worker.ts.\n" },
});
console.log("worker built: public/templates/cfdb/worker.js");
