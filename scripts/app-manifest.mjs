// Lists every file of the built Studio with its SHA-1 (dist/app-files.json), so the Studio can put a copy of
// itself on Netlify (Settings → Migration) and update that copy later, uploading only what changed.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

let v = "dev";
try { v = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7); } catch { /* not a git checkout */ }
const root = "dist", files = {};
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else { const r = relative(root, p).split("\\").join("/"); if (r !== "app-files.json" && r !== "studio.config.json") files[r] = createHash("sha1").update(readFileSync(p)).digest("hex"); } } };
walk(root);
writeFileSync(join(root, "app-files.json"), JSON.stringify({ build: v, at: new Date().toISOString(), files }, null, 1));
console.log(`app-files.json: ${Object.keys(files).length} files, build ${v}`);
