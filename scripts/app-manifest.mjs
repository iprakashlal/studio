// Lists every file of the built Studio with its SHA-1 and Cloudflare hash (dist/app-files.json), so the Studio can
// put a copy of itself on Netlify or Cloudflare (Settings → Migration) and update that copy later, uploading only what changed.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

let v = "dev";
try { v = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7); } catch { /* not a git checkout */ }
const root = "dist", files = {}, cf = {};
// Cloudflare's name for a file: SHA-256 of its base64 plus its extension, 32 hex characters (and its size).
const cfHash = (buf, path) => createHash("sha256").update(buf.toString("base64") + ((/\.([^./]+)$/.exec(path) || [])[1] || "")).digest("hex").slice(0, 32);
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else { const r = relative(root, p).split("\\").join("/"); if (r !== "app-files.json" && r !== "studio.config.json") { const b = readFileSync(p); files[r] = createHash("sha1").update(b).digest("hex"); cf[r] = [cfHash(b, r), b.length]; } } } };
walk(root);
writeFileSync(join(root, "app-files.json"), JSON.stringify({ build: v, at: new Date().toISOString(), files, cf }, null, 1));
console.log(`app-files.json: ${Object.keys(files).length} files, build ${v}`);
