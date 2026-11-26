// Copies the shared runtime files (src/fx/*.js) into every template's assets/ folder,
// so the live preview and exported sites load them as assets/fx.js and assets/motifs.js.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = ["fx.js", "motifs.js", "layouts.js", "warranty.js", "slides.js", "pages.js", "maint.js", "addons.js", "festival.js", "consent.js", "menu.js", "lang.js", "video.js", "wall.js", "social.js", "acct.js"];
const root = "public/templates";
for (const t of readdirSync(root)) {
  if (!statSync(join(root, t)).isDirectory()) continue;
  mkdirSync(join(root, t, "assets"), { recursive: true });
  for (const f of files) copyFileSync(join("src/fx", f), join(root, t, "assets", f));
}
// The shop and the restaurant need the invoice.
copyFileSync("src/fx/invoice.js", join(root, "store", "assets", "invoice.js"));
copyFileSync("src/fx/invoice.js", join(root, "restaurant", "assets", "invoice.js"));
console.log("fx.js and motifs.js synced to templates");

// A page that loads a shared script the template's manifest doesn't list would work in the Studio's preview and break on
// every published site (the export copies only what the manifest lists): stop the build instead.
import { existsSync, readFileSync } from "node:fs";
const missing = [];
for (const t of readdirSync(root)) {
  const dir = join(root, t), mf = join(dir, "manifest.json");
  if (!statSync(dir).isDirectory() || !existsSync(mf)) continue;
  const listed = new Set(JSON.parse(readFileSync(mf, "utf8")).files || []);
  const pages = [...readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => join(dir, f)), ...readdirSync(join(dir, "assets")).filter((f) => f.endsWith(".js")).map((f) => join(dir, "assets", f))];
  const used = new Set();
  for (const p of pages) for (const m of readFileSync(p, "utf8").matchAll(/["'`](assets\/[\w.-]+\.js)/g)) used.add(m[1]);
  for (const u of used) if (files.includes(u.slice(7)) && !listed.has(u) && listed.has(u.replace(/[\w.-]+$/, "fx.js"))) missing.push(`${t}: ${u}`);
}
if (missing.length) { console.error("These shared scripts are loaded by a template but missing from its manifest.json:\n  " + missing.join("\n  ")); process.exit(1); }
