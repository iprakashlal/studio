// Regenerates public/templates/cfdb/worker.js (the database Worker the Studio uploads) from worker/db-worker.ts,
// so the file the Studio ships always matches the code and CFDB_VERSION.
import { build } from "esbuild";
await build({
  entryPoints: ["worker/db-worker.ts"], bundle: true, format: "esm", target: "es2022", platform: "neutral",
  banner: { js: "// Site Studio database for Cloudflare Workers (D1). Set up and updated from the Studio. Generated from worker/db-worker.ts." },
  outfile: "public/templates/cfdb/worker.js", logLevel: "error",
});
console.log("database Worker rebuilt");
