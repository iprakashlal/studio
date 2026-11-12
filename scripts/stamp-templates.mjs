// Adds the Studio build to the template pages' own script and style links (assets/*.js, cms/admin.js, …),
// so browsers fetch the new files after a Studio update instead of a cached copy: in the editor's preview
// and on every site published or pushed from this build.
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let v = "dev";
try { v = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString()).trim().slice(0, 7); } catch { /* not a git checkout */ }
const root = "dist/templates";
let n = 0;
for (const t of readdirSync(root)) {
  const dir = join(root, t);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) {
    const p = join(dir, f), s = readFileSync(p, "utf8");
    const out = s.replace(/(<(?:script|link)\b[^>]*\b(?:src|href)=")((?:assets|cms)\/[\w.-]+\.(?:js|css))(")/g, (_, a, url, b) => { n++; return `${a}${url}?v=${v}${b}`; });
    if (out !== s) writeFileSync(p, out);
  }
}
console.log(`stamped ${n} template links with build ${v}`);
